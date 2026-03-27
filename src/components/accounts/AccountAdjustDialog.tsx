'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { AccountWithBalance } from '@/lib/types';

interface AccountAdjustDialogProps {
  open: boolean;
  account: AccountWithBalance | null;
  onClose: () => void;
  onAdjusted: () => Promise<void> | void;
}

export default function AccountAdjustDialog({
  open,
  account,
  onClose,
  onAdjusted,
}: AccountAdjustDialogProps) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('Manual account balance adjustment');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmount('');
    setNote('Manual account balance adjustment');
    setSaving(false);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !account) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const numericAmount = Number.parseFloat(amount);
    if (!Number.isFinite(numericAmount) || numericAmount === 0) {
      setError('Enter a non-zero adjustment amount.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: account.id,
          action: 'adjust-balance',
          amount: numericAmount,
          note: note.trim() || 'Manual account balance adjustment',
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to adjust account balance.');
      }

      await onAdjusted();
      onClose();
    } catch (adjustError) {
      setError(
        adjustError instanceof Error
          ? adjustError.message
          : 'Failed to adjust account balance.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/50 px-4 py-6 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-adjust-title"
    >
      <div
        className="w-full max-w-md rounded-[28px] bg-white p-5 shadow-xl dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
              Adjust
            </p>
            <h2
              id="account-adjust-title"
              className="mt-1 font-display text-2xl font-bold text-zinc-900 dark:text-white"
            >
              {account.name}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
            aria-label="Close balance adjustment"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Adjustment amount</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Use positive or negative values"
              className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition-colors focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950"
            />
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              Positive values increase the balance. Negative values reduce it.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Note</label>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition-colors focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-11 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {saving ? 'Saving...' : 'Apply adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
