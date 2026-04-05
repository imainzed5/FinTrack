import { v4 as uuidv4 } from 'uuid';
import {
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  subMonths,
  subDays,
  subWeeks,
  addMonths,
  addDays,
  startOfWeek,
  format,
  parseISO,
  differenceInDays,
  eachWeekOfInterval,
  eachDayOfInterval,
  isWithinInterval,
} from 'date-fns';
import type {
  Transaction,
  Insight,
  TimelineEvent,
  Subscription,
  Budget,
  BudgetStatus,
  BudgetThresholdAlert,
  Category,
  BerdeMemory,
  DashboardData,
} from './types';
import {
  isOperationalTransaction,
  isSpendAnalyticsTransaction,
} from './transaction-classification';

const BUDGET_ALERT_THRESHOLDS = [50, 80, 100] as const;

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function budgetLabel(budget: Pick<Budget, 'category' | 'subCategory'>): string {
  if (budget.subCategory) return `${budget.category} - ${budget.subCategory}`;
  return budget.category;
}

type Allocation = { category: Category; subCategory?: string; amount: number };

type ResolvedBudgetLimit = {
  baseLimit: number;
  incomeBoost: number;
  effectiveLimit: number;
  rolloverCarry: number;
};

function isIncomeTransaction(tx: Transaction): boolean {
  return tx.type === 'income' && !tx.transferGroupId;
}

function isExpenseTransaction(tx: Transaction): boolean {
  return tx.type === 'expense' && !tx.transferGroupId;
}

function getTransactionAllocations(tx: Transaction): Allocation[] {
  if (Array.isArray(tx.split) && tx.split.length > 0) {
    return tx.split.map((line) => ({
      category: line.category,
      subCategory: line.subCategory,
      amount: line.amount,
    }));
  }

  return [
    {
      category: tx.category,
      subCategory: tx.subCategory,
      amount: tx.amount,
    },
  ];
}

function getBudgetSpentForMonth(
  transactions: Transaction[],
  budget: Budget,
  month: string
): number {
  const monthTxs = transactions.filter(
    (tx) => tx.date.startsWith(month) && isExpenseTransaction(tx)
  );

  if (budget.category === 'Overall') {
    return roundMoney(sumTransactions(monthTxs));
  }

  let spent = 0;
  for (const tx of monthTxs) {
    for (const allocation of getTransactionAllocations(tx)) {
      if (allocation.category !== budget.category) continue;
      if (budget.subCategory && (allocation.subCategory || '') !== budget.subCategory) {
        continue;
      }
      spent += allocation.amount;
    }
  }

  return roundMoney(spent);
}

function getEffectiveBudgetLimit(
  budget: Budget,
  budgets: Budget[],
  transactions: Transaction[],
  memo: Map<string, ResolvedBudgetLimit> = new Map()
): ResolvedBudgetLimit {
  const key = `${budget.month}|${budget.category}|${budget.subCategory || ''}`;
  const cached = memo.get(key);
  if (cached) return cached;

  const incomeBoost = 0;

  const buildResolved = (baseLimit: number, rolloverCarry: number): ResolvedBudgetLimit => ({
    baseLimit: roundMoney(baseLimit),
    incomeBoost,
    effectiveLimit: roundMoney(baseLimit),
    rolloverCarry: roundMoney(rolloverCarry),
  });

  if (!budget.rollover) {
    const resolved = buildResolved(budget.monthlyLimit, 0);
    memo.set(key, resolved);
    return resolved;
  }

  const [year, month] = budget.month.split('-').map(Number);
  const previousMonth = format(subMonths(new Date(year, month - 1, 1), 1), 'yyyy-MM');
  const previousBudget = budgets.find(
    (candidate) =>
      candidate.month === previousMonth &&
      candidate.category === budget.category &&
      (candidate.subCategory || '') === (budget.subCategory || '')
  );

  if (!previousBudget) {
    const resolved = buildResolved(budget.monthlyLimit, 0);
    memo.set(key, resolved);
    return resolved;
  }

  const previousResolved = getEffectiveBudgetLimit(previousBudget, budgets, transactions, memo);
  const previousSpent = getBudgetSpentForMonth(transactions, previousBudget, previousMonth);
  const rolloverCarry = Math.max(0, previousResolved.baseLimit - previousSpent);

  const resolved = buildResolved(budget.monthlyLimit + rolloverCarry, rolloverCarry);
  memo.set(key, resolved);
  return resolved;
}

function getMonthTransactions(transactions: Transaction[], date: Date): Transaction[] {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return transactions.filter((t) => {
    const d = parseISO(t.date);
    return isWithinInterval(d, { start, end });
  });
}

function sumTransactions(txs: Transaction[]): number {
  return txs.reduce((sum, t) => sum + t.amount, 0);
}

function categorySum(txs: Transaction[]): Record<string, number> {
  const sums: Record<string, number> = {};
  for (const tx of txs) {
    for (const allocation of getTransactionAllocations(tx)) {
      sums[allocation.category] = (sums[allocation.category] || 0) + allocation.amount;
    }
  }
  return sums;
}

function safeParseDateValue(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const parsed = parseISO(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function buildUpcomingRecurringTransactions(
  transactions: Transaction[],
  now: Date = new Date(),
): Transaction[] {
  const start = startOfDay(now);
  const end = endOfDay(addDays(start, 14));

  return [...transactions]
    .filter((transaction) => Boolean(transaction.recurring))
    .filter((transaction) => !transaction.recurringOriginId)
    .filter((transaction) => !isOperationalTransaction(transaction))
    .filter((transaction) => {
      const dueDate = safeParseDateValue(transaction.recurring?.nextRunDate);
      const endDate = safeParseDateValue(transaction.recurring?.endDate);
      if (!dueDate) {
        return false;
      }

      if (endDate && startOfDay(dueDate).getTime() > endOfDay(endDate).getTime()) {
        return false;
      }

      const dueDay = startOfDay(dueDate);
      return dueDay.getTime() >= start.getTime() && dueDay.getTime() <= end.getTime();
    })
    .sort((left, right) => {
      const leftTime = safeParseDateValue(left.recurring?.nextRunDate)?.getTime() ?? 0;
      const rightTime = safeParseDateValue(right.recurring?.nextRunDate)?.getTime() ?? 0;
      return leftTime - rightTime;
    });
}

// Spending Spike Detection
export function detectSpendingSpikes(
  transactions: Transaction[],
  now: Date = new Date()
): Insight[] {
  const insights: Insight[] = [];
  const currentMonth = getMonthTransactions(transactions, now).filter(isExpenseTransaction);
  const lastMonth = getMonthTransactions(transactions, subMonths(now, 1)).filter(isExpenseTransaction);

  const currentCats = categorySum(currentMonth);
  const lastCats = categorySum(lastMonth);

  for (const [cat, amount] of Object.entries(currentCats)) {
    const prev = lastCats[cat] || 0;
    if (prev > 0) {
      const increase = ((amount - prev) / prev) * 100;
      const categoryTxCount = currentMonth.filter((tx) => tx.category === cat).length;
      if (categoryTxCount < 3 || amount < 300) continue;
      if (increase >= 30) {
        insights.push({
          id: uuidv4(),
          insightType: 'spending_spike',
          title: 'Spending spike detected',
          message: `${cat} spending increased by ${Math.round(increase)}% this month compared to last month.`,
          severity: increase >= 50 ? 'critical' : 'warning',
          category: cat as Category,
          createdAt: new Date().toISOString(),
          tier: 1,
          requiresTransactionCount: 5,
          dataPayload: {},
        });
      }
    }
  }

  return insights;
}

// Subscription Detection
export function detectSubscriptions(transactions: Transaction[]): Subscription[] {
  const subscriptions: Subscription[] = [];
  const grouped: Record<string, Transaction[]> = {};

  for (const tx of transactions.filter(isExpenseTransaction)) {
    const descriptor = (tx.merchant || tx.description || tx.notes || '').toLowerCase().trim();
    if (!descriptor) continue;
    const key = `${descriptor}_${tx.amount}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(tx);
  }

  for (const [, txs] of Object.entries(grouped)) {
    if (txs.length >= 2) {
      const sorted = txs.sort(
        (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()
      );
      const gaps: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        gaps.push(
          differenceInDays(parseISO(sorted[i].date), parseISO(sorted[i - 1].date))
        );
      }
      const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

      let billingCycle: 'weekly' | 'monthly' | 'yearly' = 'monthly';
      if (avgGap < 10) billingCycle = 'weekly';
      else if (avgGap > 300) billingCycle = 'yearly';

      if (avgGap >= 5 && avgGap <= 400) {
        const name = txs[0].merchant || txs[0].description || txs[0].notes || txs[0].category;
        subscriptions.push({
          id: uuidv4(),
          name,
          amount: txs[0].amount,
          billingCycle,
          lastDetected: sorted[sorted.length - 1].date,
          category: txs[0].category,
        });
      }
    }
  }

  return subscriptions;
}

// Budget Status Calculation
export function calculateBudgetStatuses(
  transactions: Transaction[],
  budgets: Budget[],
  now: Date = new Date()
): BudgetStatus[] {
  const monthStr = format(now, 'yyyy-MM');
  const dayOfMonth = now.getDate();
  const daysInMonth = endOfMonth(now).getDate();
  const rolloverMemo = new Map<string, ResolvedBudgetLimit>();

  const statuses: BudgetStatus[] = [];

  for (const budget of budgets) {
    if (budget.month !== monthStr) continue;

    const spent = getBudgetSpentForMonth(transactions, budget, monthStr);
    const { baseLimit, incomeBoost, effectiveLimit, rolloverCarry } = getEffectiveBudgetLimit(
      budget,
      budgets,
      transactions,
      rolloverMemo
    );
    const remaining = roundMoney(effectiveLimit - spent);
    const percentage = effectiveLimit > 0 ? (spent / effectiveLimit) * 100 : 0;
    const projectedSpent = dayOfMonth > 0 ? (spent / dayOfMonth) * daysInMonth : 0;
    const projectedOverage = Math.max(0, projectedSpent - effectiveLimit);

    let status: 'safe' | 'warning' | 'critical' = 'safe';
    if (percentage >= 100) status = 'critical';
    else if (percentage >= 80) status = 'warning';

    statuses.push({
      budgetId: budget.id,
      category: budget.category,
      subCategory: budget.subCategory,
      baseLimit,
      limit: baseLimit,
      incomeBoost,
      effectiveLimit,
      rolloverCarry,
      spent,
      remaining,
      percentage,
      projectedSpent: roundMoney(projectedSpent),
      projectedOverage: roundMoney(projectedOverage),
      status,
    });
  }

  return statuses;
}

// Budget Risk Prediction
export function predictBudgetRisk(
  transactions: Transaction[],
  budgets: Budget[],
  now: Date = new Date()
): Insight[] {
  const insights: Insight[] = [];
  const statuses = calculateBudgetStatuses(transactions, budgets, now);

  for (const status of statuses) {
    if (status.projectedOverage > 0 && status.spent < status.effectiveLimit) {
      const label = status.subCategory
        ? `${status.category} - ${status.subCategory}`
        : status.category;
      insights.push({
        id: uuidv4(),
        insightType: 'budget_risk',
        title: 'Budget risk forecast',
        message: `At your current pace, ${label} may exceed budget by ₱${status.projectedOverage.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
        severity: status.projectedOverage > status.effectiveLimit * 0.2 ? 'critical' : 'warning',
        category: status.category === 'Overall' ? undefined : status.category,
        createdAt: new Date().toISOString(),
        tier: 1,
        requiresTransactionCount: 5,
        dataPayload: {},
      });
    }
  }

  return insights;
}

