'use client';

import type { ReactNode } from 'react';
import { ArrowLeftRight, PiggyBank, Sun, Target, Wallet } from 'lucide-react';
import { formatCurrency, formatCurrencySigned } from '@/lib/utils';

interface QuickStatTilesProps {
  totalBalance: number;
  totalIncomeThisMonth: number;
  spentThisMonth: number;
  remaining: number;
  monthlyLimit: number;
  spentToday: number;
  netThisMonth: number;
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
  subLabel: string | ReactNode;
  icon: ReactNode;
  onClick?: () => void;
  delay?: number;
  className?: string;
  valueClassName?: string;
}

function Tile({
  label,
  value,
  subLabel,
  icon,
  onClick,
  delay,
  className,
  valueClassName,
}: TileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-full rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-3.5 text-left transition-transform duration-100 active:scale-95 md:p-3 animate-fade-up ${className ?? ''}`}
      style={{ animationDelay: `${delay ?? 0}ms` }}
      aria-label={label}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-zinc-500">
          {label}
        </p>
        {icon}
      </div>
      <p className={`text-[20px] font-medium leading-tight ${valueClassName ?? 'text-zinc-900'}`}>
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] text-zinc-500">{subLabel}</p>
    </button>
  );
}

export default function QuickStatTiles({
  totalIncomeThisMonth,
  spentThisMonth,
  remaining,
  monthlyLimit,
  spentToday,
  netThisMonth,
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

  const netValueClassName =
    netThisMonth > 0 ? 'text-[#1D9E75]' : netThisMonth < 0 ? 'text-[#D85A30]' : 'text-zinc-900';

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
        label="Budget remaining"
        value={formatCurrencySigned(remaining)}
        subLabel={
          <span className="flex items-center gap-1.5 flex-wrap">
            Cap: {formatCurrency(monthlyLimit)}
          </span>
        }
        icon={<Target size={16} color="#185FA5" />}
        onClick={onRemainingBudgetTap}
        delay={30}
      />

      <Tile
        label="Spent today"
        value={formatCurrency(spentToday)}
        subLabel={latestTransactionName || 'No transaction yet today'}
        icon={<Sun size={16} color="#B66A12" />}
        onClick={onSpentTodayTap}
        delay={60}
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
        delay={90}
        className="md:hidden"
      />

      <Tile
        label="Net this month"
        value={formatCurrencySigned(netThisMonth)}
        subLabel={
          <span className="flex flex-wrap items-center gap-1.5">
            Income: {formatCurrency(totalIncomeThisMonth)}
          </span>
        }
        icon={<ArrowLeftRight size={16} color={netThisMonth < 0 ? '#D85A30' : '#1D9E75'} />}
        delay={90}
        className="hidden md:block"
        valueClassName={netValueClassName}
      />
    </section>
  );
}
