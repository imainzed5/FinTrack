'use client';

import { PiggyBank, Sun, Target, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface QuickStatTilesProps {
  spentThisMonth: number;
  remaining: number;
  monthlyLimit: number;
  incomeBoost?: number;
  spentToday: number;
  savingsTotalSaved: number;
  savingsActiveGoalCount: number;
  savingsLoading: boolean;
  lastMonthSpent: number;
  latestTransactionName?: string;
  onSpentThisMonthTap?: () => void;
  onRemainingBudgetTap?: () => void;
  onSpentTodayTap?: () => void;
  onSavingsGoalsTap?: () => void;
}

interface TileProps {
  label: string;
  value: string;
  subLabel: string | React.ReactNode;
  icon: React.ReactNode;
  onClick?: () => void;
  delay?: number;
}

function Tile({ label, value, subLabel, icon, onClick, delay }: TileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-full rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-3.5 text-left transition-transform duration-100 active:scale-95 md:p-3 animate-fade-up"
      style={{ animationDelay: `${delay ?? 0}ms` }}
      aria-label={label}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-zinc-500">
          {label}
        </p>
        {icon}
      </div>
      <p className="text-[20px] font-medium leading-tight text-zinc-900">{value}</p>
      <p className="mt-1 truncate text-[11px] text-zinc-500">{subLabel}</p>
    </button>
  );
}

export default function QuickStatTiles({
  spentThisMonth,
  remaining,
  monthlyLimit,
  incomeBoost = 0,
  spentToday,
  savingsTotalSaved,
  savingsActiveGoalCount,
  savingsLoading,
  lastMonthSpent,
  latestTransactionName,
  onSpentThisMonthTap,
  onRemainingBudgetTap,
  onSpentTodayTap,
  onSavingsGoalsTap,
}: QuickStatTilesProps) {
  const monthChange =
    lastMonthSpent > 0 ? ((spentThisMonth - lastMonthSpent) / lastMonthSpent) * 100 : 0;

  const monthChangeLabel =
    lastMonthSpent > 0
      ? `${monthChange > 0 ? '+' : ''}${Math.round(monthChange)}% vs last month`
      : 'No last month baseline yet';

  return (
    <section className="grid grid-cols-2 gap-[10px] md:grid-cols-4">
      <Tile
        label="Spent this month"
        value={formatCurrency(spentThisMonth)}
        subLabel={monthChangeLabel}
        icon={<Wallet size={16} color="#1D9E75" />}
        onClick={onSpentThisMonthTap}
        delay={0}
      />

      <Tile
        label="Safe to spend"
        value={formatCurrency(remaining)}
        subLabel={
          <span className="flex items-center gap-1.5 flex-wrap">
            Cap: {formatCurrency(monthlyLimit)}
            {incomeBoost > 0 && (
              <span className="inline-flex items-center text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded-sm">
                +{formatCurrency(incomeBoost)} income
              </span>
            )}
          </span>
        }
        icon={<Target size={16} color="#185FA5" />}
        onClick={onRemainingBudgetTap}
        delay={50}
      />

      <Tile
        label="Spent today"
        value={formatCurrency(spentToday)}
        subLabel={latestTransactionName || 'No transaction yet today'}
        icon={<Sun size={16} color="#B66A12" />}
        onClick={onSpentTodayTap}
        delay={100}
      />

      <Tile
        label="Savings goals"
        value={savingsLoading ? '—' : formatCurrency(savingsTotalSaved)}
        subLabel={
          savingsLoading
            ? 'Loading...'
            : savingsActiveGoalCount === 0
              ? 'No goals yet'
              : `${savingsActiveGoalCount} active goal${savingsActiveGoalCount === 1 ? '' : 's'}`
        }
        icon={<PiggyBank size={16} color="#7F77DD" />}
        onClick={onSavingsGoalsTap}
        delay={150}
      />
    </section>
  );
}