// Spending Pattern Analysis
export function analyzeSpendingPatterns(
  transactions: Transaction[],
  now: Date = new Date()
): Insight[] {
  const insights: Insight[] = [];
  const monthTxs = getMonthTransactions(transactions, now).filter(isExpenseTransaction);
  const totalSpend = monthTxs.reduce((sum, tx) => sum + tx.amount, 0);
  if (monthTxs.length < 5 || totalSpend < 500) {
    return insights;
  }

  // Day-of-week analysis
  const dayTotals: Record<string, number> = {};
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (const tx of monthTxs) {
    const day = dayNames[parseISO(tx.date).getDay()];
    dayTotals[day] = (dayTotals[day] || 0) + tx.amount;
  }

  const maxDay = Object.entries(dayTotals).sort((a, b) => b[1] - a[1])[0];
  if (maxDay && maxDay[1] > 0) {
    insights.push({
      id: uuidv4(),
      insightType: 'pattern',
      title: 'Spending pattern',
      message: `You spend most of your money on ${maxDay[0]}s.`,
      severity: 'info',
      createdAt: new Date().toISOString(),
      tier: 1,
      requiresTransactionCount: 5,
      dataPayload: {},
    });
  }

  return insights;
}

export function generateBudgetBurnRate(
  transactions: Transaction[],
  budgets: Budget[],
  now: Date
): Insight[] {
  const currentMonth = format(now, 'yyyy-MM');
  const overallBudget = budgets.find(
    (budget) => budget.category === 'Overall' && budget.month === currentMonth && !budget.subCategory
  );

  if (!overallBudget) {
    return [];
  }

  const effectiveLimit = getEffectiveBudgetLimit(overallBudget, budgets, transactions).effectiveLimit;
  const monthExpenses = transactions.filter(
    (tx) => tx.date.startsWith(currentMonth) && isExpenseTransaction(tx)
  );
  const totalSpent = roundMoney(sumTransactions(monthExpenses));
  const remaining = roundMoney(effectiveLimit - totalSpent);
  const daysElapsed = Math.max(1, now.getDate());
  const daysInMonth = endOfMonth(now).getDate();
  const daysLeft = Math.max(0, daysInMonth - daysElapsed);
  const dailyAverage = roundMoney(daysElapsed > 0 ? totalSpent / daysElapsed : 0);
  const daysUntilEmpty =
    dailyAverage > 0 ? Math.floor(remaining / dailyAverage) : daysLeft;

  let state: 'safe' | 'tight' | 'at_risk' = 'safe';
  if (daysUntilEmpty > daysLeft) {
    state = 'safe';
  } else if (daysUntilEmpty >= daysLeft - 5 && daysUntilEmpty <= daysLeft) {
    state = 'tight';
  } else {
    state = 'at_risk';
  }

  const message =
    state === 'safe'
      ? "You're on track — your budget covers the rest of the month."
      : state === 'tight'
        ? 'Cutting it close — your budget runs out around the same time as the month.'
        : `At your current pace, your budget runs out in ${daysUntilEmpty} days — ${daysLeft} days remain.`;

  return [
    {
      id: uuidv4(),
      insightType: 'budget_burn_rate',
      title: 'Budget burn rate',
      message,
      severity: state === 'safe' ? 'info' : state === 'tight' ? 'warning' : 'critical',
      createdAt: new Date().toISOString(),
      tier: 1,
      requiresTransactionCount: 3,
      dataPayload: {
        daysUntilEmpty,
        daysLeft,
        dailyAverage,
        remaining,
        state,
      },
    },
  ];
}

export function generateBiggestExpense(
  transactions: Transaction[],
  now: Date
): Insight[] {
  const currentMonth = format(now, 'yyyy-MM');
  const monthExpenses = transactions.filter(
    (tx) => tx.date.startsWith(currentMonth) && isExpenseTransaction(tx)
  );

  if (monthExpenses.length < 3) {
    return [];
  }

  const biggest = monthExpenses.reduce((max, tx) => (tx.amount > max.amount ? tx : max));
  const amount = roundMoney(biggest.amount);
  const formattedDate = format(parseISO(biggest.date), 'MMM d, yyyy');
  const description = biggest.description?.trim();

  return [
    {
      id: uuidv4(),
      insightType: 'biggest_expense',
      title: 'Biggest expense this month',
      message: `Your largest expense was ₱${amount.toFixed(2)} on ${biggest.category}${description ? ` (${description})` : ''} on ${formattedDate}.`,
      severity: 'info',
      category: biggest.category,
      createdAt: new Date().toISOString(),
      tier: 1,
      requiresTransactionCount: 3,
      dataPayload: {
        amount,
        category: biggest.category,
        date: biggest.date,
        description,
      },
    },
  ];
}

export function generateCategoryConcentration(
  transactions: Transaction[],
  now: Date
): Insight[] {
  const currentMonth = format(now, 'yyyy-MM');
  const monthExpenses = transactions.filter(
    (tx) => tx.date.startsWith(currentMonth) && isExpenseTransaction(tx)
  );

  if (monthExpenses.length < 5) {
    return [];
  }

  const totalSpent = roundMoney(sumTransactions(monthExpenses));
  if (totalSpent <= 0) {
    return [];
  }

  const categoryBreakdown = categorySum(monthExpenses);
  const topEntry = Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1])[0];
  if (!topEntry) {
    return [];
  }

  const [topCategory, rawTopAmount] = topEntry;
  const topAmount = roundMoney(rawTopAmount);
  const percentage = (topAmount / totalSpent) * 100;

  if (percentage < 40) {
    return [];
  }

  const normalizedBreakdown = Object.fromEntries(
    Object.entries(categoryBreakdown).map(([category, amount]) => [category, roundMoney(amount)])
  );

  return [
    {
      id: uuidv4(),
      insightType: 'category_concentration',
      title: 'Spending concentration',
      message: `${topCategory} makes up ${percentage.toFixed(0)}% of your spending this month — ₱${topAmount.toFixed(2)} of ₱${totalSpent.toFixed(2)}.`,
      severity: percentage < 50 ? 'info' : 'warning',
      category: topCategory as Category,
      createdAt: new Date().toISOString(),
      tier: 1,
      requiresTransactionCount: 5,
      dataPayload: {
        topCategory,
        topAmount,
        totalSpent,
        percentage,
        categoryBreakdown: normalizedBreakdown,
      },
    },
  ];
}

export function generateWeekComparison(
  transactions: Transaction[],
  now: Date
): Insight[] {
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const thisWeekEnd = now;
  const lastWeekStart = subWeeks(thisWeekStart, 1);
  const lastWeekEnd = subDays(thisWeekStart, 1);

  const monthExpenses = transactions.filter(isExpenseTransaction);

  const thisWeekTxs = monthExpenses.filter((tx) => {
    const date = parseISO(tx.date);
    return date >= thisWeekStart && date <= thisWeekEnd;
  });

  const lastWeekTxs = monthExpenses.filter((tx) => {
    const date = parseISO(tx.date);
    return date >= lastWeekStart && date <= lastWeekEnd;
  });

  const thisWeekTotal = roundMoney(sumTransactions(thisWeekTxs));
  const lastWeekTotal = roundMoney(sumTransactions(lastWeekTxs));
  if (lastWeekTotal === 0) {
    return [];
  }

  const delta = roundMoney(thisWeekTotal - lastWeekTotal);
  const percentChange = (delta / lastWeekTotal) * 100;

  const thisByCategory = categorySum(thisWeekTxs);
  const lastByCategory = categorySum(lastWeekTxs);
  const allCategories = new Set<string>([
    ...Object.keys(thisByCategory),
    ...Object.keys(lastByCategory),
  ]);

  let topDeltaCategory = 'Uncategorized';
  let maxCategoryDelta = 0;
  for (const category of allCategories) {
    const categoryDelta = (thisByCategory[category] || 0) - (lastByCategory[category] || 0);
    if (Math.abs(categoryDelta) > Math.abs(maxCategoryDelta)) {
      maxCategoryDelta = categoryDelta;
      topDeltaCategory = category;
    }
  }

  const message =
    delta <= 0
      ? `You've spent ₱${Math.abs(delta).toFixed(2)} less than last week — down ${Math.abs(percentChange).toFixed(0)}%.`
      : `Spending is up ₱${delta.toFixed(2)} vs last week (+${percentChange.toFixed(0)}%). ${topDeltaCategory} drove most of the change.`;

  const severity: Insight['severity'] =
    delta <= 0 ? 'info' : percentChange < 50 ? 'warning' : 'critical';

  return [
    {
      id: uuidv4(),
      insightType: 'week_comparison',
      title: 'Week over week',
      message,
      severity,
      createdAt: new Date().toISOString(),
      tier: 2,
      requiresTransactionCount: 15,
      dataPayload: {
        thisWeekTotal,
        lastWeekTotal,
        delta,
        percentChange,
        topDeltaCategory,
      },
    },
  ];
}

