'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDays,
  eachWeekOfInterval,
  endOfMonth,
  format,
  isSameDay,
  parseISO,
  startOfMonth,
} from 'date-fns';
import type { Budget, PaymentMethod, Transaction } from '@/lib/types';
import { InsightsSkeleton } from '@/components/SkeletonLoaders';
import { Lightbulb, TrendingUp, BarChart2 } from 'lucide-react';
import { subscribeAppUpdates } from '@/lib/transaction-ws';
import AddExpenseModal from '@/components/AddExpenseModal';
import EmptyState from '@/components/EmptyState';

type InsightFilter = 'all' | 'spending_spike' | 'subscription' | 'budget_risk' | 'pattern';

type CategoryBreakdownItem = {
  category: string;
  amount: number;
  percentage: number;
  averageTransactionSize: number;
};

type WeeklySummary = {
  key: string;
  label: string;
  amount: number;
  transactions: Transaction[];
  multiplier: number;
};

const FILTER_CHIPS: Array<{ key: InsightFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'spending_spike', label: 'Spending Spikes' },
  { key: 'subscription', label: 'Subscriptions' },
  { key: 'budget_risk', label: 'Budget Risks' },
  { key: 'pattern', label: 'Patterns' },
];

const DAY_OF_WEEK_ORDER: Array<{ label: string; short: string; dayIndex: number }> = [
  { label: 'Monday', short: 'Mon', dayIndex: 1 },
  { label: 'Tuesday', short: 'Tue', dayIndex: 2 },
  { label: 'Wednesday', short: 'Wed', dayIndex: 3 },
  { label: 'Thursday', short: 'Thu', dayIndex: 4 },
  { label: 'Friday', short: 'Fri', dayIndex: 5 },
  { label: 'Saturday', short: 'Sat', dayIndex: 6 },
  { label: 'Sunday', short: 'Sun', dayIndex: 0 },
];

const SECTION_LABEL_CLASS =
  'font-body text-[10px] sm:text-[11px] uppercase tracking-[0.16em] font-semibold text-zinc-500 dark:text-zinc-400';

function formatPeso(value: number): string {
  return value.toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
  });
}

