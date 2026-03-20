'use client';

import { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface SpentThisMonthPopupProps {
  open: boolean;
  onClose: () => void;
  categoryBreakdown: { category: string; amount: number }[];
  dailySpending: { day: string; amount: number; date?: string }[];
}

export const CATEGORY_EMOJI: Record<string, string> = {
  Food: '🍔',
  Transport: '🚌',
  Transportation: '🚌',
  School: '📚',
  Education: '📚',
  Entertainment: '🎮',
  Shopping: '🛍️',
  Health: '💊',
  Bills: '📋',
  Utilities: '📋',
  Subscriptions: '📱',
  Savings: '🐷',
  Other: '📦',
  Miscellaneous: '📦',
};

function normalizeDateSortKey(value: string | undefined, fallbackIndex: number): number {
  if (!value) {
    return fallbackIndex;
  }

  const dateKey = value.split('T')[0];
  const timestamp = new Date(dateKey).getTime();
  return Number.isFinite(timestamp) ? timestamp : fallbackIndex;
}

export default function SpentThisMonthPopup({
  open,
  onClose,
  categoryBreakdown,
  dailySpending,
}: SpentThisMonthPopupProps) {
  const cleanedBreakdown = useMemo(
    () =>
      categoryBreakdown.filter(
        (item) =>
          Number(item.amount) > 0 && !item.category.toLowerCase().includes('income')
      ),
    [categoryBreakdown]
  );

  const total = useMemo(
    () => cleanedBreakdown.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [cleanedBreakdown]
  );

  const topCategories = useMemo(
    () => [...cleanedBreakdown].sort((a, b) => b.amount - a.amount).slice(0, 3),
    [cleanedBreakdown]
  );

  const last7Days = useMemo(
    () =>
      dailySpending
        .map((point, index) => ({
          ...point,
          amount: Number.isFinite(Number(point.amount)) ? Number(point.amount) : 0,
          sortValue: normalizeDateSortKey(point.date, index),
        }))
        .sort((a, b) => a.sortValue - b.sortValue)
        .slice(-7),
    [dailySpending]
  );

  const maxDailyAmount = useMemo(
    () => Math.max(1, ...last7Days.map((point) => point.amount)),
    [last7Days]
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Spent this month details"
        className="modal-shell w-full max-w-md rounded-t-3xl bg-white p-5 animate-slide-up"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 28px)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Spent this month</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close spent this month popup"
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          {topCategories.length === 0 && (
            <p className="rounded-xl bg-zinc-50 p-3 text-sm text-zinc-500">
              No category activity yet for this month.
            </p>
          )}

          {topCategories.map((item) => {
            const percentage = total > 0 ? Math.min(100, (item.amount / total) * 100) : 0;
            const emoji = CATEGORY_EMOJI[item.category] ?? '📦';

            return (
              <div key={item.category} className="rounded-xl border border-zinc-100 p-3">
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <p className="font-medium text-zinc-800">
                    <span className="mr-1.5" aria-hidden="true">
                      {emoji}
                    </span>
                    {item.category}
                  </p>
                  <div className="text-right">
                    <p className="font-semibold text-zinc-900">{formatCurrency(item.amount)}</p>
                    <p className="text-xs text-zinc-500">{Math.round(percentage)}%</p>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-100">
                  <div
                    className="h-2 rounded-full bg-[#1D9E75]"
                    style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="my-5 h-px bg-zinc-200" />

        <div>
          <h3 className="mb-2 text-sm font-semibold text-zinc-900">Last 7 days</h3>
          <div className="flex items-end justify-between gap-2">
            {last7Days.map((point, index) => {
              const rawHeight = (point.amount / maxDailyAmount) * 100;
              const barHeight = Math.max(10, Math.round(rawHeight));
              const isToday = index === last7Days.length - 1;

              return (
                <div key={`${point.day}-${index}`} className="flex w-full flex-col items-center">
                  <div className="flex h-20 w-full items-end justify-center">
                    <div
                      className={`w-full max-w-[16px] rounded-t ${isToday ? 'bg-[#d85a30]' : 'bg-[#1D9E75]/60'}`}
                      style={{ height: `${barHeight}%` }}
                    />
                  </div>
                  <span className="mt-1 text-[9px] text-zinc-500">{point.day.slice(0, 3)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
