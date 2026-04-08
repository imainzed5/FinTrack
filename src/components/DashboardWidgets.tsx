'use client';

import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  Target,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import type { DashboardData, BudgetStatus } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';

interface StatsCardsProps {
  data: DashboardData;
}

export function StatsCards({ data }: StatsCardsProps) {
  const growthPositive = data.expenseGrowthRate > 0;

  // Budgets are strict limits; account balances are tracked separately.
  const overallBudget = data.budgetStatuses.find(
    (b) => b.category === 'Overall' && !b.subCategory
  );
  const strictCap = overallBudget?.configuredLimit ?? data.budgetSummary.overallConfiguredLimit ?? data.monthlyBudget;
  const budgetRemaining = overallBudget?.remaining ?? data.remainingBudget;
  const hasBudget = strictCap > 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Spent This Month</span>
          <Wallet size={16} className="text-emerald-500" />
        </div>
        <p className="font-display text-2xl font-bold text-zinc-900 dark:text-white">{formatCurrency(data.totalSpentThisMonth)}</p>
        <div className="flex items-center gap-1 mt-1">
          {growthPositive ? (
            <ArrowUpRight size={12} className="text-red-500" />
          ) : (
            <ArrowDownRight size={12} className="text-emerald-500" />
          )}
          <span className={`text-xs font-medium ${growthPositive ? 'text-red-500' : 'text-emerald-500'}`}>
            {Math.abs(Math.round(data.expenseGrowthRate))}% vs last month
          </span>
        </div>
      </div>

      {/* Budget remaining follows the configured budget cap only. */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Budget Remaining</span>
          <Target size={16} className="text-blue-500" />
        </div>
        <p className={`font-display text-2xl font-bold ${budgetRemaining < 0 ? 'text-red-500' : 'text-zinc-900 dark:text-white'}`}>
          {hasBudget ? formatCurrency(budgetRemaining) : '—'}
        </p>
        {hasBudget ? (
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Cap: {formatCurrency(strictCap)}
            </p>
          </div>
        ) : (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Set a budget first</p>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Savings Rate</span>
          <PiggyBank size={16} className="text-violet-500" />
        </div>
        <p className="font-display text-2xl font-bold text-zinc-900 dark:text-white">
          {data.savingsRate > 0 ? `${Math.round(data.savingsRate)}%` : '—'}
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
          {data.savingsRate > 0 ? 'of monthly budget saved' : 'Set a budget first'}
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Last Month</span>
          {data.expenseGrowthRate <= 0 ? (
            <TrendingDown size={16} className="text-emerald-500" />
          ) : (
            <TrendingUp size={16} className="text-red-500" />
          )}
        </div>
        <p className="font-display text-2xl font-bold text-zinc-900 dark:text-white">{formatCurrency(data.totalSpentLastMonth)}</p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">total spent</p>
      </div>
    </div>
  );
}

interface BudgetProgressProps {
  budgets: BudgetStatus[];
}

export function BudgetProgress({ budgets }: BudgetProgressProps) {
  if (budgets.length === 0) {
    return (
      <EmptyState
        icon="berde"
        headline="No budget set yet."
        subtext="Berde can't guard what doesn't exist."
        cta={{ label: 'Set a Budget', action: 'go-to-budgets' }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {budgets.map((b) => (
        <div key={b.budgetId}>
          {(() => {
            const limit = b.effectiveLimit || b.configuredLimit;

            return (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {b.subCategory ? `${b.category} · ${b.subCategory}` : b.category}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {formatCurrency(b.spent)} / {formatCurrency(limit)}
                  </span>
                </div>

                <div className="h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      b.status === 'critical'
                        ? 'bg-red-500'
                        : b.status === 'warning'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(b.percentage, 100)}%` }}
                  />
                </div>
                {b.rolloverCarry > 0 && (
                  <p className="text-[11px] mt-1 text-emerald-600 dark:text-emerald-400">
                    Includes {formatCurrency(b.rolloverCarry)} rollover from last month.
                  </p>
                )}
                {b.status !== 'safe' && (
                  <p className={`text-xs mt-1 ${b.status === 'critical' ? 'text-red-500' : 'text-amber-500'}`}>
                    {b.status === 'critical'
                      ? `Over budget cap! ${Math.round(b.percentage)}% of cap used.`
                      : `Warning: ${Math.round(b.percentage)}% of budget cap used.`}
                  </p>
                )}
                {b.projectedOverage > 0 && b.status !== 'critical' && (
                  <p className="text-xs mt-1 text-amber-500">
                    Projected month-end: {formatCurrency(b.projectedSpent)}. Likely over by {formatCurrency(b.projectedOverage)}.
                  </p>
                )}
              </>
            );
          })()}
        </div>
      ))}
    </div>
  );
}