export function generateNoSpendDays(
  transactions: Transaction[],
  now: Date
): Insight[] {
  const currentMonth = format(now, 'yyyy-MM');
  const monthExpenses = transactions.filter(
    (tx) => tx.date.startsWith(currentMonth) && isExpenseTransaction(tx)
  );
  const daysElapsed = Math.max(1, now.getDate());
  const daysWithSpend = new Set(
    monthExpenses.map((tx) => tx.date.substring(0, 10))
  );

  let noSpendCount = 0;
  for (let day = 1; day <= daysElapsed; day++) {
    const dayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (!daysWithSpend.has(dayDate)) {
      noSpendCount += 1;
    }
  }

  return [
    {
      id: uuidv4(),
      insightType: 'no_spend_days',
      title: 'No-spend days',
      message: `You've had ${noSpendCount} no-spend day${noSpendCount !== 1 ? 's' : ''} out of ${daysElapsed} days this month.`,
      severity: 'info',
      createdAt: new Date().toISOString(),
      tier: 2,
      requiresTransactionCount: 10,
      dataPayload: {
        noSpendCount,
        daysElapsed,
        noSpendRate: noSpendCount / daysElapsed,
      },
    },
  ];
}

export function generateEssentialsRatio(
  transactions: Transaction[],
  now: Date
): Insight[] {
  const currentMonth = format(now, 'yyyy-MM');
  const essentials = new Set<Category>(['Food', 'Transportation', 'Utilities', 'Health']);
  const monthExpenses = transactions.filter(
    (tx) => tx.date.startsWith(currentMonth) && isExpenseTransaction(tx)
  );

  if (monthExpenses.length < 10) {
    return [];
  }

  const overallTotal = roundMoney(sumTransactions(monthExpenses));
  if (overallTotal <= 0) {
    return [];
  }

  const essentialsTotal = roundMoney(
    monthExpenses
      .filter((tx) => essentials.has(tx.category))
      .reduce((sum, tx) => sum + tx.amount, 0)
  );
  const discretionaryTotal = roundMoney(overallTotal - essentialsTotal);
  const essentialsPercent = (essentialsTotal / overallTotal) * 100;

  const discretionaryTail =
    discretionaryTotal > 0 ? ` ₱${discretionaryTotal.toFixed(2)} is discretionary.` : '';

  return [
    {
      id: uuidv4(),
      insightType: 'essentials_ratio',
      title: 'Essentials vs discretionary',
      message: `${essentialsPercent.toFixed(0)}% of your spending goes to essentials (food, transport, utilities, health).${discretionaryTail}`,
      severity: essentialsPercent <= 70 ? 'info' : 'warning',
      createdAt: new Date().toISOString(),
      tier: 2,
      requiresTransactionCount: 10,
      dataPayload: {
        essentialsTotal,
        discretionaryTotal,
        essentialsPercent,
        overallTotal,
      },
    },
  ];
}

export function generateAvgTransactionSize(
  transactions: Transaction[],
  now: Date
): Insight[] {
  const currentMonth = format(now, 'yyyy-MM');
  const monthExpenses = transactions.filter(
    (tx) => tx.date.startsWith(currentMonth) && isExpenseTransaction(tx)
  );

  if (monthExpenses.length < 10) {
    return [];
  }

  const count = monthExpenses.length;
  const total = roundMoney(sumTransactions(monthExpenses));
  const avgAmount = roundMoney(total / count);
  const largeCount = monthExpenses.filter((tx) => tx.amount > avgAmount * 2).length;

  const suffix =
    largeCount > 0
      ? ` ${largeCount} transaction${largeCount > 1 ? 's were' : ' was'} more than double that — worth reviewing.`
      : '';

  return [
    {
      id: uuidv4(),
      insightType: 'avg_transaction_size',
      title: 'Average transaction size',
      message: `Your average expense is ₱${avgAmount.toFixed(2)} this month.${suffix}`,
      severity: 'info',
      createdAt: new Date().toISOString(),
      tier: 2,
      requiresTransactionCount: 10,
      dataPayload: {
        avgAmount,
        count,
        largeCount,
      },
    },
  ];
}

export function generatePaymentMethodSplit(
  transactions: Transaction[],
  now: Date
): Insight[] {
  const currentMonth = format(now, 'yyyy-MM');
  const monthExpenses = transactions.filter(
    (tx) => tx.date.startsWith(currentMonth) && isExpenseTransaction(tx)
  );

  if (monthExpenses.length < 10) {
    return [];
  }

  const totalSpent = roundMoney(sumTransactions(monthExpenses));
  if (totalSpent <= 0) {
    return [];
  }

  const methodTotals: Record<string, number> = {};
  for (const tx of monthExpenses) {
    methodTotals[tx.paymentMethod] = (methodTotals[tx.paymentMethod] || 0) + tx.amount;
  }

  const split: Record<string, { amount: number; percent: number }> = {};
  for (const [method, amount] of Object.entries(methodTotals)) {
    const normalizedAmount = roundMoney(amount);
    split[method] = {
      amount: normalizedAmount,
      percent: (normalizedAmount / totalSpent) * 100,
    };
  }

  const topEntry = Object.entries(split).sort((a, b) => b[1].percent - a[1].percent)[0];
  if (!topEntry) {
    return [];
  }

  const [topMethod, topSummary] = topEntry;
  const topPercent = topSummary.percent;

  return [
    {
      id: uuidv4(),
      insightType: 'payment_method_split',
      title: 'Payment method breakdown',
      message: `${topMethod} accounts for ${topPercent.toFixed(0)}% of your spending this month.`,
      severity: 'info',
      createdAt: new Date().toISOString(),
      tier: 2,
      requiresTransactionCount: 10,
      dataPayload: {
        split,
        topMethod,
        topPercent,
      },
    },
  ];
}

export function generateWeekendVsWeekday(
  transactions: Transaction[],
  now: Date
): Insight[] {
  const currentMonth = format(now, 'yyyy-MM');
  const monthExpenses = transactions.filter(
    (tx) => tx.date.startsWith(currentMonth) && isExpenseTransaction(tx)
  );

  if (monthExpenses.length < 15) {
    return [];
  }

  const weekendTotal = roundMoney(
    monthExpenses
      .filter((tx) => {
        const day = parseISO(tx.date).getDay();
        return day === 0 || day === 6;
      })
      .reduce((sum, tx) => sum + tx.amount, 0)
  );

  const weekdayTotal = roundMoney(
    monthExpenses
      .filter((tx) => {
        const day = parseISO(tx.date).getDay();
        return day !== 0 && day !== 6;
      })
      .reduce((sum, tx) => sum + tx.amount, 0)
  );

  let weekendDays = 0;
  let weekdayDays = 0;
  const daysElapsed = Math.max(1, now.getDate());
  for (let day = 1; day <= daysElapsed; day++) {
    const dayOfWeek = new Date(now.getFullYear(), now.getMonth(), day).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekendDays += 1;
    } else {
      weekdayDays += 1;
    }
  }

  const weekendDailyAvg = roundMoney(weekendDays > 0 ? weekendTotal / weekendDays : 0);
  const weekdayDailyAvg = roundMoney(weekdayDays > 0 ? weekdayTotal / weekdayDays : 0);

  const message =
    weekendDailyAvg > weekdayDailyAvg
      ? `You spend ₱${(weekendDailyAvg - weekdayDailyAvg).toFixed(2)} more per day on weekends than weekdays.`
      : `Your weekday spending (₱${weekdayDailyAvg.toFixed(2)}/day) is actually higher than weekends.`;

  return [
    {
      id: uuidv4(),
      insightType: 'weekend_vs_weekday',
      title: 'Weekend vs weekday spending',
      message,
      severity: 'info',
      createdAt: new Date().toISOString(),
      tier: 2,
      requiresTransactionCount: 15,
      dataPayload: {
        weekendTotal,
        weekdayTotal,
        weekendDailyAvg,
        weekdayDailyAvg,
        weekendDays,
        weekdayDays,
      },
    },
  ];
}

export function generateCategoryDrift(
  transactions: Transaction[],
  now: Date
): Insight[] {
  const currentMonth = format(now, 'yyyy-MM');
  const previousMonth = format(subMonths(now, 1), 'yyyy-MM');

  const currentExpenses = transactions.filter(
    (tx) => tx.date.startsWith(currentMonth) && isExpenseTransaction(tx)
  );
  const previousExpenses = transactions.filter(
    (tx) => tx.date.startsWith(previousMonth) && isExpenseTransaction(tx)
  );

  const currentByCategory = categorySum(currentExpenses);
  const previousByCategory = categorySum(previousExpenses);
  const candidates: Array<{
    category: string;
    currentAmount: number;
    previousAmount: number;
    delta: number;
    percentChange: number;
  }> = [];

  const categories = new Set<string>([
    ...Object.keys(currentByCategory),
    ...Object.keys(previousByCategory),
  ]);

  for (const category of categories) {
    const currentAmount = roundMoney(currentByCategory[category] || 0);
    const previousAmount = roundMoney(previousByCategory[category] || 0);
    if (previousAmount <= 0) continue;

    const delta = roundMoney(currentAmount - previousAmount);
    const percentChange = (delta / previousAmount) * 100;
    if (delta >= 200 && percentChange >= 20) {
      candidates.push({
        category,
        currentAmount,
        previousAmount,
        delta,
        percentChange,
      });
    }
  }

  if (candidates.length === 0) {
    return [];
  }

  return candidates
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 2)
    .map((candidate) => ({
      id: uuidv4(),
      insightType: 'category_drift' as const,
      title: 'Spending shift',
      message: `${candidate.category} spending is up ₱${candidate.delta.toFixed(2)} vs last month (+${candidate.percentChange.toFixed(0)}%).`,
      severity: candidate.percentChange >= 50 ? 'warning' : 'info',
      category: candidate.category as Category,
      createdAt: new Date().toISOString(),
      tier: 3 as const,
      requiresTransactionCount: 30 as const,
      dataPayload: {
        category: candidate.category,
        currentAmount: candidate.currentAmount,
        previousAmount: candidate.previousAmount,
        delta: candidate.delta,
        percentChange: candidate.percentChange,
      },
    }));
}

