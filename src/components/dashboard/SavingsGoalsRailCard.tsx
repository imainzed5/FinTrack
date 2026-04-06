'use client';

import Link from 'next/link';
import { Pin } from 'lucide-react';
import type { SavingsGoalsSummary } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

interface SavingsGoalsRailCardProps {
  summary: SavingsGoalsSummary | null;
  loading?: boolean;
}

export default function SavingsGoalsRailCard({
  summary,
  loading = false,
}: SavingsGoalsRailCardProps) {
  const topGoals = (summary?.goals ?? [])
    .filter((goal) => goal.status === 'active')
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }

      return b.progressPercent - a.progressPercent;
    })
    .slice(0, 3);

  return (
    <section className="rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-medium text-zinc-800">Savings goals</h2>
          <p className="mt-1 text-[11px] text-zinc-500">
            {loading
              ? 'Loading your progress'
              : topGoals.length === 0
                ? 'No active goals yet'
                : `${summary?.activeGoalCount ?? topGoals.length} active goal${(summary?.activeGoalCount ?? topGoals.length) === 1 ? '' : 's'}`}
          </p>
        </div>
        <Link href="/savings" className="text-xs font-medium text-[#1D9E75] hover:underline">
          See all
        </Link>
      </div>

      {loading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-3"
            >
              <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-100" />
              <div className="mt-3 h-2 animate-pulse rounded-full bg-zinc-100" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-zinc-100" />
            </div>
          ))}
        </div>
      ) : topGoals.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-[#F7F5EE] px-4 py-5 text-sm text-zinc-500">
          Start a goal in Savings to keep your targets visible from the dashboard.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {topGoals.map((goal) => (
            <article
              key={goal.id}
              className="rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-3"
            >
              <div className="mb-2 flex items-start justify-between gap-2 text-sm">
                <p className="min-w-0 truncate font-medium text-zinc-800">
                  {goal.emoji} {goal.name} {goal.isPinned ? <Pin size={12} className="inline" /> : null}
                </p>
                <p className="shrink-0 text-zinc-600">{goal.progressPercent}%</p>
              </div>
              <div className="h-2 rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, goal.progressPercent)}%`,
                    backgroundColor: goal.colorAccent,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}