'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { BarChart3, CalendarDays } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AddExpenseModal from '@/components/AddExpenseModal';
import BerdeCard from '@/components/dashboard/BerdeCard';
import BerdeDrawer from '@/components/dashboard/BerdeDrawer';
import MiniBarChart from '@/components/dashboard/MiniBarChart';
import RemainingBudgetPopup from '@/components/dashboard/popups/RemainingBudgetPopup';
import SavingsRatePopup from '@/components/dashboard/popups/SavingsRatePopup';
import SpentThisMonthPopup from '@/components/dashboard/popups/SpentThisMonthPopup';
import SpentTodayPopup from '@/components/dashboard/popups/SpentTodayPopup';
import QuickStatTiles from '@/components/dashboard/QuickStatTiles';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import StatisticsPanel from '@/components/dashboard/StatisticsPanel';
import UpcomingCard from '@/components/dashboard/UpcomingCard';
import FloatingAddButton from '@/components/FloatingAddButton';
import { resolveBerdeState } from '@/lib/berde/berde.logic';
import { useBerdeInputs } from '@/lib/berde/useBerdeInputs';
import { getBerdeInsightsForMood, mapStateToMood } from '../../lib/berde-messages';
import { subscribeAppUpdates } from '@/lib/transaction-ws';
import type { DashboardData } from '@/lib/types';

interface DashboardClientPageProps {
  data: DashboardData;
  firstName: string;
}

type DailySpendingPoint = DashboardData['dailySpending'][number] & { date?: string };

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