export function generateMonthEndProjection(
  transactions: Transaction[],
  budgets: Budget[],
  now: Date
): Insight[] {
  const currentMonth = format(now, 'yyyy-MM');
  const overallBudget = budgets.find(
    (budget) => budget.category === 'Overall' && budget.month === currentMonth && !budget.subCategory
  );

  if (!overallBudget) {
    return [];
  }

  const effectiveLimit = getEffectiveBudgetLimit(overallBudget, budgets, transactions).effectiveLimit;
  const monthExpenses = transactions.filter(
    (tx) => tx.date.startsWith(currentMonth) && isExpenseTransaction(tx)
  );
  const totalSpent = roundMoney(sumTransactions(monthExpenses));
  const daysElapsed = Math.max(1, now.getDate());
  const daysInMonth = endOfMonth(now).getDate();
  const dailyRate = roundMoney(daysElapsed > 0 ? totalSpent / daysElapsed : 0);
  const projectedTotal = roundMoney(dailyRate * daysInMonth);
  const projectedRemaining = roundMoney(effectiveLimit - projectedTotal);

  const severity: Insight['severity'] =
    projectedRemaining >= 0 ? 'info' : projectedRemaining > -500 ? 'warning' : 'critical';

  const message =
    projectedRemaining >= 0
      ? `At your current pace, you'll end the month with ₱${projectedRemaining.toFixed(2)} to spare.`
      : `You're on track to overshoot your budget by ₱${Math.abs(projectedRemaining).toFixed(2)} by month end.`;

  return [
    {
      id: uuidv4(),
      insightType: 'month_end_projection',
      title: 'Month-end projection',
      message,
      severity,
      createdAt: new Date().toISOString(),
      tier: 3,
      requiresTransactionCount: 20,
      dataPayload: {
        projectedTotal,
        projectedRemaining,
        dailyRate,
        daysLeft: Math.max(0, daysInMonth - daysElapsed),
      },
    },
  ];
}

export function generateSubscriptionCreep(
  transactions: Transaction[],
  now: Date
): Insight[] {
  const subscriptions = detectSubscriptions(transactions);
  if (subscriptions.length === 0) {
    return [];
  }

  const currentMonth = format(now, 'yyyy-MM');
  const compareMonth = format(subMonths(now, 3), 'yyyy-MM');
  const monthMinusOne = format(subMonths(now, 1), 'yyyy-MM');
  const monthMinusTwo = format(subMonths(now, 2), 'yyyy-MM');
  const monthMinusThree = format(subMonths(now, 3), 'yyyy-MM');

  const expenseTxs = transactions.filter(isExpenseTransaction);
  const normalizeText = (value: string): string => value.toLowerCase().trim();
  const descriptor = (tx: Transaction): string =>
    normalizeText(tx.merchant || tx.description || tx.notes || tx.category);

  const isMatch = (tx: Transaction, name: string, amount: number, category: Category): boolean => {
    const byName = descriptor(tx) === normalizeText(name);
    const byCategory = tx.category === category;
    const byAmount = Math.abs(tx.amount - amount) < 0.01;
    return byAmount && (byName || byCategory);
  };

  const stableSubs = subscriptions.filter((sub) => {
    const hasMonthOne = expenseTxs.some(
      (tx) => tx.date.startsWith(monthMinusOne) && isMatch(tx, sub.name, sub.amount, sub.category)
    );
    const hasMonthTwo = expenseTxs.some(
      (tx) => tx.date.startsWith(monthMinusTwo) && isMatch(tx, sub.name, sub.amount, sub.category)
    );
    const hasMonthThree = expenseTxs.some(
      (tx) => tx.date.startsWith(monthMinusThree) && isMatch(tx, sub.name, sub.amount, sub.category)
    );
    return hasMonthOne && hasMonthTwo && hasMonthThree;
  });

  if (stableSubs.length === 0) {
    return [];
  }

  const currentSubTotal = roundMoney(
    expenseTxs
      .filter(
        (tx) =>
          tx.date.startsWith(currentMonth) &&
          stableSubs.some((sub) => isMatch(tx, sub.name, sub.amount, sub.category))
      )
      .reduce((sum, tx) => sum + tx.amount, 0)
  );

  const previousSubTotal = roundMoney(
    expenseTxs
      .filter(
        (tx) =>
          tx.date.startsWith(compareMonth) &&
          stableSubs.some((sub) => isMatch(tx, sub.name, sub.amount, sub.category))
      )
      .reduce((sum, tx) => sum + tx.amount, 0)
  );

  const delta = roundMoney(currentSubTotal - previousSubTotal);
  if (delta < 100) {
    return [];
  }

  return [
    {
      id: uuidv4(),
      insightType: 'subscription_creep',
      title: 'Subscription creep',
      message: `Your recurring costs have grown by ₱${delta.toFixed(2)} over the last 3 months.`,
      severity: 'warning',
      createdAt: new Date().toISOString(),
      tier: 3,
      requiresTransactionCount: 30,
      dataPayload: {
        currentSubTotal,
        previousSubTotal,
        delta,
      },
    },
  ];
}

export function generateSavingsRateTrend(
  transactions: Transaction[],
  budgets: Budget[]
): Insight[] {
  const history = computeMonthlySavingsHistory(transactions, budgets);
  if (history.length < 3) {
    return [];
  }

  const lastThree = history.slice(-3);
  if (lastThree.length < 3) {
    return [];
  }

  const monthlyRates = lastThree.map((item) => {
    const monthTransactions = transactions.filter((tx) => tx.date.startsWith(item.month));
    const income = roundMoney(
      monthTransactions
        .filter(isIncomeTransaction)
        .reduce((sum, tx) => sum + tx.amount, 0)
    );
    const expenses = roundMoney(
      monthTransactions
        .filter(isExpenseTransaction)
        .reduce((sum, tx) => sum + tx.amount, 0)
    );
    const rate = income > 0 ? ((income - expenses) / income) * 100 : 0;
    return {
      month: item.month,
      rate,
    };
  });

  const firstRate = monthlyRates[0].rate;
  const latestRate = monthlyRates[monthlyRates.length - 1].rate;
  const change = latestRate - firstRate;
  const avgRate = monthlyRates.reduce((sum, item) => sum + item.rate, 0) / monthlyRates.length;

  const trend: 'improving' | 'declining' | 'stable' =
    Math.abs(change) < 5 ? 'stable' : change > 0 ? 'improving' : 'declining';

  const message =
    trend === 'improving'
      ? 'Your savings rate has improved over the last 3 months. Keep it up.'
      : trend === 'declining'
        ? `Your savings rate has been declining. You saved ${latestRate.toFixed(0)}% of income last month.`
        : `Your savings rate has been consistent at around ${avgRate.toFixed(0)}% over the last 3 months.`;

  return [
    {
      id: uuidv4(),
      insightType: 'savings_rate_trend',
      title: 'Savings rate trend',
      message,
      severity: trend === 'declining' ? 'warning' : 'info',
      createdAt: new Date().toISOString(),
      tier: 3,
      requiresTransactionCount: 30,
      dataPayload: {
        monthlyRates,
        trend,
        avgRate,
      },
    },
  ];
}

export function generatePostIncomeBehavior(
  transactions: Transaction[],
  now: Date
): Insight[] {
  const currentMonth = format(now, 'yyyy-MM');
  const incomeTransactions = transactions.filter(
    (tx) => tx.date.startsWith(currentMonth) && isIncomeTransaction(tx)
  );

  if (incomeTransactions.length === 0) {
    return [];
  }

  const expenseTransactions = transactions.filter(
    (tx) => tx.date.startsWith(currentMonth) && isExpenseTransaction(tx)
  );
  const daysElapsed = Math.max(1, now.getDate());
  const totalExpenses = roundMoney(sumTransactions(expenseTransactions));
  const dailyAvg = roundMoney(daysElapsed > 0 ? totalExpenses / daysElapsed : 0);
  if (dailyAvg <= 0) {
    return [];
  }

  const windowDates = new Set<string>();
  for (const income of incomeTransactions) {
    const incomeDate = parseISO(income.date);
    for (let offset = 1; offset <= 3; offset++) {
      const windowDate = addDays(incomeDate, offset);
      if (format(windowDate, 'yyyy-MM') !== currentMonth) continue;
      windowDates.add(format(windowDate, 'yyyy-MM-dd'));
    }
  }

  const windowDays = windowDates.size;
  if (windowDays === 0) {
    return [];
  }

  const postIncomeSpend = roundMoney(
    expenseTransactions
      .filter((tx) => windowDates.has(tx.date.slice(0, 10)))
      .reduce((sum, tx) => sum + tx.amount, 0)
  );
  const postIncomeDailyAvg = roundMoney(postIncomeSpend / windowDays);
  if (postIncomeDailyAvg <= dailyAvg * 1.3) {
    return [];
  }

  const multiplier = postIncomeDailyAvg / dailyAvg;

  return [
    {
      id: uuidv4(),
      insightType: 'post_income_behavior',
      title: 'Post-income spending',
      message: `You tend to spend ${((multiplier - 1) * 100).toFixed(0)}% more in the days after receiving money.`,
      severity: 'info',
      createdAt: new Date().toISOString(),
      tier: 3,
      requiresTransactionCount: 20,
      dataPayload: {
        postIncomeDailyAvg,
        dailyAvg,
        multiplier,
      },
    },
  ];
}

export function generateBestMonthReplay(
  transactions: Transaction[],
  now: Date
): Insight[] {
  const history = computeMonthlySavingsHistory(transactions, []);
  const currentMonth = format(now, 'yyyy-MM');

  const historicalMonths = history.filter((item) => item.month < currentMonth);
  if (historicalMonths.length < 2) {
    return [];
  }

  const qualified = historicalMonths.filter((item) => {
    const monthCount = transactions.filter(
      (tx) => tx.date.startsWith(item.month) && isExpenseTransaction(tx)
    ).length;
    return monthCount >= 5;
  });

  if (qualified.length === 0) {
    return [];
  }

  const bestMonth = qualified.reduce((best, item) => (item.spent < best.spent ? item : best));
  const bestMonthTotal = roundMoney(bestMonth.spent);

  const currentTotal = roundMoney(
    transactions
      .filter((tx) => tx.date.startsWith(currentMonth) && isExpenseTransaction(tx))
      .reduce((sum, tx) => sum + tx.amount, 0)
  );
  const daysInMonth = endOfMonth(now).getDate();
  const daysLeft = Math.max(0, daysInMonth - now.getDate());

  return [
    {
      id: uuidv4(),
      insightType: 'best_month_replay',
      title: 'Your best month',
      message: `${bestMonth.month} was your most efficient month — you spent ₱${bestMonthTotal.toFixed(2)} total. This month you're at ₱${currentTotal.toFixed(2)} with ${daysLeft} days to go.`,
      severity: 'info',
      createdAt: new Date().toISOString(),
      tier: 3,
      requiresTransactionCount: 30,
      dataPayload: {
        bestMonth: bestMonth.month,
        bestMonthTotal,
        currentTotal,
        daysLeft,
      },
    },
  ];
}

