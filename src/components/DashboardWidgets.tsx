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

interface StatsCardsProps {
  data: DashboardData;
}

export function StatsCards({ data }: StatsCardsProps) {
  const growthPositive = data.expenseGrowthRate > 0;

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

      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Remaining Budget</span>
          <Target size={16} className="text-blue-500" />
        </div>
        <p className="font-display text-2xl font-bold text-zinc-900 dark:text-white">{formatCurrency(data.remainingBudget)}</p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
          of {formatCurrency(data.monthlyBudget)} budget
        </p>
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
      <div className="text-center py-6 text-zinc-400 dark:text-zinc-600 text-sm">
        No budgets set. Go to Settings to add budgets.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {budgets.map((b) => (
        <div key={b.budgetId}>
          {(() => {
            const isOverall = b.category === 'Overall' && !b.subCategory;
            const showOverallBoost = isOverall && b.incomeBoost > 0;

            return (
              <>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {b.subCategory ? `${b.category} · ${b.subCategory}` : b.category}
            </span>
            {!showOverallBoost && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {formatCurrency(b.spent)} / {formatCurrency(b.effectiveLimit)}
              </span>
            )}
          </div>

          {showOverallBoost && (
            <p className="text-xs mb-1 text-emerald-600 dark:text-emerald-400">
              {formatCurrency(b.baseLimit)} + {formatCurrency(b.incomeBoost)} boost
            </p>
          )}

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

          {showOverallBoost && (
            <p className="text-xs mt-1 text-zinc-500 dark:text-zinc-400">
              {formatCurrency(b.spent)} spent of {formatCurrency(b.effectiveLimit)}
            </p>
          )}

          {b.rolloverCarry > 0 && (
            <p className="text-[11px] mt-1 text-emerald-600 dark:text-emerald-400">
              Includes {formatCurrency(b.rolloverCarry)} rollover from last month.
            </p>
          )}
          {b.status !== 'safe' && (
            <p className={`text-xs mt-1 ${b.status === 'critical' ? 'text-red-500' : 'text-amber-500'}`}>
              {b.status === 'critical'
                ? `Budget exceeded! ${Math.round(b.percentage)}% used.`
                : `Warning: ${Math.round(b.percentage)}% of budget used.`}
            </p>
          )}
          {b.projectedOverage > 0 && b.status !== 'critical' && (
            <p className="text-xs mt-1 text-amber-500">
              Projected month-end: {formatCurrency(b.projectedSpent)}. Likely over by {formatCurrency(b.projectedOverage)}.
            </p>
          )}
          {b.limit !== b.effectiveLimit && !showOverallBoost && (
            <p className="text-[11px] mt-1 text-zinc-400 dark:text-zinc-500">
              Base limit {formatCurrency(b.limit)}.
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
