'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDays,
  eachWeekOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from 'date-fns';
import type { Budget, Transaction, Insight, InsightType } from '@/lib/types';
import { InsightsSkeleton } from '@/components/SkeletonLoaders';
import { Lightbulb, BarChart2 } from 'lucide-react';
import { subscribeAppUpdates } from '@/lib/transaction-ws';
import AddExpenseModal from '@/components/AddExpenseModal';
import EmptyState from '@/components/EmptyState';
import InsightCards from '@/components/InsightCards';

const TABS = ['All', 'Alerts', 'Snapshot', 'Spending', 'Budget', 'Patterns'] as const;
type InsightsTab = (typeof TABS)[number];

const TAB_INSIGHT_TYPES: Record<string, InsightType[]> = {
  Alerts: ['spending_spike', 'budget_risk', 'week_comparison', 'category_drift', 'month_end_projection', 'subscription_creep'],
  Spending: ['spending_spike', 'week_comparison', 'weekend_vs_weekday', 'avg_transaction_size', 'category_drift', 'biggest_expense', 'category_concentration', 'payment_method_split'],
  Budget: ['budget_risk', 'budget_burn_rate', 'month_end_projection', 'essentials_ratio'],
  Patterns: ['pattern', 'no_spend_days', 'post_income_behavior', 'best_month_replay', 'savings_rate_trend', 'subscription', 'subscription_creep'],
};

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

const DAY_OF_WEEK_ORDER: Array<{ label: string; short: string; dayIndex: number }> = [
  { label: 'Monday', short: 'Mon', dayIndex: 1 },
  { label: 'Tuesday', short: 'Tue', dayIndex: 2 },
  { label: 'Wednesday', short: 'Wed', dayIndex: 3 },
  { label: 'Thursday', short: 'Thu', dayIndex: 4 },
  { label: 'Friday', short: 'Fri', dayIndex: 5 },
  { label: 'Saturday', short: 'Sat', dayIndex: 6 },
  { label: 'Sunday', short: 'Sun', dayIndex: 0 },
];

const ZONE_LABEL_CLASS =
  'text-[11px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3';

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

export default function InsightsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<InsightsTab>('All');

  const openAddTransactionModal = useCallback(() => {
    setShowAddModal(true);
  }, []);

  const fetchInsightsData = useCallback(async (showLoader: boolean) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const [transactionsRes, budgetsRes, insightsRes] = await Promise.all([
        fetch('/api/transactions'),
        fetch('/api/budgets'),
        fetch('/api/insights'),
      ]);

      if (!transactionsRes.ok || !budgetsRes.ok || !insightsRes.ok) {
        throw new Error('Failed to load insights data.');
      }

      const [transactionsJson, budgetsJson, insightsJson] = await Promise.all([
        transactionsRes.json() as Promise<Transaction[]>,
        budgetsRes.json() as Promise<Budget[]>,
        insightsRes.json() as Promise<Insight[]>,
      ]);

      setTransactions(Array.isArray(transactionsJson) ? transactionsJson : []);
      setBudgets(Array.isArray(budgetsJson) ? budgetsJson : []);
      setInsights(Array.isArray(insightsJson) ? insightsJson : []);
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
      .filter((tx) => tx.date.startsWith(currentMonth) && tx.type === 'expense' && !tx.transferGroupId)
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
      savingsRate,
      financialHealthScore,
      scoreLabel,
      scoreSummaryLine1,
      scoreSummaryLine2,
      ringCircumference,
      ringOffset,
    };
  }, [transactions, budgets]);
  const showInsightsEmptyState = transactions.length === 0 && !error;
  const currentMonthTransactionCount = useMemo(() => {
    const month = format(new Date(), 'yyyy-MM');
    return transactions.filter((tx) => tx.date.startsWith(month)).length;
  }, [transactions]);

  const visibleInsights = useMemo(() => {
    if (activeTab === 'All' || activeTab === 'Snapshot' || activeTab === 'Alerts') {
      return insights;
    }

    const allowed = TAB_INSIGHT_TYPES[activeTab] ?? [];
    return insights.filter((insight) => allowed.includes(insight.insightType));
  }, [activeTab, insights]);

  const urgentInsights = useMemo(
    () => visibleInsights.filter((insight) => insight.severity === 'warning' || insight.severity === 'critical'),
    [visibleInsights]
  );

  const infoInsights = useMemo(
    () => visibleInsights.filter((insight) => insight.severity === 'info'),
    [visibleInsights]
  );

  const zoneNeedsAttentionVisible = urgentInsights.length > 0;
  const zoneSnapshotVisible = activeTab === 'All' || activeTab === 'Snapshot';
  const zoneDeeperVisible = activeTab !== 'Snapshot' && infoInsights.length > 0;

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
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-[13px] px-4 py-1.5 rounded-full cursor-pointer transition-colors ${
                activeTab === tab
                  ? 'bg-[#1D9E75] text-white border-[#1D9E75]'
                  : 'border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
              }`}
            >
              {tab}
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

            {zoneNeedsAttentionVisible && (
              <section>
                <p className={ZONE_LABEL_CLASS}>Needs attention</p>
                <InsightCards insights={urgentInsights} transactionCount={currentMonthTransactionCount} />
              </section>
            )}

            {zoneNeedsAttentionVisible && (zoneSnapshotVisible || zoneDeeperVisible) && (
              <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-6" />
            )}

            {zoneSnapshotVisible && (
              <section>
                <p className={ZONE_LABEL_CLASS}>This month at a glance</p>
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

            {zoneSnapshotVisible && zoneDeeperVisible && (
              <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-6" />
            )}

            {zoneDeeperVisible && (
              <section>
                <p className={ZONE_LABEL_CLASS}>Deeper insights</p>
                <InsightCards insights={infoInsights} transactionCount={currentMonthTransactionCount} />
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
