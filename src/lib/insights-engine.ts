import { v4 as uuidv4 } from 'uuid';
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  subDays,
  addMonths,
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
  DashboardData,
} from './types';

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
  return tx.type === 'income';
}

function isSavingsTransaction(tx: Transaction): boolean {
  return tx.type === 'savings';
}

function isExpenseTransaction(tx: Transaction): boolean {
  return !isIncomeTransaction(tx) && !isSavingsTransaction(tx);
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

  const incomeBoost = budget.category === 'Overall'
    ? roundMoney(
        transactions
          .filter((tx) => tx.date.startsWith(budget.month) && isIncomeTransaction(tx))
          .reduce((sum, tx) => sum + tx.amount, 0)
      )
    : 0;

  const buildResolved = (baseLimit: number, rolloverCarry: number): ResolvedBudgetLimit => ({
    baseLimit: roundMoney(baseLimit),
    incomeBoost,
    effectiveLimit: roundMoney(baseLimit + incomeBoost),
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
          message: `${cat} spending increased by ${Math.round(increase)}% this month compared to last month.`,
          severity: increase >= 50 ? 'critical' : 'warning',
          category: cat as Category,
          createdAt: new Date().toISOString(),
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
        message: `At your current pace, ${label} may exceed budget by ₱${status.projectedOverage.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
        severity: status.projectedOverage > status.effectiveLimit * 0.2 ? 'critical' : 'warning',
        category: status.category === 'Overall' ? undefined : status.category,
        createdAt: new Date().toISOString(),
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
      message: `You spend most of your money on ${maxDay[0]}s.`,
      severity: 'info',
      createdAt: new Date().toISOString(),
    });
  }

  return insights;
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
  ];
}

// Generate subscription insights
export function generateSubscriptionInsights(subscriptions: Subscription[]): Insight[] {
  return subscriptions.map((sub) => ({
    id: uuidv4(),
    insightType: 'subscription' as const,
    message: `Recurring subscription detected: ${sub.name} (₱${sub.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/${sub.billingCycle}).`,
    severity: 'info' as const,
    category: sub.category,
    createdAt: new Date().toISOString(),
  }));
}

// Build Dashboard Data
export function buildDashboardData(
  transactions: Transaction[],
  budgets: Budget[],
  now: Date = new Date()
): DashboardData {
  const currentMonthTxs = getMonthTransactions(transactions, now);
  const lastMonthTxs = getMonthTransactions(transactions, subMonths(now, 1));
  const currentMonthExpenseTxs = currentMonthTxs.filter(isExpenseTransaction);
  const lastMonthExpenseTxs = lastMonthTxs.filter(isExpenseTransaction);

  const totalSpentThisMonth = sumTransactions(currentMonthExpenseTxs);
  const totalSpentLastMonth = sumTransactions(lastMonthExpenseTxs);

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

  const currentMonthDays = eachDayOfInterval({
    start: monthStart,
    end: monthEnd,
  });

  const calendarSpending = currentMonthDays.map((day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayTotal = currentMonthExpenseTxs
      .filter((transaction) => transaction.date.startsWith(dateStr))
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    return {
      date: dateStr,
      amount: dayTotal,
    };
  });

  const recentTransactions = [...currentMonthTxs]
    .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())
    .slice(0, 5);

  const currentMonthTransactions = [...currentMonthTxs]
    .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());

  const insights = generateInsights(transactions, budgets, now);

  return {
    totalSpentThisMonth,
    totalSpentLastMonth,
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
    currentMonthTransactions,
    recentTransactions,
    insights,
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
  budgets: Budget[]
): import('./types').MonthlySavings[] {
  // Determine earliest month from any transaction or Overall budget
  const seedMonths: string[] = [];
  for (const tx of transactions) seedMonths.push(tx.date.slice(0, 7));
  for (const b of budgets) if (b.category === 'Overall') seedMonths.push(b.month);
  if (seedMonths.length === 0) return [];

  const startMonth = seedMonths.sort()[0];
  const currentMonth = format(new Date(), 'yyyy-MM');

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
  budgets: Budget[] = []
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const expenseTransactions = transactions.filter(isExpenseTransaction);
  if (expenseTransactions.length === 0) return events;

  const peso = (n: number) => n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const monthLabel = (ym: string) => {
    const [y, m] = ym.split('-');
    return new Date(Number(y), Number(m) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  // ── 1. Started tracking ──────────────────────────────────────────────────
  const sorted = [...expenseTransactions].sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
  const firstTx = sorted[0];
  const firstTxLabel = firstTx.description || firstTx.notes || firstTx.category;
  events.push({
    id: uuidv4(),
    eventType: 'started_tracking',
    description: 'Started expense tracking',
    date: firstTx.date,
    metadata: { totalTransactions: expenseTransactions.length },
    context: `Your financial journey began with a ₱${peso(firstTx.amount)} expense on ${format(parseISO(firstTx.date), 'MMMM d, yyyy')}${firstTxLabel ? ` — "${firstTxLabel}"` : ''}. You have recorded ${expenseTransactions.length} transaction${expenseTransactions.length !== 1 ? 's' : ''} since then.`,
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
