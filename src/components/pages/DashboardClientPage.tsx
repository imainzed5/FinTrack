'use client';

import { format } from 'date-fns';
import { BarChart3, CalendarDays } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AddExpenseModal from '@/components/AddExpenseModal';
import BerdeCard from '@/components/dashboard/BerdeCard';
import BerdeDrawer from '@/components/dashboard/BerdeDrawer';
import CalendarPanel from '@/components/dashboard/CalendarPanel';
import MiniBarChart from '@/components/dashboard/MiniBarChart';
import RemainingBudgetPopup from '@/components/dashboard/popups/RemainingBudgetPopup';
import SavingsGoalsDashboardCard from '@/components/dashboard/SavingsGoalsDashboardCard';
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
import { isSyncStateRealtimeUpdate, subscribeAppUpdates } from '@/lib/transaction-ws';
import { getDashboardData, getSavingsGoalsSummary } from '@/lib/local-store';
import { getTodayDateKeyInManila } from '@/lib/utils';
import { useAppSession } from '@/components/AppSessionProvider';
import { DashboardSkeleton } from '@/components/SkeletonLoaders';
import type { DashboardData, SavingsGoalsSummary } from '@/lib/types';

type DailySpendingPoint = DashboardData['dailySpending'][number] & { date?: string };

const EMPTY_MONTH_KEY = format(new Date(), 'yyyy-MM');

const EMPTY_DASHBOARD_DATA: DashboardData = {
  totalSpentThisMonth: 0,
  totalSpentLastMonth: 0,
  totalBalance: 0,
  remainingBudget: 0,
  monthlyBudget: 0,
  savingsRate: 0,
  expenseGrowthRate: 0,
  budgetStatuses: [],
  budgetAlerts: [],
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

export default function DashboardClientPage() {
  const { viewer } = useAppSession();
  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD_DATA);
  const [loading, setLoading] = useState(true);
  const [statsOpen, setStatsOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarExpanded] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      return window.localStorage.getItem('moneda-calendar-expanded') === 'true';
    } catch {
      return false;
    }
  });
  const [berdeOpen, setBerdeOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSpentPopup, setShowSpentPopup] = useState(false);
  const [showRemainingPopup, setShowRemainingPopup] = useState(false);
  const [showTodayPopup, setShowTodayPopup] = useState(false);
  const [showSavingsGoalsPopup, setShowSavingsGoalsPopup] = useState(false);
  const [savingsSummary, setSavingsSummary] = useState<SavingsGoalsSummary | null>(null);
  const [savingsLoading, setSavingsLoading] = useState(true);
  const [defaultCategory, setDefaultCategory] = useState<string | undefined>();

  const now = new Date();
  const today = getTodayDateKeyInManila();
  const formattedDate = format(now, 'EEEE, MMMM d');
  const timeOfDay = getTimeOfDay(now);
  const firstName = deriveFirstName(viewer.displayName);
  const userId = viewer.id;
  const safeFirstName = firstName.trim() || 'there';
  const monthOverview = format(now, 'MMMM yyyy');
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysUntilPayday = Math.max(0, daysInMonth - now.getDate());
  const isAnyPanelOpen = statsOpen || calendarOpen;
  const fabRight = isAnyPanelOpen
    ? calendarOpen && calendarExpanded
      ? 'calc(560px + 24px)'
      : 'calc(340px + 24px)'
    : '24px';

  const overallBudget =
    data.budgetStatuses.find(
      (budget) => budget.category === 'Overall' && !budget.subCategory
    ) ?? data.budgetStatuses.find((budget) => budget.category === 'Overall');

  const spentThisMonth = overallBudget?.spent ?? 0;
  const remaining = overallBudget?.remaining ?? 0;
  const strictCap = overallBudget?.baseLimit ?? overallBudget?.limit ?? 0;

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

  const upcoming = data.recentTransactions.filter((transaction) =>
    Boolean(transaction.recurring)
  );

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
    const [dashboard, summary] = await Promise.all([
      getDashboardData(),
      getSavingsGoalsSummary(),
    ]);
    setData(dashboard);
    setSavingsSummary(summary);
    setLoading(false);
    setSavingsLoading(false);
  }, []);

  const handleCategorySelect = useCallback((category: string) => {
    setDefaultCategory(category);
    setShowAddModal(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getDashboardData(), getSavingsGoalsSummary()])
      .then(([dashboard, summary]) => {
        if (cancelled) {
          return;
        }

        setData(dashboard);
        setSavingsSummary(summary);
        setLoading(false);
        setSavingsLoading(false);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setData(EMPTY_DASHBOARD_DATA);
        setSavingsSummary({ goals: [], totalSaved: 0, activeGoalCount: 0, savingsRate: 0 });
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
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 md:py-6">
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
                onClick={() => setBerdeOpen(true)}
              />
            </div>

            <div className="mt-4 animate-fade-up" style={{ animationDelay: '0.05s' }}>
              <QuickStatTiles
                totalBalance={data.totalBalance}
                spentThisMonth={spentThisMonth}
                remaining={remaining}
                monthlyLimit={strictCap}
                spentToday={spentToday}
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

            {showSavingsGoalsPopup && (
              <SavingsGoalsDashboardCard
                open={showSavingsGoalsPopup}
                onClose={() => setShowSavingsGoalsPopup(false)}
                summary={savingsSummary}
              />
            )}

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 animate-fade-up" style={{ animationDelay: '0.1s' }}>
              <div className="space-y-4">
                <MiniBarChart dailySpending={last7Days} />
                <UpcomingCard transactions={upcoming} />
              </div>

              <RecentTransactions transactions={data.recentTransactions} />
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
        className={`${isAnyPanelOpen ? 'hidden md:block' : 'block'} md:fixed md:bottom-6 md:z-[20] md:transition-all md:duration-300 md:ease-in-out fab-shift-wrapper`}
        style={{ right: fabRight }}
      >
        <FloatingAddButton
          onClick={() => {
            setDefaultCategory(undefined);
            setShowAddModal(true);
          }}
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
        }}
        onAdded={refreshDashboard}
        defaultCategory={defaultCategory}
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

      <style jsx global>{`
        @media (min-width: 768px) {
          .fab-shift-wrapper > div {
            position: relative !important;
            right: 0 !important;
            bottom: 0 !important;
            z-index: 50 !important;
          }
        }
      `}</style>
    </>
  );
}
