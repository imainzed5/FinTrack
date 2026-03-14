'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import type { DashboardData, MonthlySavings } from '@/lib/types';
import { StatsCards, BudgetProgress } from '@/components/DashboardWidgets';
import { CategoryPieChart, WeeklySpendingChart, DailySpendingChart, MonthlySavingsChart } from '@/components/Charts';
import InsightCards from '@/components/InsightCards';
import TransactionList from '@/components/TransactionList';
import FloatingAddButton from '@/components/FloatingAddButton';
import AddExpenseModal from '@/components/AddExpenseModal';
import { formatCurrency } from '@/lib/utils';

const SAVINGS_PER_PAGE = 12;

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [savings, setSavings] = useState<MonthlySavings[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [savingsPage, setSavingsPage] = useState(0); // 0 = most recent page

  const fetchDashboard = useCallback(async () => {
    try {
      const [res, savingsRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/savings'),
      ]);
      const json = await res.json();
      const savingsJson = await savingsRes.json();
      setData(json);
      setSavings(savingsJson);
    } catch {
      // offline
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Reset to most-recent page whenever savings data is refreshed
  useEffect(() => { setSavingsPage(0); }, [savings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen text-zinc-500">
        Unable to load dashboard. Check your connection.
      </div>
    );
  }

  // ── Savings pagination derived values ──────────────────────────────────────
  const totalSavingsPages = Math.max(1, Math.ceil(savings.length / SAVINGS_PER_PAGE));
  const clampedPage = Math.min(savingsPage, totalSavingsPages - 1);
  const savingsEnd = savings.length - clampedPage * SAVINGS_PER_PAGE;
  const savingsStart = Math.max(0, savingsEnd - SAVINGS_PER_PAGE);
  const pagedSavings = savings.slice(savingsStart, savingsEnd);
  const availableYears = [...new Set(savings.map((s) => s.month.slice(0, 4)))].sort().reverse();
  const jumpToYear = (year: string) => {
    let latestIdx = -1;
    savings.forEach((s, i) => { if (s.month.startsWith(year)) latestIdx = i; });
    if (latestIdx === -1) return;
    setSavingsPage(Math.floor((savings.length - 1 - latestIdx) / SAVINGS_PER_PAGE));
  };
  const pageRangeLabel = pagedSavings.length > 0
    ? (() => {
        const fmt = (mo: string) => {
          const [y, m] = mo.split('-');
          return new Date(Number(y), Number(m) - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
        };
        const f = pagedSavings[0].month;
        const l = pagedSavings[pagedSavings.length - 1].month;
        return f === l ? fmt(f) : `${fmt(f)} – ${fmt(l)}`;
      })()
    : '';
  // Year label shown inside each nav button so users know exactly where they'll land
  const olderPageYear = clampedPage < totalSavingsPages - 1
    ? (savings[Math.max(0, savingsStart - 1)]?.month.slice(0, 4) ?? savings[0]?.month.slice(0, 4) ?? '')
    : '';
  const newerPageYear = clampedPage > 0
    ? (savings[Math.min(savings.length - 1, savingsEnd + SAVINGS_PER_PAGE - 1)]?.month.slice(0, 4) ?? '')
    : '';

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {format(new Date(), 'MMMM yyyy')} Overview
          </p>
        </div>

        {/* Stats */}
        <StatsCards data={data} />

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">
              Spending by Category
            </h3>
            <CategoryPieChart data={data.categoryBreakdown} />
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">
              Weekly Spending Trend
            </h3>
            <WeeklySpendingChart data={data.weeklySpending} />
          </div>
        </div>

        {/* Budget + Daily Spending */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">
              Budget Progress
            </h3>
            <BudgetProgress budgets={data.budgetStatuses} />
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">
              Last 7 Days
            </h3>
            <DailySpendingChart data={data.dailySpending} />
          </div>
        </div>

        {/* Savings History */}
        <div className="mt-4 bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800">

          {/* Card header: title + all-time stats */}
          <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Monthly Savings History</h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                Bars = monthly saved vs spent · Line = cumulative total savings
              </p>
            </div>
            {savings.length > 0 && (() => {
              const total = savings[savings.length - 1].cumulative;
              const best = savings.reduce((b, s) => s.saved > b.saved ? s : b, savings[0]);
              const [by, bm] = best.month.split('-');
              const bestLabel = new Date(Number(by), Number(bm) - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
              const monthsWithSavings = savings.filter(s => s.saved > 0).length;
              const avgRate = savings.filter(s => s.budget > 0).reduce((sum, s) => sum + s.savingsRate, 0) /
                Math.max(1, savings.filter(s => s.budget > 0).length);
              return (
                <div className="flex gap-3 flex-wrap">
                  <div className="text-right">
                    <div className="text-xs text-zinc-400 dark:text-zinc-500">Total Saved</div>
                    <div className="text-base font-bold text-emerald-500">{formatCurrency(total)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-zinc-400 dark:text-zinc-500">Best Month</div>
                    <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{bestLabel}</div>
                    <div className="text-xs text-emerald-500">{formatCurrency(best.saved)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-zinc-400 dark:text-zinc-500">Avg Rate</div>
                    <div className="text-sm font-semibold text-indigo-500">{avgRate.toFixed(1)}%</div>
                    <div className="text-xs text-zinc-400 dark:text-zinc-500">{monthsWithSavings} months saved</div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Pagination controls */}
          {savings.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              {/* Left: year jump + range label */}
              <div className="flex items-center gap-2">
                <select
                  value=""
                  onChange={(e) => { if (e.target.value) jumpToYear(e.target.value); }}
                  aria-label="Jump to year"
                  className="text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="" disabled>Jump to year…</option>
                  {availableYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">{pageRangeLabel}</span>
              </div>

              {/* Right: page indicator + prev/next */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-zinc-400 dark:text-zinc-500 mr-0.5">
                  Page {clampedPage + 1} of {totalSavingsPages}
                </span>
                <button
                  onClick={() => setSavingsPage((p) => Math.min(p + 1, totalSavingsPages - 1))}
                  disabled={clampedPage >= totalSavingsPages - 1}
                  aria-label={`Go to ${olderPageYear}`}
                  title={`View ${olderPageYear}`}
                  className="px-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                >
                  ‹ {olderPageYear}
                </button>
                <button
                  onClick={() => setSavingsPage((p) => Math.max(p - 1, 0))}
                  disabled={clampedPage === 0}
                  aria-label={`Go to ${newerPageYear}`}
                  title={`View ${newerPageYear}`}
                  className="px-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                >
                  {newerPageYear} ›
                </button>
              </div>
            </div>
          )}

          {/* Chart — shows only the current page's 12 months */}
          <MonthlySavingsChart data={pagedSavings} />

          {/* Table */}
          {savings.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    <th className="text-left py-2 px-2 text-zinc-500 dark:text-zinc-400 font-medium">Month</th>
                    <th className="text-right py-2 px-2 text-zinc-500 dark:text-zinc-400 font-medium">Budget</th>
                    <th className="text-right py-2 px-2 text-zinc-500 dark:text-zinc-400 font-medium">Spent</th>
                    <th className="text-right py-2 px-2 text-zinc-500 dark:text-zinc-400 font-medium">Saved</th>
                    <th className="text-right py-2 px-2 text-zinc-500 dark:text-zinc-400 font-medium">Rate</th>
                    <th className="text-right py-2 px-2 text-indigo-400 font-medium">Cumulative</th>
                  </tr>
                </thead>
                <tbody>
                  {[...pagedSavings].reverse().map((s) => {
                    const [y, m] = s.month.split('-');
                    const label = new Date(Number(y), Number(m) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
                    const isNoBudget = s.budget === 0;
                    return (
                      <tr key={s.month} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                        <td className="py-2 px-2 text-zinc-700 dark:text-zinc-300 font-medium">{label}</td>
                        <td className="py-2 px-2 text-right text-zinc-500 dark:text-zinc-400">
                          {isNoBudget ? <span className="text-zinc-300 dark:text-zinc-600 italic">—</span> : formatCurrency(s.budget)}
                        </td>
                        <td className="py-2 px-2 text-right text-red-500">
                          {s.spent > 0 ? formatCurrency(s.spent) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                        </td>
                        <td className={`py-2 px-2 text-right font-semibold ${s.saved > 0 ? 'text-emerald-500' : isNoBudget ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400'}`}>
                          {s.saved > 0 ? formatCurrency(s.saved) : isNoBudget ? '—' : formatCurrency(0)}
                        </td>
                        <td className={`py-2 px-2 text-right ${
                          isNoBudget ? 'text-zinc-300 dark:text-zinc-600' :
                          s.savingsRate >= 20 ? 'text-emerald-500' :
                          s.savingsRate > 0 ? 'text-amber-500' : 'text-zinc-400'
                        }`}>
                          {isNoBudget ? '—' : `${s.savingsRate.toFixed(1)}%`}
                        </td>
                        <td className="py-2 px-2 text-right font-semibold text-indigo-500">
                          {formatCurrency(s.cumulative)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40">
                    <td colSpan={5} className="py-2 px-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 text-right">
                      Total Savings Accumulated (all time)
                    </td>
                    <td className="py-2 px-2 text-right font-bold text-emerald-500">
                      {formatCurrency(savings[savings.length - 1]?.cumulative ?? 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Bottom pagination for long tables */}
              {totalSavingsPages > 1 && (
                <div className="flex items-center justify-end gap-1.5 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 mr-1">
                    Page {clampedPage + 1} of {totalSavingsPages}
                  </span>
                  <button
                    onClick={() => setSavingsPage((p) => Math.min(p + 1, totalSavingsPages - 1))}
                    disabled={clampedPage >= totalSavingsPages - 1}
                    aria-label={`Go to ${olderPageYear}`}
                    title={`View ${olderPageYear}`}
                    className="px-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                  >
                    ‹ {olderPageYear}
                  </button>
                  <button
                    onClick={() => setSavingsPage((p) => Math.max(p - 1, 0))}
                    disabled={clampedPage === 0}
                    aria-label={`Go to ${newerPageYear}`}
                    title={`View ${newerPageYear}`}
                    className="px-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                  >
                    {newerPageYear} ›
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Insights + Recent Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">
              Financial Insights
            </h3>
            <InsightCards insights={data.insights} compact />
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">
              Recent Transactions
            </h3>
            <TransactionList transactions={data.recentTransactions} />
          </div>
        </div>
      </div>

      <FloatingAddButton onClick={() => setShowAddModal(true)} />
      <AddExpenseModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={fetchDashboard}
      />
    </>
  );
}