// Generate all insights
export function generateInsights(
  transactions: Transaction[],
  budgets: Budget[],
  now: Date = new Date()
): Insight[] {
  return [
    ...detectSpendingSpikes(transactions, now),
    ...predictBudgetRisk(transactions, budgets, now),
    ...analyzeSpendingPatterns(transactions, now),
    ...generateBudgetBurnRate(transactions, budgets, now),
    ...generateBiggestExpense(transactions, now),
    ...generateCategoryConcentration(transactions, now),
    ...generateWeekComparison(transactions, now),
    ...generateNoSpendDays(transactions, now),
    ...generateEssentialsRatio(transactions, now),
    ...generateAvgTransactionSize(transactions, now),
    ...generatePaymentMethodSplit(transactions, now),
    ...generateWeekendVsWeekday(transactions, now),
    ...generateCategoryDrift(transactions, now),
    ...generateMonthEndProjection(transactions, budgets, now),
    ...generateSubscriptionCreep(transactions, now),
    ...generateSavingsRateTrend(transactions, budgets),
    ...generatePostIncomeBehavior(transactions, now),
    ...generateBestMonthReplay(transactions, now),
  ];
}

// Generate subscription insights
export function generateSubscriptionInsights(subscriptions: Subscription[]): Insight[] {
  return subscriptions.map((sub) => ({
    id: uuidv4(),
    insightType: 'subscription' as const,
    title: 'Recurring subscription detected',
    message: `Recurring subscription detected: ${sub.name} (₱${sub.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/${sub.billingCycle}).`,
    severity: 'info' as const,
    category: sub.category,
    createdAt: new Date().toISOString(),
    tier: 1,
    requiresTransactionCount: 5,
    dataPayload: {},
  }));
}

function getRatioTrendDirection(
  currentValue: number,
  baselineValue: number,
  threshold = 0.1,
): BerdeMemory['spendTrend'] {
  if (!Number.isFinite(currentValue) || !Number.isFinite(baselineValue) || baselineValue <= 0) {
    return 'none';
  }

  const ratioDelta = (currentValue - baselineValue) / baselineValue;
  if (ratioDelta >= threshold) {
    return 'up';
  }
  if (ratioDelta <= -threshold) {
    return 'down';
  }

  return 'flat';
}

function getPointTrendDirection(
  currentValue: number,
  baselineValue: number,
  threshold = 5,
): BerdeMemory['savingsTrend'] {
  if (!Number.isFinite(currentValue) || !Number.isFinite(baselineValue)) {
    return 'none';
  }

  const pointDelta = currentValue - baselineValue;
  if (pointDelta >= threshold) {
    return 'up';
  }
  if (pointDelta <= -threshold) {
    return 'down';
  }

  return 'flat';
}

export function buildBerdeMemory(
  transactions: Transaction[],
  budgets: Budget[],
  now: Date = new Date(),
): BerdeMemory {
  const currentMonth = format(now, 'yyyy-MM');
  const previousMonthDate = subMonths(now, 1);
  const previousMonth = format(previousMonthDate, 'yyyy-MM');
  const priorMonth = format(subMonths(previousMonthDate, 1), 'yyyy-MM');

  const trackedTransactions = transactions.filter(
    (transaction) => !isOperationalTransaction(transaction),
  );
  const currentMonthTrackedTransactions = trackedTransactions.filter((transaction) =>
    transaction.date.startsWith(currentMonth),
  );
  const previousMonthTrackedTransactions = trackedTransactions.filter((transaction) =>
    transaction.date.startsWith(previousMonth),
  );

  const trackedMonthCount = new Set(
    trackedTransactions.map((transaction) => transaction.date.slice(0, 7)),
  ).size;

  const monthlySavingsHistory = computeMonthlySavingsHistory(transactions, budgets, now);
  const previousMonthSummary =
    monthlySavingsHistory.find((month) => month.month === previousMonth) ?? null;
  const priorMonthSummary = monthlySavingsHistory.find((month) => month.month === priorMonth) ?? null;
  const completedMonths = monthlySavingsHistory.filter((month) => month.month < currentMonth);

  let savingsStreakMonths = 0;
  for (let index = completedMonths.length - 1; index >= 0; index -= 1) {
    if (completedMonths[index].saved <= 0) {
      break;
    }
    savingsStreakMonths += 1;
  }

  const previousMonthSpent = previousMonthSummary?.spent ?? 0;
  const previousMonthSaved = previousMonthSummary?.saved ?? 0;
  const previousMonthSavingsRate = previousMonthSummary?.savingsRate ?? 0;
  const previousMonthBudget = previousMonthSummary?.budget ?? 0;
  const previousMonthTransactionCount = previousMonthTrackedTransactions.length;

  let previousMonthStatus: BerdeMemory['previousMonthStatus'] = 'none';
  if (previousMonthTransactionCount > 0 || previousMonthBudget > 0) {
    if (previousMonthBudget > 0 && previousMonthSpent > previousMonthBudget) {
      previousMonthStatus = 'overspent';
    } else if (previousMonthSaved > 0 || previousMonthSavingsRate >= 20) {
      previousMonthStatus = 'strong';
    } else {
      previousMonthStatus = 'steady';
    }
  }

  const last30Start = startOfDay(subDays(now, 29));
  const last90Start = startOfDay(subDays(now, 89));
  const endOfToday = endOfDay(now);

  const spendAnalyticsTransactions = transactions.filter(isSpendAnalyticsTransaction);
  const rolling30DaySpend = sumTransactions(
    spendAnalyticsTransactions.filter((transaction) => {
      const date = parseISO(transaction.date);
      return isWithinInterval(date, { start: last30Start, end: endOfToday });
    }),
  );

  const rolling90DaySpend = sumTransactions(
    spendAnalyticsTransactions.filter((transaction) => {
      const date = parseISO(transaction.date);
      return isWithinInterval(date, { start: last90Start, end: endOfToday });
    }),
  );

  const rolling90DayAverageSpend = rolling90DaySpend / 3;

  return {
    hasHistory:
      previousMonthTransactionCount > 0 ||
      trackedTransactions.length > currentMonthTrackedTransactions.length,
    isNewMonthWindow: now.getDate() <= 3,
    trackedMonthCount,
    lifetimeTransactionCount: trackedTransactions.length,
    previousMonth,
    previousMonthSpent,
    previousMonthSaved,
    previousMonthSavingsRate,
    previousMonthTransactionCount,
    previousMonthStatus,
    rolling30DaySpend,
    rolling90DayAverageSpend,
    spendTrend: getRatioTrendDirection(rolling30DaySpend, rolling90DayAverageSpend),
    savingsTrend:
      previousMonthSummary && priorMonthSummary
        ? getPointTrendDirection(previousMonthSavingsRate, priorMonthSummary.savingsRate)
        : 'none',
    savingsStreakMonths,
  };
}

export function buildCalendarHistory(
  transactions: Transaction[],
  now: Date = new Date(),
): Pick<DashboardData, 'calendarSpending' | 'calendarTransactions' | 'calendarRange'> {
  const calendarTransactions = [...transactions]
    .filter(isSpendAnalyticsTransaction)
    .sort((left, right) => parseISO(right.date).getTime() - parseISO(left.date).getTime());

  const currentMonth = format(now, 'yyyy-MM');
  const minMonth = calendarTransactions.reduce((earliest, transaction) => {
    const month = transaction.date.slice(0, 7);
    return month < earliest ? month : earliest;
  }, currentMonth);

  const calendarRange = {
    minMonth,
    maxMonth: currentMonth,
  };

  const totalsByDate = calendarTransactions.reduce<Map<string, number>>((totals, transaction) => {
    const dateKey = transaction.date.slice(0, 10);
    totals.set(dateKey, (totals.get(dateKey) ?? 0) + transaction.amount);
    return totals;
  }, new Map());

  const historyStart = startOfMonth(parseISO(`${calendarRange.minMonth}-01`));
  const historyEnd = endOfMonth(now);
  const calendarSpending = eachDayOfInterval({ start: historyStart, end: historyEnd }).map((day) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    return {
      date: dateKey,
      amount: roundMoney(totalsByDate.get(dateKey) ?? 0),
    };
  });

  return {
    calendarSpending,
    calendarTransactions,
    calendarRange,
  };
}

