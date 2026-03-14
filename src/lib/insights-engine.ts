import { v4 as uuidv4 } from 'uuid';
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  format,
  parseISO,
  differenceInDays,
  startOfWeek,
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
  Category,
  DashboardData,
} from './types';

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
    sums[tx.category] = (sums[tx.category] || 0) + tx.amount;
  }
  return sums;
}

// Spending Spike Detection
export function detectSpendingSpikes(
  transactions: Transaction[],
  now: Date = new Date()
): Insight[] {
  const insights: Insight[] = [];
  const currentMonth = getMonthTransactions(transactions, now);
  const lastMonth = getMonthTransactions(transactions, subMonths(now, 1));

  const currentCats = categorySum(currentMonth);
  const lastCats = categorySum(lastMonth);

  for (const [cat, amount] of Object.entries(currentCats)) {
    const prev = lastCats[cat] || 0;
    if (prev > 0) {
      const increase = ((amount - prev) / prev) * 100;
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
  const byNotes: Record<string, Transaction[]> = {};

  for (const tx of transactions) {
    const key = `${tx.notes.toLowerCase().trim()}_${tx.amount}`;
    if (tx.notes.trim()) {
      if (!byNotes[key]) byNotes[key] = [];
      byNotes[key].push(tx);
    }
  }

  for (const [, txs] of Object.entries(byNotes)) {
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
        subscriptions.push({
          id: uuidv4(),
          name: txs[0].notes,
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
  const monthTxs = getMonthTransactions(transactions, now);
  const totalSpent = sumTransactions(monthTxs);
  const catSpent = categorySum(monthTxs);

  const statuses: BudgetStatus[] = [];

  for (const budget of budgets) {
    if (budget.month !== monthStr) continue;

    const spent =
      budget.category === 'Overall' ? totalSpent : (catSpent[budget.category] || 0);
    const percentage = budget.monthlyLimit > 0 ? (spent / budget.monthlyLimit) * 100 : 0;

    let status: 'safe' | 'warning' | 'critical' = 'safe';
    if (percentage >= 100) status = 'critical';
    else if (percentage >= 80) status = 'warning';

    statuses.push({
      category: budget.category,
      limit: budget.monthlyLimit,
      spent,
      percentage,
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
  const monthStr = format(now, 'yyyy-MM');
  const monthStart = startOfMonth(now);
  const dayOfMonth = now.getDate();
  const daysInMonth = endOfMonth(now).getDate();
  const monthTxs = getMonthTransactions(transactions, now);
  const totalSpent = sumTransactions(monthTxs);

  for (const budget of budgets) {
    if (budget.month !== monthStr || budget.category !== 'Overall') continue;

    const dailyRate = dayOfMonth > 0 ? totalSpent / dayOfMonth : 0;
    const projected = dailyRate * daysInMonth;

    if (projected > budget.monthlyLimit && totalSpent < budget.monthlyLimit) {
      insights.push({
        id: uuidv4(),
        insightType: 'budget_risk',
        message: `At your current pace, you may exceed your monthly budget by ₱${(projected - budget.monthlyLimit).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
        severity: 'warning',
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
  const monthTxs = getMonthTransactions(transactions, now);

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

  const totalSpentThisMonth = sumTransactions(currentMonthTxs);
  const totalSpentLastMonth = sumTransactions(lastMonthTxs);

  const monthStr = format(now, 'yyyy-MM');
  const overallBudget = budgets.find(
    (b) => b.category === 'Overall' && b.month === monthStr
  );
  const monthlyBudget = overallBudget?.monthlyLimit || 0;
  const remainingBudget = Math.max(0, monthlyBudget - totalSpentThisMonth);

  const savingsRate =
    monthlyBudget > 0 ? ((monthlyBudget - totalSpentThisMonth) / monthlyBudget) * 100 : 0;

  const expenseGrowthRate =
    totalSpentLastMonth > 0
      ? ((totalSpentThisMonth - totalSpentLastMonth) / totalSpentLastMonth) * 100
      : 0;

  const budgetStatuses = calculateBudgetStatuses(transactions, budgets, now);

  const catBreakdown = categorySum(currentMonthTxs);
  const categoryBreakdown = Object.entries(catBreakdown)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Weekly spending
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 });
  const weeklySpending = weeks.map((weekStart, i) => {
    const weekEnd = i < weeks.length - 1 ? weeks[i + 1] : monthEnd;
    const weekTxs = currentMonthTxs.filter((t) => {
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
    start: subMonths(now, 0),
    end: now,
  }).slice(-7);

  const dailySpending = days.map((day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayTxs = transactions.filter((t) => t.date.startsWith(dayStr));
    return {
      day: format(day, 'EEE'),
      amount: sumTransactions(dayTxs),
    };
  });

  const recentTransactions = [...currentMonthTxs]
    .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())
    .slice(0, 5);

  const insights = generateInsights(transactions, budgets, now);

  return {
    totalSpentThisMonth,
    totalSpentLastMonth,
    remainingBudget,
    monthlyBudget,
    savingsRate,
    expenseGrowthRate,
    budgetStatuses,
    categoryBreakdown,
    weeklySpending,
    dailySpending,
    recentTransactions,
    insights,
  };
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
      (b) => b.category === 'Overall' && b.month === month
    );
    const monthTxs = transactions.filter((t) => t.date.startsWith(month));
    const spent = sumTransactions(monthTxs);
    const budget = overallBudget?.monthlyLimit ?? 0;
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
  if (transactions.length === 0) return events;

  const peso = (n: number) => n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const monthLabel = (ym: string) => {
    const [y, m] = ym.split('-');
    return new Date(Number(y), Number(m) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  // ── 1. Started tracking ──────────────────────────────────────────────────
  const sorted = [...transactions].sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
  const firstTx = sorted[0];
  events.push({
    id: uuidv4(),
    eventType: 'started_tracking',
    description: 'Started expense tracking',
    date: firstTx.date,
    metadata: { totalTransactions: transactions.length },
    context: `Your financial journey began with a ₱${peso(firstTx.amount)} expense on ${format(parseISO(firstTx.date), 'MMMM d, yyyy')}${firstTx.notes ? ` — "${firstTx.notes}"` : ''}. You have recorded ${transactions.length} transaction${transactions.length !== 1 ? 's' : ''} since then.`,
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
  for (const tx of transactions) allMonths.add(tx.date.slice(0, 7));
  for (const b of budgets) if (b.category === 'Overall') allMonths.add(b.month);
  const sortedMonths = Array.from(allMonths).sort();

  type MonthData = { month: string; spent: number; saved: number; budget: number; txs: Transaction[]; cats: Record<string, number> };
  const monthly: MonthData[] = sortedMonths.map(month => {
    const txs = transactions.filter(t => t.date.startsWith(month));
    const spent = sumTransactions(txs);
    const budget = budgets.find(b => b.category === 'Overall' && b.month === month)?.monthlyLimit ?? 0;
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
