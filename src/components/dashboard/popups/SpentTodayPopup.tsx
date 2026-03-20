'use client';

import { format } from 'date-fns';
import { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import type { Transaction } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { CATEGORY_EMOJI } from './SpentThisMonthPopup';

interface SpentTodayPopupProps {
  open: boolean;
  onClose: () => void;
  recentTransactions: Transaction[];
}

type TimeGroup = 'Morning' | 'Afternoon' | 'Evening';

function formatSignedAmount(amount: number): string {
  return `-${formatCurrency(amount)}`;
}

function getTimeGroup(date: Date): TimeGroup {
  const hour = date.getHours();
  if (hour < 12) return 'Morning';
  if (hour < 18) return 'Afternoon';
  return 'Evening';
}

export default function SpentTodayPopup({
  open,
  onClose,
  recentTransactions,
}: SpentTodayPopupProps) {
  const todayKey = new Date().toISOString().split('T')[0];

  const todayTxns = useMemo(
    () =>
      recentTransactions
        .filter(
          (tx) => tx.date.split('T')[0] === todayKey && tx.type !== 'income'
        )
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [recentTransactions, todayKey]
  );

  const grouped = useMemo(() => {
    const groups: Record<TimeGroup, Transaction[]> = {
      Morning: [],
      Afternoon: [],
      Evening: [],
    };

    todayTxns.forEach((tx) => {
      const timestamp = new Date(tx.date);
      if (Number.isNaN(timestamp.getTime())) return;
      groups[getTimeGroup(timestamp)].push(tx);
    });

    return groups;
  }, [todayTxns]);

  const visibleGroups = (Object.keys(grouped) as TimeGroup[]).filter(
    (group) => grouped[group].length > 0
  );

  const totalToday = useMemo(
    () => todayTxns.reduce((sum, tx) => sum + tx.amount, 0),
    [todayTxns]
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
        aria-label="Spent today details"
        className="modal-shell w-full max-w-md rounded-t-3xl bg-white p-5 animate-slide-up"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 28px)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Spent today</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close spent today popup"
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X size={20} />
          </button>
        </div>

        {todayTxns.length === 0 ? (
          <div className="rounded-2xl bg-zinc-50 px-4 py-10 text-center">
            <div className="text-4xl" aria-hidden="true">🟢</div>
            <p className="mt-3 text-sm font-medium text-zinc-700">No spend today. Berde approves.</p>
          </div>
        ) : (
          <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
            {visibleGroups.map((groupName) => (
              <section key={groupName}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  {groupName}
                </p>
                <div className="space-y-2">
                  {grouped[groupName].map((tx) => {
                    const parsedDate = new Date(tx.date);
                    const emoji = CATEGORY_EMOJI[tx.category] ?? '📦';
                    const title = tx.merchant || tx.description || tx.category;
                    const timeLabel = Number.isNaN(parsedDate.getTime())
                      ? '--:--'
                      : format(parsedDate, 'h:mm a');

                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between rounded-xl border border-zinc-100 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-800">
                            <span className="mr-1.5" aria-hidden="true">{emoji}</span>
                            {title}
                          </p>
                          <p className="text-xs text-zinc-500">{timeLabel}</p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-[#d85a30]">
                          {formatSignedAmount(tx.amount)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {todayTxns.length > 0 && (
          <div className="mt-5 border-t border-zinc-100 pt-3 text-right">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Total today</p>
            <p className="text-lg font-bold text-zinc-900">{formatCurrency(totalToday)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