// Build Dashboard Data
export function buildDashboardData(
  transactions: Transaction[],
  budgets: Budget[],
  now: Date = new Date()
): DashboardData {
  const currentMonthTxs = getMonthTransactions(transactions, now);
  const lastMonthTxs = getMonthTransactions(transactions, subMonths(now, 1));
  const currentMonthIncomeTxs = currentMonthTxs.filter(isIncomeTransaction);
  const currentMonthExpenseTxs = currentMonthTxs.filter(isExpenseTransaction);
  const lastMonthExpenseTxs = lastMonthTxs.filter(isExpenseTransaction);

  const totalIncomeThisMonth = sumTransactions(currentMonthIncomeTxs);
  const totalSpentThisMonth = sumTransactions(currentMonthExpenseTxs);
  const totalSpentLastMonth = sumTransactions(lastMonthExpenseTxs);
  const netThisMonth = roundMoney(totalIncomeThisMonth - totalSpentThisMonth);

  const monthStr = format(now, 'yyyy-MM');
  const overallBudget = budgets.find(
    (b) => b.category === 'Overall' && b.month === monthStr && !b.subCategory
  );
  const monthlyBudget = overallBudget
    ? getEffectiveBudgetLimit(overallBudget, budgets, transactions).effectiveLimit
    : 0;
  const remainingBudget = Math.max(0, monthlyBudget - totalSpentThisMonth);

  const savingsRate =
    monthlyBudget > 0 ? ((monthlyBudget - totalSpentThisMonth) / monthlyBudget) * 100 : 0;

  const expenseGrowthRate =
    totalSpentLastMonth > 0
      ? ((totalSpentThisMonth - totalSpentLastMonth) / totalSpentLastMonth) * 100
      : 0;

  const budgetStatuses = calculateBudgetStatuses(transactions, budgets, now);
  const budgetById = new Map(budgets.map((budget) => [budget.id, budget]));

  const budgetAlerts: BudgetThresholdAlert[] = [];
  for (const status of budgetStatuses) {
    const budget = budgetById.get(status.budgetId);
    if (!budget) continue;
    const alreadyTriggered = budget.alertThresholdsTriggered || [];
    for (const threshold of BUDGET_ALERT_THRESHOLDS) {
      if (status.percentage >= threshold && !alreadyTriggered.includes(threshold)) {
        budgetAlerts.push({
          id: uuidv4(),
          budgetId: status.budgetId,
          month: monthStr,
          category: status.category,
          subCategory: status.subCategory,
          threshold,
          spent: status.spent,
          limit: status.effectiveLimit,
          percentage: status.percentage,
          message: `${budgetLabel(status)} reached ${threshold}% (₱${status.spent.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} of ₱${status.effectiveLimit.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`,
        });
      }
    }
  }

  const catBreakdown = categorySum(currentMonthExpenseTxs);
  const categoryBreakdown = Object.entries(catBreakdown)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Weekly spending
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 });
  const weeklySpending = weeks.map((weekStart, i) => {
    const weekEnd = i < weeks.length - 1 ? weeks[i + 1] : monthEnd;
    const weekTxs = currentMonthExpenseTxs.filter((t) => {
      const d = parseISO(t.date);
      return d >= weekStart && d < weekEnd;
    });
    return {
      week: `Week ${i + 1}`,
      amount: sumTransactions(weekTxs),
    };
  });

  // Daily spending for the last 7 days
  const days = eachDayOfInterval({
    start: subDays(now, 6),
    end: now,
  });

  const dailySpending = days.map((day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayTxs = transactions.filter(
      (t) => t.date.startsWith(dayStr) && isExpenseTransaction(t)
    );
    return {
      day: format(day, 'EEE'),
      amount: sumTransactions(dayTxs),
    };
  });

  const currentMonthTransactions = [...currentMonthTxs]
    .filter((transaction) => !isOperationalTransaction(transaction))
    .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());

  const upcomingRecurringTransactions = buildUpcomingRecurringTransactions(transactions, now);

  const recentTransactions = currentMonthTransactions
    .slice(0, 5);

  const { calendarSpending, calendarTransactions, calendarRange } = buildCalendarHistory(
    transactions,
    now,
  );

  const berdeMemory = buildBerdeMemory(transactions, budgets, now);

  const insights = generateInsights(transactions, budgets, now);

  return {
    totalIncomeThisMonth,
    totalSpentThisMonth,
    totalSpentLastMonth,
    netThisMonth,
    totalBalance: 0,
    remainingBudget,
    monthlyBudget,
    savingsRate,
    expenseGrowthRate,
    budgetStatuses,
    budgetAlerts,
    categoryBreakdown,
    weeklySpending,
    dailySpending,
    calendarSpending,
    calendarTransactions,
    calendarRange,
    currentMonthTransactions,
    upcomingRecurringTransactions,
    recentTransactions,
    insights,
    berdeMemory,
  };
}

export function mergeTriggeredBudgetThresholds(
  budgets: Budget[],
  alerts: BudgetThresholdAlert[]
): Budget[] {
  if (alerts.length === 0) return budgets;

  const alertMap = new Map<string, number[]>();
  for (const alert of alerts) {
    const current = alertMap.get(alert.budgetId) || [];
    current.push(alert.threshold);
    alertMap.set(alert.budgetId, current);
  }

  return budgets.map((budget) => {
    const incoming = alertMap.get(budget.id);
    if (!incoming || incoming.length === 0) return budget;

    const merged = Array.from(
      new Set([...(budget.alertThresholdsTriggered || []), ...incoming])
    ).sort((a, b) => a - b);

    return {
      ...budget,
      alertThresholdsTriggered: merged,
    };
  });
}

// Compute monthly savings history — covers every month from earliest data to today
export function computeMonthlySavingsHistory(
  transactions: Transaction[],
  budgets: Budget[],
  now: Date = new Date(),
): import('./types').MonthlySavings[] {
  // Determine earliest month from any transaction or Overall budget
  const seedMonths: string[] = [];
  for (const tx of transactions) seedMonths.push(tx.date.slice(0, 7));
  for (const b of budgets) if (b.category === 'Overall') seedMonths.push(b.month);
  if (seedMonths.length === 0) return [];

  const startMonth = seedMonths.sort()[0];
  const currentMonth = format(now, 'yyyy-MM');

  // Generate every calendar month from startMonth to currentMonth (inclusive)
  const months: string[] = [];
  let cursor = startMonth;
  while (cursor <= currentMonth) {
    months.push(cursor);
    const [y, m] = cursor.split('-').map(Number);
    cursor = format(addMonths(new Date(y, m - 1, 1), 1), 'yyyy-MM');
  }

  let cumulative = 0;
  const results: import('./types').MonthlySavings[] = [];

  for (const month of months) {
    const overallBudget = budgets.find(
      (b) => b.category === 'Overall' && b.month === month && !b.subCategory
    );
    const monthTxs = transactions.filter(
      (t) => t.date.startsWith(month) && isExpenseTransaction(t)
    );
    const spent = sumTransactions(monthTxs);
    const budget = overallBudget
      ? getEffectiveBudgetLimit(overallBudget, budgets, transactions).effectiveLimit
      : 0;
    const saved = budget > 0 ? Math.max(0, budget - spent) : 0;
    const savingsRate = budget > 0 ? (saved / budget) * 100 : 0;
    cumulative += saved;

    results.push({ month, budget, spent, saved, savingsRate, cumulative });
  }

  return results;
}

