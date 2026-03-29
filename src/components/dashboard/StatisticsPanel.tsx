'use client';

import { useEffect, useRef } from 'react';
import {
  ArcElement,
  Chart as ChartJS,
  Legend,
  type TooltipItem,
  Tooltip,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { X } from 'lucide-react';
import type { BudgetStatus, DashboardData, Transaction } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import type { Plugin } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface StatisticsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  budgetStatuses: BudgetStatus[];
  budgetAlerts?: DashboardData['budgetAlerts'];
  categoryBreakdown: DashboardData['categoryBreakdown'];
  weeklySpending: DashboardData['weeklySpending'];
  recentTransactions?: Transaction[];
}

interface SummaryTileProps {
  label: string;
  value: string;
  subLabel: string;
}

const DONUT_COLORS = [
  '#1D9E75',
  '#2C7FB8',
  '#EF9F27',
  '#3C3489',
  '#D85A30',
  '#0F766E',
  '#7C6EFA',
  '#8A8A83',
];

function SummaryTile({ label, value, subLabel }: SummaryTileProps) {
  return (
    <article className="rounded-xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-medium text-zinc-900">{value}</p>
      <p className="mt-0.5 text-[11px] text-zinc-500">{subLabel}</p>
    </article>
  );
}

function getBudgetLabel(status: BudgetStatus): string {
  if (status.subCategory) {
    return `${status.category} · ${status.subCategory}`;
  }

  return status.category;
}

