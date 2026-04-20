'use client';

import Link from 'next/link';
import { ChevronRight, Pin } from 'lucide-react';
import type { SavingsGoalsSummary } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

interface SavingsGoalsDashboardCardProps {
  open: boolean;
  onClose: () => void;
  summary: SavingsGoalsSummary | null;
}

export default function SavingsGoalsDashboardCard({
  open,
  onClose,
  summary,
}: SavingsGoalsDashboardCardProps) {
  const topGoals = (summary?.goals ?? [])
    .filter((goal) => goal.status === 'active')
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      return b.progressPercent - a.progressPercent;
    })
    .slice(0, 3);

  return open ? (
    <div className="fixed inset-0 z-[51] flex items-end justify-center bg-black/40 animate-fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Savings goals overview"
        className="modal-shell w-full max-w-md rounded-t-3xl bg-white p-5 animate-slide-up"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 28px)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Savings goals</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100"
            aria-label="Close savings goals"
          >
            <ChevronRight className="rotate-90" size={18} />
          </button>
        </div>

        <section className="grid grid-cols-2 gap-2.5">
          <article className="rounded-xl border-0 bg-white p-3">
            <p className="text-[10px] uppercase tracking-[0.05em] text-zinc-500">Total saved</p>
            <p className="mt-1 text-lg font-semibold text-zinc-900">
              {formatCurrency(summary?.totalSaved ?? 0)}
            </p>
          </article>
          <article className="rounded-xl border-0 bg-white p-3">
            <p className="text-[10px] uppercase tracking-[0.05em] text-zinc-500">Active goals</p>
            <p className="mt-1 text-lg font-semibold text-zinc-900">
              {summary?.activeGoalCount ?? 0}
            </p>
          </article>
        </section>

        <section className="mt-4 space-y-3">
          {topGoals.map((goal) => (
            <article
              key={goal.id}
              className="rounded-2xl border-0 bg-white p-3"
            >
              <div className="mb-1 flex items-center justify-between text-sm">
                <p className="truncate font-medium text-zinc-800">
                  {goal.emoji} {goal.name} {goal.isPinned ? <Pin size={12} className="inline" /> : null}
                </p>
                <p className="text-zinc-600">{goal.progressPercent}%</p>
              </div>
              <div className="h-2 rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, goal.progressPercent)}%`, backgroundColor: goal.colorAccent }}
                />
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
              </p>
            </article>
          ))}
        </section>

        <Link
          href="/savings"
          className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#1D9E75] px-4 py-3 text-sm font-semibold text-white"
        >
          See all goals
        </Link>
      </div>
    </div>
  ) : null;
}
