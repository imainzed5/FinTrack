'use client';

import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
} from 'lucide-react';
import type { DashboardData, BudgetStatus } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';

interface StatsCardsProps {
  data: DashboardData;
}

export function StatsCards({ data }: StatsCardsProps) {
  const growthPositive = data.expenseGrowthRate > 0;

  // Separate the strict spending cap from the income-boosted effective limit
  const overallBudget = data.budgetStatuses.find(
    (b) => b.category === 'Overall' && !b.subCategory
  );
  const strictCap = overallBudget?.baseLimit ?? data.monthlyBudget;
  const safeToSpend = overallBudget?.remaining ?? data.remainingBudget;
  const incomeBoost = overallBudget?.incomeBoost ?? 0;
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

      {/* Safe to Spend: remaining after spending, boosted by income */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Safe to Spend</span>
          <Target size={16} className="text-blue-500" />
        </div>
        <p className={`font-display text-2xl font-bold ${safeToSpend < 0 ? 'text-red-500' : 'text-zinc-900 dark:text-white'}`}>
          {hasBudget ? formatCurrency(safeToSpend) : '—'}
        </p>
        {hasBudget ? (
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Cap: {formatCurrency(strictCap)}
            </p>
            {incomeBoost > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-700 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                <Zap size={9} />
                +{formatCurrency(incomeBoost)} income
              </span>
            )}
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
        cta={{ label: 'Set a Budget', action: 'go-to-settings' }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {budgets.map((b) => (
        <div key={b.budgetId}>
          {(() => {
            const isOverall = b.category === 'Overall' && !b.subCategory;
            const showBoost = isOverall && b.incomeBoost > 0;

            return (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {b.subCategory ? `${b.category} · ${b.subCategory}` : b.category}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {showBoost && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-700 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                        <Zap size={9} />
                        +{formatCurrency(b.incomeBoost)} income
                      </span>
                    )}
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {formatCurrency(b.spent)} / {formatCurrency(isOverall ? b.baseLimit : b.effectiveLimit)}
                      {showBoost && ' cap'}
                    </span>
                  </div>
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

                {showBoost && (
                  <p className="text-[11px] mt-1 text-zinc-400 dark:text-zinc-500">
                    Safe to spend: {formatCurrency(b.effectiveLimit - b.spent)} (cap + income)
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