function StatisticsContent({
  onClose,
  budgetStatuses,
  budgetAlerts,
  categoryBreakdown,
  weeklySpending,
  recentTransactions,
}: Omit<StatisticsPanelProps, 'isOpen'>) {
  const overallBudget =
    budgetStatuses.find((status) => status.category === 'Overall' && !status.subCategory) ??
    budgetStatuses.find((status) => status.category === 'Overall');

  const spent = overallBudget?.spent ?? 0;
  const saved = Math.max(overallBudget?.remaining ?? 0, 0);
  const baselineBudget = overallBudget?.effectiveLimit ?? overallBudget?.limit ?? 0;
  const netFlow = baselineBudget - spent;
  const transactionCount = recentTransactions?.length ?? 0;

  const sortedCategoryBreakdown = [...categoryBreakdown].sort(
    (a, b) => b.amount - a.amount
  );

  const hasCategoryData = sortedCategoryBreakdown.some((entry) => entry.amount > 0);
  const totalCategoryAmount = sortedCategoryBreakdown.reduce(
    (sum, entry) => sum + entry.amount,
    0
  );
  const topCategory = sortedCategoryBreakdown[0];
  const topPercent =
    topCategory && totalCategoryAmount > 0
      ? Math.round((topCategory.amount / totalCategoryAmount) * 100)
      : 0;

  const donutData = {
    labels: sortedCategoryBreakdown.map((entry) => entry.category),
    datasets: [
      {
        data: sortedCategoryBreakdown.map((entry) => entry.amount),
        backgroundColor: DONUT_COLORS.slice(0, sortedCategoryBreakdown.length),
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  const centerTextPlugin: Plugin<'doughnut'> = {
    id: 'centerText',
    beforeDraw: (chart) => {
      if (!topCategory || totalCategoryAmount <= 0) {
        return;
      }

      const { ctx, chartArea } = chart;
      if (!chartArea) {
        return;
      }

      const centerX = (chartArea.left + chartArea.right) / 2;
      const centerY = (chartArea.top + chartArea.bottom) / 2;
      const label =
        topCategory.category.length > 14
          ? `${topCategory.category.slice(0, 13)}...`
          : topCategory.category;
      const rootStyles = getComputedStyle(document.documentElement);
      const primaryColor =
        rootStyles.getPropertyValue('--color-text-primary').trim() || '#111';
      const secondaryColor =
        rootStyles.getPropertyValue('--color-text-secondary').trim() || '#888';

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = primaryColor;
      ctx.font = '600 14px var(--font-sans, sans-serif)';
      ctx.fillText(label, centerX, centerY - 9);
      ctx.fillStyle = secondaryColor;
      ctx.font = '500 12px var(--font-sans, sans-serif)';
      ctx.fillText(`${topPercent}%`, centerX, centerY + 9);
      ctx.restore();
    },
  };

  const maxWeeklyAmount = Math.max(1, ...weeklySpending.map((entry) => entry.amount));
  const budgetsForProgress = budgetStatuses.filter(
    (status) => !(status.category === 'Overall' && !status.subCategory)
  );

  return (
    <div className="space-y-4 pb-4">
      <header className="rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[14px] font-medium text-zinc-900">Statistics</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Your financial patterns and trends
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close statistics"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--color-border-tertiary,#d9d7cf)] text-zinc-600 transition-colors hover:bg-zinc-100"
          >
            <X size={15} />
          </button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2.5">
        <SummaryTile
          label="Spent"
          value={formatCurrency(spent)}
          subLabel="month-to-date"
        />
        <SummaryTile
          label="Saved"
          value={formatCurrency(saved)}
          subLabel="budget left"
        />
        <SummaryTile
          label="Net flow"
          value={`${netFlow >= 0 ? '+' : '-'}${formatCurrency(Math.abs(netFlow))}`}
          subLabel="budget minus spend"
        />
        <SummaryTile
          label="Transactions"
          value={transactionCount.toString()}
          subLabel="recent entries"
        />
      </section>

      <section className="rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-4">
        <h3 className="text-[14px] font-medium text-zinc-800">Expense distribution</h3>

        {hasCategoryData ? (
          <div className="mt-3">
            <div className="h-[180px]">
              <Doughnut
                data={donutData}
                plugins={[centerTextPlugin]}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: '68%',
                  plugins: {
                    legend: {
                      display: false,
                    },
                    tooltip: {
                      enabled: true,
                      callbacks: {
                        label: (ctx: TooltipItem<'doughnut'>) => ` ${formatCurrency(Number(ctx.raw ?? 0))}`,
                      },
                    },
                  },
                }}
              />
            </div>

            <div className="mt-3 space-y-1.5">
              {sortedCategoryBreakdown.map((entry, index) => (
                <div key={entry.category} className="flex items-center justify-between text-xs">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
                    />
                    <span className="truncate text-zinc-600">{entry.category}</span>
                  </div>
                  <span className="font-medium text-zinc-800">
                    {formatCurrency(entry.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">
            No category spending yet for this period.
          </p>
        )}
      </section>

      <section className="rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-4">
        <h3 className="text-[14px] font-medium text-zinc-800">Weekly trend</h3>

        {weeklySpending.length > 0 ? (
          <div className="mt-4">
            <div className="flex h-[64px] items-end gap-2">
              {weeklySpending.map((entry) => {
                const height = Math.max(8, (entry.amount / maxWeeklyAmount) * 100);
                return (
                  <div key={entry.week} className="flex h-full flex-1 items-end">
                    <div
                      className="w-full rounded-md"
                      style={{
                        height: `${height}%`,
                        backgroundColor:
                          entry.amount === maxWeeklyAmount && entry.amount > 0
                            ? '#1D9E75'
                            : '#9FE1CB',
                      }}
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-2 flex gap-2">
              {weeklySpending.map((entry, index) => (
                <p key={`${entry.week}-label`} className="flex-1 text-center text-[11px] text-zinc-500">
                  W{index + 1}
                </p>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">No weekly data available yet.</p>
        )}
      </section>

      <section className="rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-4">
        <h3 className="text-[14px] font-medium text-zinc-800">Budget progress</h3>

        <div className="mt-3 space-y-3">
          {(budgetsForProgress.length > 0 ? budgetsForProgress : budgetStatuses).map((status) => {
            const percentage =
              status.effectiveLimit > 0 ? (status.spent / status.effectiveLimit) * 100 : 0;

            return (
              <article key={status.budgetId}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-medium text-zinc-700">
                    {getBudgetLabel(status)}
                  </p>
                  <p className="shrink-0 text-[11px] text-zinc-500">
                    {formatCurrency(status.spent)} / {formatCurrency(status.effectiveLimit)}
                  </p>
                </div>

                <div className="h-2 rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, percentage)}%`,
                      backgroundColor:
                        status.status === 'critical'
                          ? '#D85A30'
                          : status.status === 'warning'
                            ? '#EF9F27'
                            : '#1D9E75',
                    }}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {budgetAlerts && budgetAlerts.length > 0 ? (
        <section className="rounded-2xl border-[0.5px] border-[#F0D7CA] bg-[#FFF6F2] p-4">
          <h3 className="text-[14px] font-medium text-[#A24726]">Budget alerts</h3>
          <div className="mt-2 space-y-1.5">
            {budgetAlerts.slice(0, 2).map((alert) => (
              <p key={alert.id} className="text-xs text-[#A24726]">
                {alert.message}
              </p>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default function StatisticsPanel({
  isOpen,
  onClose,
  budgetStatuses,
  budgetAlerts,
  categoryBreakdown,
  weeklySpending,
  recentTransactions,
}: StatisticsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  return (
    <div ref={panelRef}>
      <section className={`${isOpen ? 'block' : 'hidden'} md:hidden`}>
        <div className="min-h-screen bg-[#f5f5f0] px-4 py-5 sm:px-6">
          <StatisticsContent
            onClose={onClose}
            budgetStatuses={budgetStatuses}
            budgetAlerts={budgetAlerts}
            categoryBreakdown={categoryBreakdown}
            weeklySpending={weeklySpending}
            recentTransactions={recentTransactions}
          />
        </div>
      </section>

      <aside
        className="fixed right-0 top-0 z-30 hidden h-screen overflow-hidden bg-[#f8f7f2] md:block"
        style={{
          width: isOpen ? '340px' : '0px',
          opacity: isOpen ? 1 : 0,
          borderLeftWidth: isOpen ? '1px' : '0px',
          borderLeftStyle: 'solid',
          borderLeftColor: 'var(--color-border-tertiary, #d9d7cf)',
          boxShadow: isOpen ? '-10px 0 24px rgba(15, 23, 42, 0.08)' : 'none',
          transition:
            'width 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div
          className={`h-full w-[340px] overflow-y-auto p-4 ${
            isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          }`}
          style={{
            transform: isOpen ? 'translateX(0)' : 'translateX(24px)',
            transition:
              'transform 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <StatisticsContent
            onClose={onClose}
            budgetStatuses={budgetStatuses}
            budgetAlerts={budgetAlerts}
            categoryBreakdown={categoryBreakdown}
            weeklySpending={weeklySpending}
            recentTransactions={recentTransactions}
          />
        </div>
      </aside>
    </div>
  );
}
