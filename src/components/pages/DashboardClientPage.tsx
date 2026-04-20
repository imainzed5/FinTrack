'use client';

import Link from 'next/link';
import { differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns';
import { AlertTriangle, BarChart3, CalendarDays, Settings } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AddExpenseModal from '@/components/AddExpenseModal';
import BerdeCard from '@/components/dashboard/BerdeCard';
import BerdeDrawer from '@/components/dashboard/BerdeDrawer';
import CalendarPanel from '@/components/dashboard/CalendarPanel';
import DashboardNextActions from '@/components/dashboard/DashboardNextActions';
import DesktopQuickActions from '@/components/dashboard/DesktopQuickActions';
import MiniBarChart from '@/components/dashboard/MiniBarChart';
import PaydayCountdownCard from '@/components/dashboard/PaydayCountdownCard';
import RemainingBudgetPopup from '@/components/dashboard/popups/RemainingBudgetPopup';
import SavingsGoalsDashboardCard from '@/components/dashboard/SavingsGoalsDashboardCard';
import SavingsGoalsRailCard from '@/components/dashboard/SavingsGoalsRailCard';
import SpentThisMonthPopup from '@/components/dashboard/popups/SpentThisMonthPopup';
import SpentTodayPopup from '@/components/dashboard/popups/SpentTodayPopup';
import QuickStatTiles from '@/components/dashboard/QuickStatTiles';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import StatisticsPanel from '@/components/dashboard/StatisticsPanel';
import UpcomingCard from '@/components/dashboard/UpcomingCard';
import FloatingAddButton from '@/components/FloatingAddButton';
import { resolveBerdeState } from '@/lib/berde/berde.logic';
import { useBerdeInputs } from '@/lib/berde/useBerdeInputs';
import { getBerdeInsightsForContext } from '../../lib/berde-messages';
import { getBudgetLabel } from '@/lib/budgeting';
import { isSyncStateRealtimeUpdate, subscribeAppUpdates } from '@/lib/transaction-ws';
import { getDashboardData, getLocalUserSettings, getSavingsGoalsSummary } from '@/lib/local-store';
import { formatCurrency, getTodayDateKeyInManila } from '@/lib/utils';
import { useAppSession } from '@/components/AppSessionProvider';
import { DashboardSkeleton } from '@/components/SkeletonLoaders';
import type { DashboardData, SavingsGoalsSummary } from '@/lib/types';

type DailySpendingPoint = DashboardData['dailySpending'][number] & { date?: string };

const EMPTY_MONTH_KEY = format(new Date(), 'yyyy-MM');

const EMPTY_DASHBOARD_DATA: DashboardData = {
  totalIncomeThisMonth: 0,
  totalSpentThisMonth: 0,
  totalSpentLastMonth: 0,
  netThisMonth: 0,
  totalBalance: 0,
  remainingBudget: 0,
  monthlyBudget: 0,
  savingsRate: 0,
  expenseGrowthRate: 0,
  budgetStatuses: [],
  budgetAlerts: [],
  budgetSummary: {
    month: EMPTY_MONTH_KEY,
    hasOverallBudget: false,
    overallConfiguredLimit: 0,
    overallEffectiveLimit: 0,
    additiveCategoryPlannedTotal: 0,
    scopedBudgetCount: 0,
    rolloverEnabledCount: 0,
    overlapCount: 0,
    atRiskCount: 0,
    criticalCount: 0,
    uncoveredSpendTotal: 0,
    uncoveredCategories: [],
    topUncoveredCategory: null,
    hasPlanningMismatch: false,
    planningMismatchAmount: 0,
  },
  budgetSignals: {
    topRiskBudget: null,
    topUncoveredCategory: null,
    hasPlanningMismatch: false,
    planningMismatchAmount: 0,
  },
  categoryBreakdown: [],
  weeklySpending: [],
  dailySpending: [],
  calendarSpending: [],
  calendarTransactions: [],
  calendarRange: {
    minMonth: EMPTY_MONTH_KEY,
    maxMonth: EMPTY_MONTH_KEY,
  },
  currentMonthTransactions: [],
  upcomingRecurringTransactions: [],
  recentTransactions: [],
  insights: [],
  berdeMemory: {
    hasHistory: false,
    isNewMonthWindow: false,
    trackedMonthCount: 0,
    lifetimeTransactionCount: 0,
    previousMonth: null,
    previousMonthSpent: 0,
    previousMonthSaved: 0,
    previousMonthSavingsRate: 0,
    previousMonthTransactionCount: 0,
    previousMonthStatus: 'none',
    rolling30DaySpend: 0,
    rolling90DayAverageSpend: 0,
    spendTrend: 'none',
    savingsTrend: 'none',
    savingsStreakMonths: 0,
  },
};

function deriveFirstName(value: string): string {
  const normalized = value.includes('@') ? value.split('@')[0] : value;
  const firstToken = normalized.trim().split(/\s+/)[0];
  return firstToken || 'there';
}

function getTimeOfDay(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function normalizeDateKey(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const dateKey = value.split('T')[0];
  const timestamp = new Date(dateKey).getTime();
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return dateKey;
}

function parseDateOnly(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return startOfDay(parsed);
}

export default function DashboardClientPage() {
  const { viewer } = useAppSession();
  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD_DATA);
  const [loading, setLoading] = useState(true);
  const [statsOpen, setStatsOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [berdeOpen, setBerdeOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSpentPopup, setShowSpentPopup] = useState(false);
  const [showRemainingPopup, setShowRemainingPopup] = useState(false);
  const [showTodayPopup, setShowTodayPopup] = useState(false);
  const [showSavingsGoalsPopup, setShowSavingsGoalsPopup] = useState(false);
  const [savingsSummary, setSavingsSummary] = useState<SavingsGoalsSummary | null>(null);
  const [savingsLoading, setSavingsLoading] = useState(true);
  const [nextPayday, setNextPayday] = useState<string | null>(null);
  const [defaultCategory, setDefaultCategory] = useState<string | undefined>();
  const [defaultEntryType, setDefaultEntryType] = useState<'expense' | 'income'>('expense');

  const now = new Date();
  const today = getTodayDateKeyInManila();
  const formattedDate = format(now, 'EEEE, MMMM d');
  const timeOfDay = getTimeOfDay(now);
  const firstName = deriveFirstName(viewer.displayName);
  const userId = viewer.id;
  const safeFirstName = firstName.trim() || 'there';
  const monthOverview = format(now, 'MMMM yyyy');
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const isAnyPanelOpen = statsOpen || calendarOpen;
  const nextPaydayDate = parseDateOnly(nextPayday);
  const monthEndFallback = Math.max(0, daysInMonth - now.getDate());
  const paydayOffsetDays = nextPaydayDate
    ? differenceInCalendarDays(nextPaydayDate, startOfDay(now))
    : null;
  const daysUntilPayday = paydayOffsetDays === null ? monthEndFallback : Math.max(paydayOffsetDays, 0);

  const overallBudget =
    data.budgetStatuses.find(
      (budget) => budget.category === 'Overall' && !budget.subCategory
    ) ?? data.budgetStatuses.find((budget) => budget.category === 'Overall');

  const spentThisMonth = overallBudget?.spent ?? 0;
  const remaining = overallBudget?.remaining ?? 0;
  const strictCap = overallBudget?.configuredLimit ?? data.budgetSummary.overallConfiguredLimit ?? 0;
  const needsFirstTransaction = data.recentTransactions.length === 0;
  const needsBudget = !overallBudget;
  const needsSavingsGoal = (savingsSummary?.activeGoalCount ?? 0) === 0;
  const shouldShowNextActions = needsFirstTransaction || (data.currentMonthTransactions.length < 5 && (needsBudget || needsSavingsGoal));

  const spentToday = data.recentTransactions
    .filter(
      (transaction) => normalizeDateKey(transaction.date) === today && transaction.type === 'expense'
    )
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const last7Days = [...(data.dailySpending as DailySpendingPoint[])]
    .map((point, index) => {
      const numericAmount = Number(point.amount);
      const amount = Number.isFinite(numericAmount) ? numericAmount : 0;
      const dateKey = normalizeDateKey(point.date);
      const sortValue = dateKey ? new Date(dateKey).getTime() : index;

      return {
        day: point.day,
        amount,
        date: dateKey ?? undefined,
        sortValue,
      };
    })
    .sort((a, b) => a.sortValue - b.sortValue)
    .slice(-7)
    .map((point) => ({
      day: point.day,
      amount: point.amount,
      date: point.date,
    }));

  const upcoming = data.upcomingRecurringTransactions;

  const latestTransactionName = (() => {
    const transaction = data.recentTransactions[0];
    if (!transaction) {
      return 'No recent transaction yet';
    }

    return (
      transaction.merchant ||
      transaction.description ||
      transaction.notes ||
      transaction.category
    );
  })();

  const topCategories = useMemo(() => {
    const frequencies: Record<string, number> = {};

    data.recentTransactions
      .filter((tx) => tx.type !== 'income')
      .forEach((tx) => {
        frequencies[tx.category] = (frequencies[tx.category] || 0) + 1;
      });

    const sorted = Object.entries(frequencies)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([category]) => category);

    return sorted.length > 0
      ? sorted
      : ['Food', 'Transport', 'Shopping', 'Entertainment', 'Bills'];
  }, [data.recentTransactions]);

  const berdeInputs = useBerdeInputs(data, data.currentMonthTransactions, daysUntilPayday);
  const berdeContext = resolveBerdeState(berdeInputs, userId);
  const berdeInsights = getBerdeInsightsForContext(berdeContext, {
    budgetStatuses: data.budgetStatuses,
    transactions: data.currentMonthTransactions,
    insights: data.insights,
    berdeMemory: data.berdeMemory,
    budgetSignals: data.budgetSignals,
  });
  const hasBerdeThoughts = berdeInsights.length > 0;
  const primaryBerdeInsight = berdeInsights[0] ?? {
    mood: 'dry' as const,
    type: 'studying',
    message: "Berde's still studying your habits.",
    boldPhrase: 'Log a few more transactions and the patterns will start to show.',
    dataLine: 'Fresh device data is still building up',
  };

  const refreshDashboard = useCallback(async () => {
    const [dashboard, summary, userSettings] = await Promise.all([
      getDashboardData(),
      getSavingsGoalsSummary(),
      getLocalUserSettings(),
    ]);
    setData(dashboard);
    setSavingsSummary(summary);
    setNextPayday(userSettings.nextPayday);
    setLoading(false);
    setSavingsLoading(false);
  }, []);

  const handleCategorySelect = useCallback((category: string) => {
    setDefaultCategory(category);
    setDefaultEntryType('expense');
    setShowAddModal(true);
  }, []);

  const handleAddExpense = useCallback(() => {
    setDefaultCategory(undefined);
    setDefaultEntryType('expense');
    setShowAddModal(true);
  }, []);

  const handleAddIncome = useCallback(() => {
    setDefaultCategory(undefined);
    setDefaultEntryType('income');
    setShowAddModal(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getDashboardData(), getSavingsGoalsSummary(), getLocalUserSettings()])
      .then(([dashboard, summary, userSettings]) => {
        if (cancelled) {
          return;
        }

        setData(dashboard);
        setSavingsSummary(summary);
        setNextPayday(userSettings.nextPayday);
        setLoading(false);
        setSavingsLoading(false);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setData(EMPTY_DASHBOARD_DATA);
        setSavingsSummary({ goals: [], totalSaved: 0, activeGoalCount: 0, savingsRate: 0 });
        setNextPayday(null);
        setLoading(false);
        setSavingsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeAppUpdates((message) => {
      if (isSyncStateRealtimeUpdate(message)) {
        return;
      }

      setShowSpentPopup(false);
      setShowRemainingPopup(false);
      setShowSavingsGoalsPopup(false);
      setShowTodayPopup(false);
      void refreshDashboard();
    });

    return unsubscribe;
  }, [refreshDashboard]);

  useEffect(() => {
    const isAnyOpen = statsOpen || calendarOpen;

    if (isAnyOpen) {
      document.body.classList.add('panel-open');
    } else {
      document.body.classList.remove('panel-open');
    }

    return () => {
      document.body.classList.remove('panel-open');
    };
  }, [statsOpen, calendarOpen]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <>
      <div className="dashboard-home min-h-screen">
        <div className="w-full px-4 py-5 sm:px-6 md:py-6 xl:px-8">
          <section
            className={`transition-opacity duration-300 ${isAnyPanelOpen ? 'hidden md:block' : 'block'}`}
            style={{ opacity: isAnyPanelOpen ? 0.55 : 1 }}
          >
            <header className="mb-6">
              <div className="mb-3 flex items-center gap-2 md:hidden">
                <button
                  type="button"
                  onClick={() => {
                    setCalendarOpen(false);
                    setStatsOpen((prev) => !prev);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border-tertiary,#d9d7cf)] px-4 py-2 text-xs font-medium transition-colors ${
                    statsOpen
                      ? 'border-[#1D9E75] bg-[#1D9E75] text-white'
                      : 'bg-white text-zinc-700 hover:bg-[#E1F5EE]'
                  }`}
                >
                  <BarChart3 size={14} />
                  <span>Statistics</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStatsOpen(false);
                    setCalendarOpen((prev) => !prev);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium transition-colors ${
                    calendarOpen
                      ? 'border-[#1D9E75] bg-[#1D9E75] text-white'
                      : 'border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white text-zinc-700 hover:bg-[#E1F5EE]'
                  }`}
                >
                  <CalendarDays size={14} />
                  <span>Calendar</span>
                </button>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="mb-1 text-xs uppercase tracking-widest text-zinc-500">
                    {formattedDate}
                  </p>
                  <h1 className="truncate font-display text-2xl font-semibold leading-tight text-zinc-900 md:text-3xl">
                    Good {timeOfDay}, {safeFirstName}!
                  </h1>
                  <p className="mt-1 text-xs text-zinc-500">{monthOverview} Overview</p>
                </div>

                <div className="mt-1 shrink-0">
                  <Link
                    href="/settings"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white text-zinc-700 shadow-[0_10px_24px_rgba(36,31,22,0.05)] transition-colors hover:border-[#1D9E75] hover:bg-[#E1F5EE] hover:text-[#1D9E75] md:hidden"
                    aria-label="Open settings"
                  >
                    <Settings size={18} />
                  </Link>
                </div>

                <div className="mt-1 hidden shrink-0 items-center gap-2 md:flex">
                  <button
                    type="button"
                    onClick={() => {
                      setCalendarOpen(false);
                      setStatsOpen((prev) => !prev);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border-tertiary,#d9d7cf)] px-4 py-2 text-xs font-medium transition-colors ${
                      statsOpen
                        ? 'border-[#1D9E75] bg-[#1D9E75] text-white'
                        : 'bg-white text-zinc-700 hover:bg-[#E1F5EE]'
                    }`}
                  >
                    <BarChart3 size={14} />
                    <span>Statistics</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStatsOpen(false);
                      setCalendarOpen((prev) => !prev);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium transition-colors ${
                      calendarOpen
                        ? 'border-[#1D9E75] bg-[#1D9E75] text-white'
                        : 'border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white text-zinc-700 hover:bg-[#E1F5EE]'
                    }`}
                  >
                    <CalendarDays size={14} />
                    <span>Calendar</span>
                  </button>
                </div>
              </div>
            </header>

            <div className="mt-4">
              <BerdeCard
                insight={primaryBerdeInsight}
                quote={berdeContext.quote}
                hasThoughts={hasBerdeThoughts}
                footerHint="Tap to read Berde's thoughts and jump into chat"
                ariaLabel="Open Berde insights drawer"
                onClick={() => setBerdeOpen(true)}
              />
            </div>

            <div className="mt-4 animate-fade-up" style={{ animationDelay: '0.05s' }}>
              <QuickStatTiles
                totalBalance={data.totalBalance}
                totalIncomeThisMonth={data.totalIncomeThisMonth}
                spentThisMonth={spentThisMonth}
                remaining={remaining}
                monthlyLimit={strictCap}
                spentToday={spentToday}
                netThisMonth={data.netThisMonth}
                savingsTotalSaved={savingsSummary?.totalSaved ?? 0}
                savingsActiveGoalCount={savingsSummary?.activeGoalCount ?? 0}
                savingsLoading={savingsLoading}
                lastMonthSpent={data.totalSpentLastMonth}
                latestTransactionName={latestTransactionName}
                onSpentThisMonthTap={() => setShowSpentPopup(true)}
                onRemainingBudgetTap={() => setShowRemainingPopup(true)}
                onSpentTodayTap={() => setShowTodayPopup(true)}
                onSavingsGoalsTap={() => setShowSavingsGoalsPopup(true)}
              />
            </div>

            {(
              data.budgetSignals.hasPlanningMismatch ||
              data.budgetSignals.topRiskBudget ||
              data.budgetSignals.topUncoveredCategory
            ) ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {data.budgetSignals.hasPlanningMismatch ? (
                  <Link
                    href={`/budgets?month=${format(now, 'yyyy-MM')}`}
                    className="rounded-2xl border-0 bg-amber-50/90 p-4 transition-colors hover:bg-amber-50"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                      Plan mismatch
                    </p>
                    <p className="mt-2 text-sm font-semibold text-zinc-900">
                      Category plans are {formatCurrency(data.budgetSignals.planningMismatchAmount)} over the Overall cap.
                    </p>
                    <p className="mt-1 text-sm leading-6 text-zinc-600">
                      Review this month&apos;s budget workspace before the plan drifts further.
                    </p>
                  </Link>
                ) : null}

                {data.budgetSignals.topRiskBudget ? (
                  <Link
                    href={`/budgets?month=${format(now, 'yyyy-MM')}`}
                    className="rounded-2xl border-0 bg-white p-4 transition-colors hover:bg-[#fbf8f1]"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      Top budget risk
                    </p>
                    <p className="mt-2 text-sm font-semibold text-zinc-900">
                      {getBudgetLabel(data.budgetSignals.topRiskBudget)}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-zinc-600">
                      {Math.round(data.budgetSignals.topRiskBudget.percentage)}% used with{' '}
                      {formatCurrency(data.budgetSignals.topRiskBudget.remaining)} remaining.
                    </p>
                  </Link>
                ) : null}

              </div>
            ) : null}

            {data.budgetSignals.topUncoveredCategory ? (
              <Link
                href={`/budgets?month=${format(now, 'yyyy-MM')}`}
                className="mt-4 flex items-start gap-3 rounded-2xl border-0 bg-amber-50/80 px-4 py-3 text-sm transition-colors hover:bg-amber-50"
              >
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-amber-600">
                  <AlertTriangle size={16} />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-900">
                    {data.budgetSignals.topUncoveredCategory.category} has uncovered spend
                  </p>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">
                    {formatCurrency(data.budgetSignals.topUncoveredCategory.amount)} this month has no
                    category guardrail yet.
                  </p>
                </div>
              </Link>
            ) : null}

            {showSavingsGoalsPopup && (
              <SavingsGoalsDashboardCard
                open={showSavingsGoalsPopup}
                onClose={() => setShowSavingsGoalsPopup(false)}
                summary={savingsSummary}
              />
            )}

            <div className="mt-4 animate-fade-up md:flex md:items-start md:gap-6" style={{ animationDelay: '0.1s' }}>
              <div className="min-w-0 flex-1 space-y-4">
                <div className="grid grid-cols-1 gap-4 min-[1180px]:grid-cols-2 min-[1180px]:items-stretch">
                  <MiniBarChart
                    dailySpending={last7Days}
                    className="h-full"
                    tallOnDesktop
                  />
                  <UpcomingCard transactions={upcoming} className="h-full" />
                </div>

                <div className="hidden md:block">
                  <PaydayCountdownCard
                    nextPaydayDate={nextPaydayDate}
                    daysUntilPayday={paydayOffsetDays}
                    remainingBudget={remaining}
                  />
                </div>

                {shouldShowNextActions ? (
                  <div className="hidden md:block">
                    <DashboardNextActions
                      needsFirstTransaction={needsFirstTransaction}
                      needsBudget={needsBudget}
                      needsSavingsGoal={needsSavingsGoal}
                      onAddExpense={handleAddExpense}
                    />
                  </div>
                ) : null}

                <div className="md:hidden">
                  <RecentTransactions transactions={data.recentTransactions} />
                </div>
              </div>

              <aside className="hidden md:block md:w-[300px] md:flex-shrink-0">
                <div className="md:sticky md:top-6 md:flex md:h-[calc(100vh-7.5rem)] md:flex-col md:gap-3">
                  <RecentTransactions
                    transactions={data.recentTransactions}
                    limit={8}
                    listClassName="max-h-[420px] overflow-y-auto pr-1"
                  />
                  <DesktopQuickActions
                    onAddExpense={handleAddExpense}
                    onAddIncome={handleAddIncome}
                  />
                  <SavingsGoalsRailCard summary={savingsSummary} loading={savingsLoading} />
                </div>
              </aside>
            </div>
          </section>

          <StatisticsPanel
            isOpen={statsOpen}
            onClose={() => setStatsOpen(false)}
            budgetStatuses={data.budgetStatuses}
            budgetAlerts={data.budgetAlerts}
            categoryBreakdown={data.categoryBreakdown}
            weeklySpending={data.weeklySpending}
            recentTransactions={data.recentTransactions}
          />

          <CalendarPanel
            isOpen={calendarOpen}
            onClose={() => setCalendarOpen(false)}
            calendarSpending={data.calendarSpending}
            calendarTransactions={data.calendarTransactions}
            calendarRange={data.calendarRange}
          />
        </div>
      </div>

      <BerdeDrawer
        isOpen={berdeOpen}
        onClose={() => setBerdeOpen(false)}
        berdeInsights={berdeInsights}
      />

      <div
        className={`${isAnyPanelOpen ? 'hidden' : 'block'} md:hidden`}
      >
        <FloatingAddButton
          onClick={handleAddExpense}
          compactOnMobile
          topCategories={topCategories}
          onCategorySelect={handleCategorySelect}
        />
      </div>

      <AddExpenseModal
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setDefaultCategory(undefined);
          setDefaultEntryType('expense');
        }}
        onAdded={refreshDashboard}
        defaultCategory={defaultCategory}
        defaultEntryType={defaultEntryType}
      />

      <SpentThisMonthPopup
        open={showSpentPopup}
        onClose={() => setShowSpentPopup(false)}
        categoryBreakdown={data.categoryBreakdown}
        dailySpending={data.dailySpending}
      />

      <RemainingBudgetPopup
        open={showRemainingPopup}
        onClose={() => setShowRemainingPopup(false)}
        overallBudget={data.budgetStatuses.find((budget) => budget.category === 'Overall')!}
      />

      <SpentTodayPopup
        open={showTodayPopup}
        onClose={() => setShowTodayPopup(false)}
        recentTransactions={data.recentTransactions}
      />
    </>
  );
}
