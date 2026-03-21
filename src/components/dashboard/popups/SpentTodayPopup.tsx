'use client';

import { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import type { Transaction } from '@/lib/types';
import { formatCurrency, getTodayDateKeyInManila } from '@/lib/utils';
import { CATEGORY_EMOJI } from './SpentThisMonthPopup';

interface SpentTodayPopupProps {
  open: boolean;
  onClose: () => void;
  recentTransactions: Transaction[];
}

function formatSignedAmount(tx: Transaction): string {
  const value = formatCurrency(tx.amount);

  if (tx.type === 'income') {
    return `+${value}`;
  }

  if (tx.type === 'savings') {
    return tx.savingsMeta?.depositType === 'deposit' ? `+${value}` : `-${value}`;
  }

  return `-${value}`;
}

const toTitleCase = (str: string) =>
  str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function toDateKey(value: string): string {
  return value.split('T')[0];
}

export default function SpentTodayPopup({
  open,
  onClose,
  recentTransactions,
}: SpentTodayPopupProps) {
  const todayKey = getTodayDateKeyInManila();

  const todayTxns = useMemo(
    () =>
      recentTransactions
        .filter((tx) => toDateKey(tx.date) === todayKey && tx.type === 'expense'),
    [recentTransactions, todayKey]
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade-in" onClick={onClose}>
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
            <div className="space-y-2">
              {todayTxns.map((tx) => {
                const emoji = CATEGORY_EMOJI[tx.category] ?? '📦';
                const title = tx.merchant
                  ? toTitleCase(tx.merchant)
                  : tx.description
                    ? toTitleCase(tx.description)
                    : toTitleCase(tx.category);

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
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-[#d85a30]">
                      {formatSignedAmount(tx)}
                    </p>
                  </div>
                );
              })}
            </div>
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