// Generate timeline events from transaction history
export function generateTimelineEvents(
  transactions: Transaction[],
  subscriptions: Subscription[],
  budgets: Budget[] = [],
  now: Date = new Date(),
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const trackedTransactions = transactions.filter((transaction) => !isOperationalTransaction(transaction));
  const expenseTransactions = trackedTransactions.filter(isExpenseTransaction);
  if (trackedTransactions.length === 0) return events;

  const peso = (n: number) => n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const monthLabel = (ym: string) => {
    const [y, m] = ym.split('-');
    return new Date(Number(y), Number(m) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  // ── 1. Started tracking ──────────────────────────────────────────────────
  const sorted = [...trackedTransactions].sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
  const firstTx = sorted[0];
  const firstTxLabel = firstTx.description || firstTx.notes || firstTx.merchant || firstTx.category;
  const firstTxKind = firstTx.type === 'income'
    ? 'income'
    : firstTx.type === 'savings'
      ? 'savings move'
      : 'expense';
  events.push({
    id: uuidv4(),
    eventType: 'started_tracking',
    description: 'Started tracking your finances',
    date: firstTx.date,
    metadata: { totalTransactions: trackedTransactions.length },
    context: `Your financial journey began with a ₱${peso(firstTx.amount)} ${firstTxKind} on ${format(parseISO(firstTx.date), 'MMMM d, yyyy')}${firstTxLabel ? ` — "${firstTxLabel}"` : ''}. You have recorded ${trackedTransactions.length} transaction${trackedTransactions.length !== 1 ? 's' : ''} since then.`,
    advice: 'Consistent tracking is the foundation of financial awareness. Keep it up!',
    severity: 'positive',
  });

  // ── 2. Subscriptions ─────────────────────────────────────────────────────
  for (const sub of subscriptions) {
    const annualCost = sub.billingCycle === 'yearly' ? sub.amount : sub.billingCycle === 'monthly' ? sub.amount * 12 : sub.amount * 52;
    events.push({
      id: uuidv4(),
      eventType: 'subscription_detected',
      description: `Recurring subscription: ${sub.name}`,
      date: sub.lastDetected,
      metadata: { subscription: sub },
      context: `A ${sub.billingCycle} recurring payment of ₱${peso(sub.amount)} was detected for "${sub.name}". This costs approximately ₱${peso(annualCost)} per year.`,
      advice: 'Review your subscriptions regularly. Cancel any you no longer use to free up budget.',
      link: '/transactions',
      severity: 'neutral',
      amount: sub.amount,
    });
  }

  // ── Build monthly summary data ───────────────────────────────────────────
  const allMonths = new Set<string>();
  for (const tx of expenseTransactions) allMonths.add(tx.date.slice(0, 7));
  for (const b of budgets) if (b.category === 'Overall') allMonths.add(b.month);
  const sortedMonths = Array.from(allMonths).sort();

  type MonthData = { month: string; spent: number; saved: number; budget: number; txs: Transaction[]; cats: Record<string, number> };
  const monthly: MonthData[] = sortedMonths.map(month => {
    const txs = expenseTransactions.filter(t => t.date.startsWith(month));
    const spent = sumTransactions(txs);
    const overallBudget = budgets.find(
      (b) => b.category === 'Overall' && b.month === month && !b.subCategory
    );
    const budget = overallBudget
      ? getEffectiveBudgetLimit(overallBudget, budgets, transactions).effectiveLimit
      : 0;
    const saved = budget > 0 ? Math.max(0, budget - spent) : 0;
    return { month, spent, saved, budget, txs, cats: categorySum(txs) };
  });

  const currentMonth = format(now, 'yyyy-MM');
  const currentMonthTransactions = trackedTransactions.filter((transaction) =>
    transaction.date.startsWith(currentMonth)
  );
  const currentMonthExpenseTransactions = currentMonthTransactions.filter(isExpenseTransaction);
  const currentMonthIncomeTransactions = currentMonthTransactions.filter(isIncomeTransaction);
  const currentMonthSpent = roundMoney(sumTransactions(currentMonthExpenseTransactions));
  const currentMonthIncome = roundMoney(sumTransactions(currentMonthIncomeTransactions));
  const currentDaysElapsed = Math.max(1, now.getDate());
  const currentDaysInMonth = endOfMonth(now).getDate();
  const projectedSpent = roundMoney(
    currentMonthSpent > 0
      ? (currentMonthSpent / currentDaysElapsed) * currentDaysInMonth
      : 0,
  );
  const overallBudget = budgets.find(
    (budget) => budget.category === 'Overall' && budget.month === currentMonth && !budget.subCategory
  );
  const currentMonthBudget = overallBudget
    ? getEffectiveBudgetLimit(overallBudget, budgets, transactions).effectiveLimit
    : 0;

  if (currentMonthIncomeTransactions.length > 0) {
    const latestIncome = [...currentMonthIncomeTransactions].sort(
      (left, right) => parseISO(right.date).getTime() - parseISO(left.date).getTime()
    )[0];
    const currentNet = roundMoney(currentMonthIncome - currentMonthSpent);
    const savingsRate = currentMonthIncome > 0
      ? roundMoney(((currentMonthIncome - currentMonthSpent) / currentMonthIncome) * 100)
      : 0;

    events.push({
      id: uuidv4(),
      eventType: 'income_logged',
      description: `Income logged in ${monthLabel(currentMonth)}`,
      date: latestIncome.date,
      metadata: {
        month: currentMonth,
        income: currentMonthIncome,
        expense: currentMonthSpent,
        savingsRate,
      },
      context: `You recorded ₱${peso(currentMonthIncome)} of income in ${monthLabel(currentMonth)} across ${currentMonthIncomeTransactions.length} entr${currentMonthIncomeTransactions.length === 1 ? 'y' : 'ies'}. Current spending is ₱${peso(currentMonthSpent)}, leaving ${currentNet >= 0 ? `₱${peso(currentNet)} available` : `a ₱${peso(Math.abs(currentNet))} shortfall`}.`,
      advice: currentNet >= 0
        ? 'Protect part of that inflow early so the month keeps its momentum.'
        : 'Spending is already outpacing what came in this month. Review the largest categories before it compounds.',
      link: `/transactions?month=${currentMonth}`,
      severity: currentNet >= 0 ? 'positive' : 'warning',
      amount: currentMonthIncome,
    });
  }

  if (currentDaysElapsed >= 4 && currentMonthExpenseTransactions.length >= 3) {
    if (currentMonthBudget > 0) {
      const projectedGap = roundMoney(currentMonthBudget - projectedSpent);
      const projectedOverage = Math.max(0, roundMoney(projectedSpent - currentMonthBudget));
      const paceRatio = projectedSpent / currentMonthBudget;

      if (paceRatio <= 0.92) {
        events.push({
          id: uuidv4(),
          eventType: 'month_projection_on_track',
          description: `${monthLabel(currentMonth)} is pacing safely`,
          date: now.toISOString(),
          metadata: {
            month: currentMonth,
            basis: 'budget',
            budget: currentMonthBudget,
            spent: currentMonthSpent,
            projectedSpent,
          },
          context: `With ₱${peso(currentMonthSpent)} spent so far, you are pacing toward about ₱${peso(projectedSpent)} by month end against a ₱${peso(currentMonthBudget)} budget. That leaves roughly ₱${peso(Math.max(0, projectedGap))} of breathing room if the current pace holds.`,
          advice: 'Keep protecting the categories that are staying disciplined. Small slips now can erase the cushion quickly.',
          link: `/transactions?month=${currentMonth}`,
          severity: 'positive',
          amount: Math.max(0, projectedGap),
        });
      } else if (paceRatio >= 1.08) {
        events.push({
          id: uuidv4(),
          eventType: 'month_projection_at_risk',
          description: `${monthLabel(currentMonth)} is pacing over budget`,
          date: now.toISOString(),
          metadata: {
            month: currentMonth,
            basis: 'budget',
            budget: currentMonthBudget,
            spent: currentMonthSpent,
            projectedSpent,
            projectedOverage,
          },
          context: `At your current pace, ${monthLabel(currentMonth)} is trending toward about ₱${peso(projectedSpent)} in spend against a ₱${peso(currentMonthBudget)} budget. That points to a projected overage of roughly ₱${peso(projectedOverage)} unless the pace slows down.`,
          advice: 'Check the categories driving the pace now. Catching one or two leaks this week is easier than fixing a full-month overspend later.',
          link: `/transactions?month=${currentMonth}`,
          severity: paceRatio >= 1.2 ? 'critical' : 'warning',
          amount: projectedOverage,
        });
      }
    } else if (currentMonthIncome > 0) {
      const projectedGap = roundMoney(currentMonthIncome - projectedSpent);
      const projectedShortfall = Math.max(0, roundMoney(projectedSpent - currentMonthIncome));
      const paceRatio = projectedSpent / currentMonthIncome;

      if (paceRatio <= 0.9) {
        events.push({
          id: uuidv4(),
          eventType: 'month_projection_on_track',
          description: `${monthLabel(currentMonth)} is pacing within current income`,
          date: now.toISOString(),
          metadata: {
            month: currentMonth,
            basis: 'income',
            income: currentMonthIncome,
            spent: currentMonthSpent,
            projectedSpent,
          },
          context: `Based on your current pace, this month is trending toward about ₱${peso(projectedSpent)} in spend against ₱${peso(currentMonthIncome)} of income already logged. That keeps roughly ₱${peso(Math.max(0, projectedGap))} uncommitted if the pace holds.`,
          advice: 'Use the buffer deliberately. Locking in part of it now is safer than waiting for the last week of the month.',
          link: `/transactions?month=${currentMonth}`,
          severity: 'positive',
          amount: Math.max(0, projectedGap),
        });
      } else if (paceRatio >= 1.05) {
        events.push({
          id: uuidv4(),
          eventType: 'month_projection_at_risk',
          description: `${monthLabel(currentMonth)} is pacing beyond current income`,
          date: now.toISOString(),
          metadata: {
            month: currentMonth,
            basis: 'income',
            income: currentMonthIncome,
            spent: currentMonthSpent,
            projectedSpent,
            projectedShortfall,
          },
          context: `This month is currently pacing toward about ₱${peso(projectedSpent)} in spend against ₱${peso(currentMonthIncome)} of income already logged. If nothing changes, that implies a shortfall of roughly ₱${peso(projectedShortfall)}.`,
          advice: 'Without an overall budget, the safest move is to slow the highest categories until income catches up.',
          link: `/transactions?month=${currentMonth}`,
          severity: paceRatio >= 1.15 ? 'critical' : 'warning',
          amount: projectedShortfall,
        });
      }
    }
  }

  // ── 3. Spending spikes (all months, not just last 6) ─────────────────────
  for (let i = 1; i < monthly.length; i++) {
    const curr = monthly[i];
    const prev = monthly[i - 1];
    if (curr.txs.length === 0 || prev.txs.length === 0) continue;
    for (const [cat, amount] of Object.entries(curr.cats)) {
      const prevAmt = prev.cats[cat] || 0;
      if (prevAmt > 0) {
        const pct = ((amount - prevAmt) / prevAmt) * 100;
        if (pct >= 40) {
          const extra = amount - prevAmt;
          events.push({
            id: uuidv4(),
            eventType: 'spending_spike',
            description: `${cat} spending spiked ${Math.round(pct)}% in ${monthLabel(curr.month)}`,
            date: `${curr.month}-15`,
            metadata: { category: cat, increase: Math.round(pct), amount, prevAmount: prevAmt },
            context: `You spent ₱${peso(amount)} on ${cat} in ${monthLabel(curr.month)}, up from ₱${peso(prevAmt)} the previous month — an extra ₱${peso(extra)}.`,
            advice: pct >= 80
              ? `Consider setting a category budget for ${cat} to keep spending in check.`
              : `Review your ${cat} transactions for that month to identify one-off vs. recurring costs.`,
            link: `/transactions?month=${curr.month}`,
            severity: pct >= 80 ? 'critical' : 'warning',
            amount: extra,
          });
        }
      }
    }
  }

  // ── 5b. Budget recovery after an over-budget month ──────────────────────
  for (let i = 1; i < monthly.length; i++) {
    const curr = monthly[i];
    const prev = monthly[i - 1];
    if (curr.month >= currentMonth) continue;
    if (prev.budget <= 0 || curr.budget <= 0) continue;
    if (prev.spent <= prev.budget || curr.spent > curr.budget || curr.txs.length === 0) continue;

    const previousOverage = prev.spent - prev.budget;
    const currentBuffer = curr.budget - curr.spent;
    const spendDrop = Math.max(0, prev.spent - curr.spent);

    events.push({
      id: uuidv4(),
      eventType: 'budget_recovery',
      description: `Recovered budget control in ${monthLabel(curr.month)}`,
      date: `${curr.month}-18`,
      metadata: {
        month: curr.month,
        previousMonth: prev.month,
        previousOverage,
        currentBuffer,
        spendDrop,
      },
      context: `After going ₱${peso(previousOverage)} over budget in ${monthLabel(prev.month)}, you brought spending down by ₱${peso(spendDrop)} and finished ${monthLabel(curr.month)} with about ₱${peso(currentBuffer)} still intact.` ,
      advice: 'Recovery months are worth studying. Identify what changed and turn it into a repeatable rule for the next cycle.',
      link: `/transactions?month=${curr.month}`,
      severity: 'positive',
      amount: spendDrop,
    });
  }

  // ── 4. Budget exceeded ───────────────────────────────────────────────────
  for (const d of monthly) {
    if (d.budget > 0 && d.spent > d.budget) {
      const over = d.spent - d.budget;
      const overPct = (over / d.budget) * 100;
      events.push({
        id: uuidv4(),
        eventType: 'budget_exceeded',
        description: `Budget exceeded in ${monthLabel(d.month)}`,
        date: `${d.month}-28`,
        metadata: { month: d.month, spent: d.spent, budget: d.budget, over, overPct: Math.round(overPct) },
        context: `Your ₱${peso(d.budget)} overall budget was surpassed by ₱${peso(over)} (${Math.round(overPct)}% over limit) in ${monthLabel(d.month)}.`,
        advice: overPct >= 30
          ? 'Consider increasing your budget or identifying the categories that drove the overspend.'
          : 'A small overage is common. Review discretionary spending next month to stay on track.',
        link: `/transactions?month=${d.month}`,
        severity: overPct >= 30 ? 'critical' : 'warning',
        amount: over,
      });
    }
  }

  // ── 5. Spending improvement ──────────────────────────────────────────────
  for (let i = 1; i < monthly.length; i++) {
    const curr = monthly[i];
    const prev = monthly[i - 1];
    if (curr.txs.length === 0 || prev.txs.length === 0 || prev.spent === 0) continue;
    const drop = ((prev.spent - curr.spent) / prev.spent) * 100;
    if (drop >= 20 && curr.budget > 0) {
      events.push({
        id: uuidv4(),
        eventType: 'spending_improvement',
        description: `Spending dropped ${Math.round(drop)}% in ${monthLabel(curr.month)}`,
        date: `${curr.month}-15`,
        metadata: { month: curr.month, drop: Math.round(drop), spent: curr.spent, prevSpent: prev.spent },
        context: `You spent ₱${peso(curr.spent)} in ${monthLabel(curr.month)}, down from ₱${peso(prev.spent)} — saving an extra ₱${peso(prev.spent - curr.spent)} compared to the previous month.`,
        advice: 'Great discipline! Identify which habits drove this and try to maintain them.',
        link: `/transactions?month=${curr.month}`,
        severity: 'positive',
        amount: prev.spent - curr.spent,
      });
    }
  }

  // ── 6. Highest savings amount month ─────────────────────────────────────
  const savingsMonths = monthly.filter(d => d.saved > 0);
  if (savingsMonths.length > 0) {
    const best = savingsMonths.reduce((a, b) => b.saved > a.saved ? b : a);
    const rate = Math.round((best.saved / best.budget) * 100);
    events.push({
      id: uuidv4(),
      eventType: 'highest_savings',
      description: `Best savings month: ${monthLabel(best.month)}`,
      date: `${best.month}-20`,
      metadata: { month: best.month, saved: best.saved, budget: best.budget, rate },
      context: `You saved ₱${peso(best.saved)} in ${monthLabel(best.month)} — ${rate}% of your ₱${peso(best.budget)} budget. This is your personal best savings amount so far.`,
      advice: 'Analyze what went well this month. Replicating these habits can accelerate your savings.',
      link: `/transactions?month=${best.month}`,
      severity: 'positive',
      amount: best.saved,
    });
  }

  // ── 7. Best savings rate month (if different from highest amount) ─────────
  const rateMonths = monthly.filter(d => d.budget > 0 && d.saved > 0);
  if (rateMonths.length > 1) {
    const bestRate = rateMonths.reduce((a, b) => (b.saved / b.budget) > (a.saved / a.budget) ? b : a);
    const bestAmt = savingsMonths.length > 0 ? savingsMonths.reduce((a, b) => b.saved > a.saved ? b : a) : null;
    if (bestAmt && bestRate.month !== bestAmt.month) {
      const rate = Math.round((bestRate.saved / bestRate.budget) * 100);
      events.push({
        id: uuidv4(),
        eventType: 'best_savings_rate',
        description: `Highest savings rate: ${rate}% in ${monthLabel(bestRate.month)}`,
        date: `${bestRate.month}-20`,
        metadata: { month: bestRate.month, rate, saved: bestRate.saved, budget: bestRate.budget },
        context: `You achieved a ${rate}% savings rate in ${monthLabel(bestRate.month)}, saving ₱${peso(bestRate.saved)} of your ₱${peso(bestRate.budget)} budget. This is your most efficient month on record.`,
        advice: 'A savings rate above 20% is excellent. Aim to match or beat this every month.',
        link: `/transactions?month=${bestRate.month}`,
        severity: 'positive',
        amount: bestRate.saved,
      });
    }
  }

  // ── 7b. Savings rate trend across completed cash-flow months ────────────
  const completedCashFlowMonths = computeMonthlySavingsHistory(trackedTransactions, budgets, subMonths(now, 1))
    .map((item) => {
      const monthTransactions = trackedTransactions.filter((transaction) =>
        transaction.date.startsWith(item.month)
      );
      const income = roundMoney(
        monthTransactions
          .filter(isIncomeTransaction)
          .reduce((sum, transaction) => sum + transaction.amount, 0)
      );
      const expenses = roundMoney(
        monthTransactions
          .filter(isExpenseTransaction)
          .reduce((sum, transaction) => sum + transaction.amount, 0)
      );
      const txCount = monthTransactions.length;

      return {
        month: item.month,
        income,
        expenses,
        txCount,
        rate: income > 0 ? ((income - expenses) / income) * 100 : null,
      };
    })
    .filter((item) => item.income > 0 && item.txCount >= 3 && item.rate !== null);

  const recentCashFlowTrend = completedCashFlowMonths.slice(-3);
  if (recentCashFlowTrend.length === 3) {
    const first = recentCashFlowTrend[0];
    const latest = recentCashFlowTrend[recentCashFlowTrend.length - 1];
    const change = (latest.rate ?? 0) - (first.rate ?? 0);

    if (Math.abs(change) >= 5) {
      const improving = change > 0;
      events.push({
        id: uuidv4(),
        eventType: 'savings_rate_trend',
        description: improving
          ? 'Savings rate is improving'
          : 'Savings rate is slipping',
        date: `${latest.month}-20`,
        metadata: {
          fromMonth: first.month,
          toMonth: latest.month,
          fromRate: first.rate,
          toRate: latest.rate,
          change,
        },
        context: `Your savings rate moved from ${(first.rate ?? 0).toFixed(0)}% in ${monthLabel(first.month)} to ${(latest.rate ?? 0).toFixed(0)}% in ${monthLabel(latest.month)}. That is a ${Math.abs(change).toFixed(0)}-point ${improving ? 'improvement' : 'drop'} across the last three completed cash-flow months.`,
        advice: improving
          ? 'Momentum like this is worth protecting. Keep the same income-to-spending discipline before lifestyle drift catches up.'
          : 'A slipping savings rate is usually easier to fix at the category level than with one big cut. Start with the fastest-growing spend bucket.',
        link: `/transactions?month=${latest.month}`,
        severity: improving ? 'positive' : 'warning',
      });
    }
  }

  // ── 8. Savings milestones (cumulative) ───────────────────────────────────
  const MILESTONES = [5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
  let cumulative = 0;
  for (const d of monthly) {
    const prev = cumulative;
    cumulative += d.saved;
    for (const ms of MILESTONES) {
      if (prev < ms && cumulative >= ms) {
        const label = ms >= 1000000 ? `₱${ms / 1000000}M` : ms >= 1000 ? `₱${ms / 1000}K` : `₱${ms}`;
        events.push({
          id: uuidv4(),
          eventType: 'savings_milestone',
          description: `${label} cumulative savings reached!`,
          date: `${d.month}-25`,
          metadata: { milestone: ms, cumulative, month: d.month },
          context: `Your total accumulated savings crossed the ₱${peso(ms)} mark in ${monthLabel(d.month)}. Your cumulative savings now stand at ₱${peso(cumulative)}.`,
          advice: 'Every milestone is proof that consistent saving adds up. Set your next savings target and keep going!',
          severity: 'positive',
          amount: cumulative,
        });
      }
    }
  }

  // ── 9. Savings streak (3+ consecutive months) ───────────────────────────
  let bestStreakLen = 0, bestStreakStart = -1, streakLen = 0, streakStart = -1;
  for (let i = 0; i < monthly.length; i++) {
    if (monthly[i].saved > 0) {
      if (streakLen === 0) streakStart = i;
      streakLen++;
      if (streakLen > bestStreakLen) { bestStreakLen = streakLen; bestStreakStart = streakStart; }
    } else { streakLen = 0; }
  }
  if (bestStreakLen >= 3 && bestStreakStart >= 0) {
    const endD = monthly[bestStreakStart + bestStreakLen - 1];
    const startD = monthly[bestStreakStart];
    events.push({
      id: uuidv4(),
      eventType: 'savings_streak',
      description: `${bestStreakLen}-month savings streak!`,
      date: `${endD.month}-10`,
      metadata: { months: bestStreakLen, from: startD.month, to: endD.month },
      context: `You saved consistently for ${bestStreakLen} months in a row, from ${monthLabel(startD.month)} to ${monthLabel(endD.month)}. Consistency is one of the most powerful financial habits.`,
      advice: bestStreakLen >= 6
        ? 'Half a year of consistent saving! Consider moving surplus savings into an investment or high-yield account.'
        : 'Keep the streak alive! Automating your savings transfer each month makes it effortless.',
      severity: 'positive',
    });
  }

  // ── 9b. Post-income spending behavior ───────────────────────────────────
  if (currentMonthIncomeTransactions.length > 0 && currentMonthExpenseTransactions.length >= 6) {
    const postIncomeInsights = generatePostIncomeBehavior(trackedTransactions, now);
    for (const insight of postIncomeInsights) {
      const payload = insight.dataPayload as {
        postIncomeDailyAvg?: number;
        dailyAvg?: number;
        multiplier?: number;
      } | undefined;
      const postIncomeDailyAvg = payload?.postIncomeDailyAvg ?? 0;
      const dailyAvg = payload?.dailyAvg ?? 0;
      const multiplier = payload?.multiplier ?? 0;

      if (postIncomeDailyAvg <= 0 || dailyAvg <= 0 || multiplier <= 1) {
        continue;
      }

      const latestIncome = [...currentMonthIncomeTransactions].sort(
        (left, right) => parseISO(right.date).getTime() - parseISO(left.date).getTime()
      )[0];

      events.push({
        id: uuidv4(),
        eventType: 'post_income_spending',
        description: 'Spending jumps after income days',
        date: latestIncome.date,
        metadata: {
          month: currentMonth,
          postIncomeDailyAvg,
          dailyAvg,
          multiplier,
        },
        context: `In the few days after money comes in, you are spending about ₱${peso(postIncomeDailyAvg)} per day versus your usual ₱${peso(dailyAvg)}. That is roughly ${((multiplier - 1) * 100).toFixed(0)}% higher than your normal daily pace.`,
        advice: 'Try pre-deciding the first transfer, bill payment, or spending cap for payday week so the extra liquidity does not disappear on autopilot.',
        link: `/transactions?month=${currentMonth}`,
        severity: 'warning',
        amount: roundMoney(postIncomeDailyAvg - dailyAvg),
      });
    }
  }

  // ── 10. Low-spend month (30%+ below average) ─────────────────────────────
  const activeMonths = monthly.filter(d => d.txs.length > 0 && d.budget > 0);
  if (activeMonths.length >= 3) {
    const avg = activeMonths.reduce((s, d) => s + d.spent, 0) / activeMonths.length;
    for (const d of activeMonths) {
      const pctBelow = ((avg - d.spent) / avg) * 100;
      if (pctBelow >= 30) {
        events.push({
          id: uuidv4(),
          eventType: 'low_spend_month',
          description: `Exceptionally low spending in ${monthLabel(d.month)}`,
          date: `${d.month}-15`,
          metadata: { month: d.month, spent: d.spent, avgSpent: Math.round(avg), pctBelow: Math.round(pctBelow) },
          context: `You spent only ₱${peso(d.spent)} in ${monthLabel(d.month)} — ${Math.round(pctBelow)}% below your average of ₱${peso(avg)}, saving an extra ₱${peso(avg - d.spent)}.`,
          advice: 'What made this month different? If intentional, try to replicate the conditions in future months.',
          link: `/transactions?month=${d.month}`,
          severity: 'positive',
          amount: avg - d.spent,
        });
      }
    }
  }

  return events.sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
}
