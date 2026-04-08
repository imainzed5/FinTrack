'use client';

import { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import type { BudgetStatus } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

interface RemainingBudgetPopupProps {
  open: boolean;
  onClose: () => void;
  overallBudget: BudgetStatus | undefined;
}

const DONUT_RADIUS = 38;
const DONUT_DASHARRAY = 2 * Math.PI * DONUT_RADIUS;

const STATUS_BADGE_CLASS: Record<BudgetStatus['status'], string> = {
  safe: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};

function formatSignedCurrency(amount: number): string {
  if (amount < 0) {
    return `-${formatCurrency(amount)}`;
  }

  return formatCurrency(amount);
}

export default function RemainingBudgetPopup({
  open,
  onClose,
  overallBudget,
}: RemainingBudgetPopupProps) {
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const displayDaysLeft = Math.max(0, endOfMonth.getDate() - now.getDate());
  const divisorDaysLeft = Math.max(1, displayDaysLeft);

  const budgetCap = overallBudget?.effectiveLimit ?? overallBudget?.configuredLimit ?? 0;
  const remaining = overallBudget?.remaining ?? 0;

  const savedPercentage =
    budgetCap > 0 ? Math.round((remaining / budgetCap) * 100) : 0;

  const progressRatio = budgetCap > 0 ? 1 - remaining / budgetCap : 0;

  const strokeDashoffset = useMemo(
    () =>
      Math.min(
        DONUT_DASHARRAY,
        Math.max(0, DONUT_DASHARRAY * progressRatio)
      ),
    [progressRatio]
  );

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !overallBudget) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Remaining budget details"
        className="modal-shell w-full max-w-md rounded-t-3xl bg-white p-5 animate-slide-up"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 28px)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Remaining budget</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close remaining budget popup"
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-5 flex items-center justify-center">
          <div className="relative h-28 w-28">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle
                cx="50"
                cy="50"
                r={DONUT_RADIUS}
                stroke="#f0f0f0"
                strokeWidth="10"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r={DONUT_RADIUS}
                stroke="#1D9E75"
                strokeWidth="10"
                fill="none"
                strokeDasharray={DONUT_DASHARRAY}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <p className="text-xl font-semibold text-zinc-900">{savedPercentage}%</p>
              <p className="text-[11px] text-zinc-500">saved</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Days left</p>
            <p className="mt-1 text-lg font-semibold text-zinc-900">{displayDaysLeft}</p>
          </div>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Daily budget left</p>
            <p className="mt-1 text-lg font-semibold text-zinc-900">
              {formatSignedCurrency(Math.round(remaining / divisorDaysLeft))}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Projected remaining</p>
            <p
              className={`mt-1 text-lg font-semibold ${
                overallBudget.remaining >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {formatSignedCurrency(overallBudget.remaining)}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Status</p>
            <span
              className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE_CLASS[overallBudget.status]}`}
            >
              {overallBudget.status}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