export default function DashboardClientPage({ data, firstName }: DashboardClientPageProps) {
  const router = useRouter();
  const [statsOpen, setStatsOpen] = useState(false);
  const [berdeOpen, setBerdeOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSpentPopup, setShowSpentPopup] = useState(false);
  const [showRemainingPopup, setShowRemainingPopup] = useState(false);
  const [showSavingsPopup, setShowSavingsPopup] = useState(false);
  const [showTodayPopup, setShowTodayPopup] = useState(false);
  const [defaultCategory, setDefaultCategory] = useState<string | undefined>();

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const formattedDate = format(now, 'EEEE, MMMM d');
  const timeOfDay = getTimeOfDay(now);
  const safeFirstName = firstName.trim() || 'there';
  const monthOverview = format(now, 'MMMM yyyy');
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysUntilPayday = Math.max(0, daysInMonth - now.getDate());

  const overallBudget =
    data.budgetStatuses.find(
      (budget) => budget.category === 'Overall' && !budget.subCategory
    ) ?? data.budgetStatuses.find((budget) => budget.category === 'Overall');

  const spentThisMonth = overallBudget?.spent ?? 0;
  const remaining = overallBudget?.remaining ?? 0;
  const monthlyLimit = overallBudget?.limit ?? 0;

  const savingsRate =
    monthlyLimit > 0
      ? Math.round(((monthlyLimit - spentThisMonth) / monthlyLimit) * 100)
      : 0;

  const spentToday = data.recentTransactions
    .filter((transaction) => transaction.date.split('T')[0] === today)
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

  const berdeInputs = useBerdeInputs(data, data.recentTransactions, daysUntilPayday);
  const berdeContext = resolveBerdeState(berdeInputs);
  const mood = mapStateToMood(berdeContext.state);
  const berdeInsights = getBerdeInsightsForMood(mood, {
    budgetStatuses: data.budgetStatuses,
    transactions: data.recentTransactions,
    insights: data.insights,
  });
  const primaryBerdeInsight = berdeInsights[0] ?? {
    mood,
    type: 'fallback',
    message: berdeContext.quote,
    dataLine: berdeContext.triggerReason,
  };

  const refreshDashboard = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleCategorySelect = useCallback((category: string) => {
    setDefaultCategory(category);
    setShowAddModal(true);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeAppUpdates(() => {
      setShowSpentPopup(false);
      setShowRemainingPopup(false);
      setShowSavingsPopup(false);
      setShowTodayPopup(false);
      router.refresh();
    });

    return unsubscribe;
  }, [router]);

  return (
    <>
      <div className="dashboard-home min-h-screen">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 md:py-6">
          <section
            className={`transition-opacity duration-300 ${statsOpen ? 'hidden md:block' : 'block'}`}
            style={{ opacity: statsOpen ? 0.55 : 1 }}
          >
            <header className="mb-6">
              <div className="mb-3 flex items-center gap-2 md:hidden">
                <button
                  type="button"
                  onClick={() => setStatsOpen(true)}
                  className={`inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border-tertiary,#d9d7cf)] px-4 py-2 text-xs font-medium transition-colors ${
                    statsOpen
                      ? 'bg-[#1D9E75] text-white'
                      : 'bg-white text-zinc-700 hover:bg-[#E1F5EE]'
                  }`}
                >
                  <BarChart3 size={14} />
                  <span>Statistics</span>
                </button>

                <Link
                  href="/timeline"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white px-4 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  <CalendarDays size={14} />
                  <span>Calendar</span>
                </Link>
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
                    onClick={() => setStatsOpen(true)}
                    className={`inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border-tertiary,#d9d7cf)] px-4 py-2 text-xs font-medium transition-colors ${
                      statsOpen
                        ? 'bg-[#1D9E75] text-white'
                        : 'bg-white text-zinc-700 hover:bg-[#E1F5EE]'
                    }`}
                  >
                    <BarChart3 size={14} />
                    <span>Statistics</span>
                  </button>

                  <Link
                    href="/timeline"
                    className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white px-4 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                  >
                    <CalendarDays size={14} />
                    <span>Calendar</span>
                  </Link>
                </div>
              </div>
            </header>

            <div className="mt-4">
              <BerdeCard
                insight={primaryBerdeInsight}
                onClick={() => setBerdeOpen(true)}
              />
            </div>

            <div className="mt-4">
              <QuickStatTiles
                spentThisMonth={spentThisMonth}
                remaining={remaining}
                monthlyLimit={monthlyLimit}
                savingsRate={savingsRate}
                spentToday={spentToday}
                lastMonthSpent={data.totalSpentLastMonth}
                latestTransactionName={latestTransactionName}
                onSpentThisMonthTap={() => setShowSpentPopup(true)}
                onRemainingBudgetTap={() => setShowRemainingPopup(true)}
                onSavingsRateTap={() => setShowSavingsPopup(true)}
                onSpentTodayTap={() => setShowTodayPopup(true)}
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
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
        </div>
      </div>

      <BerdeDrawer
        isOpen={berdeOpen}
        onClose={() => setBerdeOpen(false)}
        berdeInsights={berdeInsights}
      />

      <div
        className={`${statsOpen ? 'hidden md:block' : 'block'} md:fixed md:bottom-6 md:z-20 md:transition-all md:duration-300 md:ease-in-out fab-shift-wrapper`}
        style={{ right: statsOpen ? 'calc(340px + 24px)' : '24px' }}
      >
        <FloatingAddButton
          onClick={() => {
            setDefaultCategory(undefined);
            setShowAddModal(true);
          }}
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

      <SavingsRatePopup
        open={showSavingsPopup}
        onClose={() => setShowSavingsPopup(false)}
        savingsRate={data.savingsRate ?? 0}
        firstName={firstName}
      />

      <SpentTodayPopup
        open={showTodayPopup}
        onClose={() => setShowTodayPopup(false)}
        recentTransactions={data.recentTransactions}
      />

      <style jsx global>{`
        @media (min-width: 768px) {
          .fab-shift-wrapper > div {
            position: static !important;
            right: 0 !important;
            bottom: 0 !important;
            z-index: auto !important;
          }
        }
      `}</style>
    </>
  );
}
