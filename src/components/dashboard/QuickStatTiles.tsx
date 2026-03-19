'use client';

import { PiggyBank, Sun, Target, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface QuickStatTilesProps {
  spentThisMonth: number;
  remaining: number;
  monthlyLimit: number;
  savingsRate: number;
  spentToday: number;
  lastMonthSpent: number;
  latestTransactionName?: string;
}

interface TileProps {
  label: string;
  value: string;
  subLabel: string;
  icon: React.ReactNode;
}

function Tile({ label, value, subLabel, icon }: TileProps) {
  return (
    <article className="rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-3.5 md:p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-zinc-500">
          {label}
        </p>
        {icon}
      </div>
      <p className="text-[20px] font-medium leading-tight text-zinc-900">{value}</p>
      <p className="mt-1 truncate text-[11px] text-zinc-500">{subLabel}</p>
    </article>
  );
}

export default function QuickStatTiles({
  spentThisMonth,
  remaining,
  monthlyLimit,
  savingsRate,
  spentToday,
  lastMonthSpent,
  latestTransactionName,
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
      />

      <Tile
        label="Remaining budget"
        value={formatCurrency(remaining)}
        subLabel={`of ${formatCurrency(monthlyLimit)} total`}
        icon={<Target size={16} color="#185FA5" />}
      />

      <Tile
        label="Savings rate"
        value={`${savingsRate}%`}
        subLabel="of budget saved"
        icon={<PiggyBank size={16} color="#3C3489" />}
      />

      <Tile
        label="Spent today"
        value={formatCurrency(spentToday)}
        subLabel={latestTransactionName || 'No transaction yet today'}
        icon={<Sun size={16} color="#B66A12" />}
      />
    </section>
  );
}