function safeParseDate(value: string): Date {
  const parsed = parseISO(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const fallback = new Date(value);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback;
  }

  return new Date();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function joinReadable(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function getTransactionAllocations(tx: Transaction): Array<{ category: string; amount: number }> {
  if (Array.isArray(tx.split) && tx.split.length > 0) {
    return tx.split.map((line) => ({
      category: line.category,
      amount: line.amount,
    }));
  }

  return [
    {
      category: tx.category,
      amount: tx.amount,
    },
  ];
}

function transactionLabel(tx: Transaction): string {
  return tx.merchant || tx.description || tx.notes || tx.category;
}

function isSubscriptionTransaction(tx: Transaction): boolean {
  const normalizedTags = Array.isArray(tx.tags)
    ? tx.tags.map((tag) => tag.toLowerCase())
    : [];

  return (
    Boolean(tx.recurring) ||
    tx.category === 'Subscriptions' ||
    normalizedTags.some((tag) => tag.includes('recurring') || tag.includes('subscription'))
  );
}

function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  return (
    <span className="font-body inline-flex items-center rounded-full border-[0.5px] border-zinc-300/80 dark:border-zinc-700 bg-white/75 dark:bg-zinc-900/60 px-2 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
      {method}
    </span>
  );
}

export default function InsightsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<InsightFilter>('all');

  const openAddTransactionModal = useCallback(() => {
    setShowAddModal(true);
  }, []);

  const fetchInsightsData = useCallback(async (showLoader: boolean) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const [transactionsRes, budgetsRes] = await Promise.all([
        fetch('/api/transactions'),
        fetch('/api/budgets'),
      ]);

      if (!transactionsRes.ok || !budgetsRes.ok) {
        throw new Error('Failed to load insights data.');
      }

      const [transactionsJson, budgetsJson] = await Promise.all([
        transactionsRes.json() as Promise<Transaction[]>,
        budgetsRes.json() as Promise<Budget[]>,
      ]);

      setTransactions(Array.isArray(transactionsJson) ? transactionsJson : []);
      setBudgets(Array.isArray(budgetsJson) ? budgetsJson : []);
      setError(null);
    } catch {
      setError('Unable to refresh insights right now.');
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchInsightsData(true);
  }, [fetchInsightsData]);

  useEffect(() => {
    const unsubscribe = subscribeAppUpdates(() => {
      void fetchInsightsData(false);
    });

    return unsubscribe;
  }, [fetchInsightsData]);

  const model = useMemo(() => {
    const now = new Date();
    const currentMonth = format(now, 'yyyy-MM');
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const monthTransactions = transactions
      .filter((tx) => tx.date.startsWith(currentMonth))
      .sort((a, b) => safeParseDate(a.date).getTime() - safeParseDate(b.date).getTime());

    const totalSpentThisMonth = monthTransactions.reduce((sum, tx) => sum + tx.amount, 0);

    const overallBudget = budgets.find(
      (budget) => budget.category === 'Overall' && budget.month === currentMonth && !budget.subCategory
    );
    const monthlyBudget = overallBudget?.monthlyLimit ?? 0;

    const daysInMonth = monthEnd.getDate();
    const daysElapsed = Math.max(1, now.getDate());
    const daysRemaining = Math.max(0, daysInMonth - now.getDate());
    const currentSpendRate = totalSpentThisMonth / daysElapsed;
    const projectedMonthEnd = totalSpentThisMonth + currentSpendRate * daysRemaining;
    const overshootAmount = Math.max(0, projectedMonthEnd - monthlyBudget);
    const hasBudgetOvershoot = monthlyBudget > 0 && projectedMonthEnd > monthlyBudget;

    const observedWeekStarts = eachWeekOfInterval(
      { start: monthStart, end: now },
      { weekStartsOn: 1 }
    );
    const observedWeekEnd = addDays(now, 1);

    const weeklyBase: WeeklySummary[] = observedWeekStarts.map((weekStart, index) => {
      const rawEndExclusive = observedWeekStarts[index + 1] ?? observedWeekEnd;
      const bucketStart = weekStart < monthStart ? monthStart : weekStart;
      const bucketEndExclusive = rawEndExclusive > observedWeekEnd ? observedWeekEnd : rawEndExclusive;
      const bucketTransactions = monthTransactions.filter((tx) => {
        const txDate = safeParseDate(tx.date);
        return txDate >= bucketStart && txDate < bucketEndExclusive;
      });
      const amount = bucketTransactions.reduce((sum, tx) => sum + tx.amount, 0);
      const rangeEnd = addDays(bucketEndExclusive, -1);

      return {
        key: format(bucketStart, 'yyyy-MM-dd'),
        label: `${format(bucketStart, 'MMM d')} - ${format(rangeEnd, 'MMM d')}`,
        amount,
        transactions: bucketTransactions,
        multiplier: 0,
      };
    });

    const weeklyAverage =
      weeklyBase.length > 0
        ? weeklyBase.reduce((sum, week) => sum + week.amount, 0) / weeklyBase.length
        : 0;

    const spikeWeeks = weeklyBase
      .map((week) => ({
        ...week,
        multiplier: weeklyAverage > 0 ? week.amount / weeklyAverage : 0,
      }))
      .filter((week) => weeklyAverage > 0 && week.amount > weeklyAverage * 2)
      .sort((a, b) => b.multiplier - a.multiplier || b.amount - a.amount);

    const primarySpike = spikeWeeks[0] ?? null;
    const largestSpikeTransaction =
      primarySpike?.transactions.reduce<Transaction | null>((largest, tx) => {
        if (!largest || tx.amount > largest.amount) {
          return tx;
        }
        return largest;
      }, null) ?? null;

    const dayTotals = new Map<number, number>();
    for (const tx of monthTransactions) {
      const dayIndex = safeParseDate(tx.date).getDay();
      dayTotals.set(dayIndex, (dayTotals.get(dayIndex) ?? 0) + tx.amount);
    }

    const spendByDayOfWeek = DAY_OF_WEEK_ORDER.map((day) => ({
      ...day,
      amount: dayTotals.get(day.dayIndex) ?? 0,
    }));
    const highestDayAmount = spendByDayOfWeek.reduce((max, day) => Math.max(max, day.amount), 0);
    const highestDay =
      spendByDayOfWeek.find((day) => day.amount === highestDayAmount) ?? spendByDayOfWeek[0];

    const categoryMap = new Map<string, { amount: number; count: number }>();
    for (const tx of monthTransactions) {
      for (const allocation of getTransactionAllocations(tx)) {
        const existing = categoryMap.get(allocation.category) ?? { amount: 0, count: 0 };
        existing.amount += allocation.amount;
        existing.count += 1;
        categoryMap.set(allocation.category, existing);
      }
    }

    const categoryBreakdown: CategoryBreakdownItem[] = Array.from(categoryMap.entries())
      .map(([category, summary]) => ({
        category,
        amount: summary.amount,
        percentage: totalSpentThisMonth > 0 ? (summary.amount / totalSpentThisMonth) * 100 : 0,
        averageTransactionSize: summary.count > 0 ? summary.amount / summary.count : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const topCategory = categoryBreakdown[0] ?? null;

    const subscriptionTransactions = [...transactions]
      .filter(isSubscriptionTransaction)
      .sort((a, b) => safeParseDate(b.date).getTime() - safeParseDate(a.date).getTime());

    const savingsRate =
      monthlyBudget > 0 ? ((monthlyBudget - totalSpentThisMonth) / monthlyBudget) * 100 : 0;
    const hasSpendingSpike = Boolean(primarySpike);
    const alertCount = Number(hasBudgetOvershoot) + Number(hasSpendingSpike);

    let financialHealthScore = 50;
    if (savingsRate > 30) financialHealthScore += 20;
    if (!hasBudgetOvershoot) financialHealthScore += 15;
    if (!hasSpendingSpike) financialHealthScore += 15;
    financialHealthScore -= alertCount * 10;
    financialHealthScore = clamp(financialHealthScore, 0, 100);

    const scoreLabel = financialHealthScore >= 70 ? 'Good' : financialHealthScore >= 40 ? 'Fair' : 'At Risk';

    const positiveDrivers: string[] = [];
    if (savingsRate > 30) positiveDrivers.push('savings rate above 30%');
    if (!hasBudgetOvershoot) positiveDrivers.push('no projected budget overshoot');
    if (!hasSpendingSpike) positiveDrivers.push('no weekly spending spike');

    const negativeDrivers: string[] = [];
    if (hasBudgetOvershoot) negativeDrivers.push('a projected budget overshoot');
    if (hasSpendingSpike) negativeDrivers.push('a weekly spending spike');

    const scoreSummaryLine1 =
      positiveDrivers.length > 0
        ? `Upward drivers: ${joinReadable(positiveDrivers)}.`
        : 'Upward drivers: none yet this month.';
    const scoreSummaryLine2 =
      negativeDrivers.length > 0
        ? `Downward drivers: ${joinReadable(negativeDrivers)}.`
        : 'Downward drivers: no active alerts.';

    const ringRadius = 52;
    const ringCircumference = 2 * Math.PI * ringRadius;
    const ringOffset = ringCircumference - (financialHealthScore / 100) * ringCircumference;

    return {
      monthlyBudget,
      totalSpentThisMonth,
      daysRemaining,
      projectedMonthEnd,
      overshootAmount,
      hasBudgetOvershoot,
      weeklyAverage,
      primarySpike,
      largestSpikeTransaction,
      hasSpendingSpike,
      spendByDayOfWeek,
      highestDay,
      highestDayAmount,
      categoryBreakdown,
      topCategory,
      subscriptionTransactions,
      savingsRate,
      financialHealthScore,
      scoreLabel,
      scoreSummaryLine1,
      scoreSummaryLine2,
      ringCircumference,
      ringOffset,
    };
  }, [transactions, budgets]);

  const showAlertsSection =
    filter === 'all' || filter === 'spending_spike' || filter === 'budget_risk';
  const showPatternsSection = filter === 'all' || filter === 'pattern';
  const showSubscriptionsSection = filter === 'all' || filter === 'subscription';

  const showOvershootCard =
    model.hasBudgetOvershoot && (filter === 'all' || filter === 'budget_risk');
  const showSpikeCard = model.hasSpendingSpike && (filter === 'all' || filter === 'spending_spike');

  const spentProgress =
    model.monthlyBudget > 0
      ? clamp((model.totalSpentThisMonth / model.monthlyBudget) * 100, 0, 100)
      : 0;
  const dailyCutTarget =
    model.daysRemaining > 0 ? model.overshootAmount / model.daysRemaining : model.overshootAmount;

  const alertsEmptyMessage =
    filter === 'budget_risk'
      ? 'No projected budget overshoot this month.'
      : filter === 'spending_spike'
        ? 'No weekly spending spike detected this month.'
        : 'No active alerts for this month.';
  const showInsightsEmptyState = transactions.length === 0 && !error;

  return (
    <>
      <div className="font-body max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center">
            <Lightbulb size={20} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-white">
              Financial Insights
            </h1>
            <p className="font-body text-sm text-zinc-500 dark:text-zinc-400">
              Smart analysis of your spending behavior
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {FILTER_CHIPS.map((type) => (
            <button
              key={type.key}
              onClick={() => setFilter(type.key)}
              className={`font-body px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                filter === type.key
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-emerald-300 dark:hover:border-emerald-600'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {loading ? (
          <InsightsSkeleton />
        ) : showInsightsEmptyState ? (
          <EmptyState
            icon={BarChart2}
            headline="Not enough data yet."
            subtext="Log transactions across a few categories and your financial patterns will start to emerge."
            cta={{ label: '+ Add Transaction', action: 'add-transaction' }}
            onAddTransaction={openAddTransactionModal}
          />
        ) : (
          <div className="space-y-7">
            {error && (
              <p className="font-body text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

          {showAlertsSection && (
            <section className="space-y-3">
              <p className={SECTION_LABEL_CLASS}>Alerts</p>

              <div className="space-y-3">
                {showOvershootCard && (
                  <article className="rounded-[12px] border-[0.5px] border-amber-300/80 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-500/10 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-body text-sm font-semibold text-amber-900 dark:text-amber-200">
                          Budget overshoot risk
                        </p>
                        <p className="font-body text-xs text-amber-700 dark:text-amber-300/80 mt-1">
                          Projected month-end spend
                        </p>
                        <p className="font-display text-2xl leading-tight text-amber-900 dark:text-amber-100 mt-1">
                          {formatPeso(model.projectedMonthEnd)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-body text-xs uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300/80">
                          Overshoot
                        </p>
                        <p className="font-display text-xl text-amber-900 dark:text-amber-100 mt-1">
                          {formatPeso(model.overshootAmount)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="h-2 rounded-full bg-amber-200/80 dark:bg-amber-500/20 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-500"
                          style={{ width: `${spentProgress}%` }}
                        />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200/90">
                        <span>Spent {formatPeso(model.totalSpentThisMonth)}</span>
                        <span>Budget {formatPeso(model.monthlyBudget)}</span>
                      </div>
                    </div>

                    <p className="font-body mt-3 text-sm text-amber-900 dark:text-amber-100">
                      Cut ₱{dailyCutTarget.toFixed(0)}/day to stay on track.
                    </p>
                  </article>
                )}

                {showSpikeCard && model.primarySpike && (
                  <article className="rounded-[12px] border-[0.5px] border-red-300/80 dark:border-red-500/30 bg-red-50/85 dark:bg-red-500/10 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-body text-sm font-semibold text-red-900 dark:text-red-200">
                          Spending spike detected
                        </p>
                        <p className="font-body text-xs text-red-700 dark:text-red-300/80 mt-1">
                          Spike week: {model.primarySpike.label}
                        </p>
                      </div>
                      <TrendingUp size={18} className="text-red-600 dark:text-red-300" />
                    </div>

                    <div className="mt-2">
                      <p className="font-display text-2xl leading-tight text-red-900 dark:text-red-100">
                        {formatPeso(model.primarySpike.amount)}
                      </p>
                      <p className="font-body text-sm text-red-800 dark:text-red-200/90 mt-1">
                        {model.primarySpike.multiplier.toFixed(1)}x vs weekly average ({formatPeso(model.weeklyAverage)})
                      </p>
                    </div>

                    {model.largestSpikeTransaction && (
                      <div className="mt-3 rounded-[10px] border-[0.5px] border-red-300/60 dark:border-red-500/30 bg-white/55 dark:bg-zinc-900/35 p-3">
                        <p className="font-body text-xs uppercase tracking-[0.12em] text-red-700 dark:text-red-300/80">
                          Largest transaction that week
                        </p>
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <p className="font-body text-sm font-medium text-red-900 dark:text-red-100 truncate">
                            {transactionLabel(model.largestSpikeTransaction)}
                          </p>
                          <p className="font-display text-lg text-red-900 dark:text-red-100">
                            {formatPeso(model.largestSpikeTransaction.amount)}
                          </p>
                        </div>
                      </div>
                    )}
                  </article>
                )}

                {!showOvershootCard && !showSpikeCard && (
                  <p className="font-body text-sm text-zinc-500 dark:text-zinc-400">{alertsEmptyMessage}</p>
                )}
              </div>
            </section>
          )}

          {showPatternsSection && (
            <section className="space-y-3">
              <p className={SECTION_LABEL_CLASS}>Patterns</p>

              <div className="grid gap-3 sm:grid-cols-2">
                <article className="sm:col-span-2 rounded-[12px] border-[0.5px] border-emerald-300/80 dark:border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-500/10 p-4">
                  <p className="font-body text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                    You spend most on {model.highestDay.label}.
                  </p>

                  <div className="mt-4 grid grid-cols-7 gap-2">
                    {model.spendByDayOfWeek.map((day) => {
                      const isHighest = model.highestDayAmount > 0 && day.amount === model.highestDayAmount;
                      const barHeight =
                        model.highestDayAmount > 0
                          ? clamp((day.amount / model.highestDayAmount) * 100, 10, 100)
                          : 10;

                      return (
                        <div key={day.short} className="flex flex-col items-center gap-1.5">
                          <div className="h-24 w-full max-w-[44px] rounded-md bg-emerald-100/90 dark:bg-emerald-500/20 flex items-end overflow-hidden">
                            <div
                              className={`w-full rounded-md ${isHighest ? 'bg-emerald-500' : 'bg-emerald-500/30'}`}
                              style={{ height: `${barHeight}%` }}
                            />
                          </div>
                          <p className="font-body text-[10px] uppercase tracking-[0.08em] text-emerald-800 dark:text-emerald-200">
                            {day.short}
                          </p>
                          <p className="font-body text-[10px] leading-tight text-center text-emerald-900 dark:text-emerald-100">
                            {formatPeso(day.amount)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </article>

                <article className="rounded-[12px] border-[0.5px] border-blue-300/80 dark:border-blue-500/30 bg-blue-50/75 dark:bg-blue-500/10 p-4">
                  <p className="font-body text-sm font-semibold text-blue-900 dark:text-blue-200">
                    Top category
                  </p>

                  {model.topCategory ? (
                    <div className="mt-2 space-y-1.5">
                      <p className="font-body text-xs uppercase tracking-[0.13em] text-blue-700 dark:text-blue-300/80">
                        {model.topCategory.category}
                      </p>
                      <p className="font-display text-2xl leading-tight text-blue-900 dark:text-blue-100">
                        {formatPeso(model.topCategory.amount)}
                      </p>
                      <p className="font-body text-sm text-blue-800 dark:text-blue-200/90">
                        {model.topCategory.percentage.toFixed(1)}% of monthly spend
                      </p>
                      <p className="font-body text-sm text-blue-800 dark:text-blue-200/90">
                        Avg transaction size: {formatPeso(model.topCategory.averageTransactionSize)}
                      </p>
                    </div>
                  ) : (
                    <p className="font-body mt-2 text-sm text-blue-800 dark:text-blue-200/90">
                      Add transactions this month to reveal category patterns.
                    </p>
                  )}
                </article>

                <article className="rounded-[12px] border-[0.5px] border-emerald-300/80 dark:border-emerald-500/30 bg-emerald-50/75 dark:bg-emerald-500/10 p-4">
                  <p className="font-body text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                    Financial Health Score
                  </p>

                  <div className="mt-3 flex items-center gap-4">
                    <div className="relative h-32 w-32 shrink-0">
                      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                        <circle
                          cx="60"
                          cy="60"
                          r="52"
                          fill="none"
                          strokeWidth="10"
                          className="text-emerald-200 dark:text-emerald-900"
                          stroke="currentColor"
                        />
                        <circle
                          cx="60"
                          cy="60"
                          r="52"
                          fill="none"
                          strokeWidth="10"
                          strokeLinecap="round"
                          className="text-emerald-500"
                          stroke="currentColor"
                          strokeDasharray={model.ringCircumference}
                          strokeDashoffset={model.ringOffset}
                        />
                      </svg>

                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <p className="font-display text-3xl leading-none text-emerald-900 dark:text-emerald-100">
                          {model.financialHealthScore}
                        </p>
                        <p className="font-body text-[10px] uppercase tracking-[0.1em] text-emerald-700 dark:text-emerald-300/80">
                          out of 100
                        </p>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="font-body text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                        {model.scoreLabel}
                      </p>
                      <p className="font-body text-sm text-emerald-800 dark:text-emerald-200/90 mt-1">
                        {model.scoreSummaryLine1}
                      </p>
                      <p className="font-body text-sm text-emerald-800 dark:text-emerald-200/90">
                        {model.scoreSummaryLine2}
                      </p>
                    </div>
                  </div>
                </article>
              </div>
            </section>
          )}

          {showSubscriptionsSection && (
            <section className="space-y-3">
              <p className={SECTION_LABEL_CLASS}>Subscriptions</p>

              {model.subscriptionTransactions.length === 0 ? (
                <p className="font-body text-sm text-zinc-500 dark:text-zinc-400">
                  No recurring or subscription-tagged transactions yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {model.subscriptionTransactions.map((tx, index) => {
                    const txDate = safeParseDate(tx.date);
                    const previousDate =
                      index > 0 ? safeParseDate(model.subscriptionTransactions[index - 1].date) : null;
                    const showDateHeader = index === 0 || (previousDate && !isSameDay(txDate, previousDate));
                    const annualCost = tx.amount * 12;

                    return (
                      <div key={tx.id} className="space-y-2">
                        {showDateHeader && (
                          <p className="font-body text-[11px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400 pt-1">
                            {format(txDate, 'MMM d').toUpperCase()}
                          </p>
                        )}

                        <article className="rounded-[12px] border-[0.5px] border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-900/75 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-body text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                {transactionLabel(tx)}
                              </p>
                              <div className="mt-1">
                                <PaymentMethodBadge method={tx.paymentMethod} />
                              </div>
                            </div>

                            <p className="font-display text-xl leading-tight text-zinc-900 dark:text-zinc-100">
                              {formatPeso(tx.amount)}
                            </p>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <div>
                              <p className="font-body text-[11px] uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                                Monthly cost
                              </p>
                              <p className="font-display text-lg text-zinc-900 dark:text-zinc-100">
                                {formatPeso(tx.amount)}
                              </p>
                            </div>
                            <div>
                              <p className="font-body text-[11px] uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                                Annual cost
                              </p>
                              <p className="font-display text-lg text-zinc-900 dark:text-zinc-100">
                                {formatPeso(annualCost)}
                              </p>
                            </div>
                          </div>

                          <p className="font-body mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                            This costs {formatPeso(annualCost)} per year.
                          </p>
                        </article>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
          </div>
        )}
      </div>

      <AddExpenseModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={() => {
          void fetchInsightsData(false);
        }}
      />
    </>
  );
}
