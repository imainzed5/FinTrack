'use client';

import { useEffect, useId, useState } from 'react';
import { ArrowLeftRight, X } from 'lucide-react';

interface AccountOption {
  id: string;
  name: string;
  type: string;
}

interface TransferModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function TransferModal({ open, onClose, onCreated }: TransferModalProps) {
  const titleId = useId();
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function fetchAccounts() {
      try {
        const res = await fetch('/api/accounts', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as AccountOption[];
        if (cancelled) return;
        const nextAccounts = Array.isArray(json) ? json : [];
        setAccounts(nextAccounts);
        if (nextAccounts.length >= 2) {
          setFromAccountId(nextAccounts[0].id);
          setToAccountId(nextAccounts[1].id);
        }
      } catch {
        if (!cancelled) {
          setAccounts([]);
        }
      }
    }

    void fetchAccounts();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const canSubmit =
    Number.isFinite(Number(amount)) &&
    Number(amount) > 0 &&
    fromAccountId.length > 0 &&
    toAccountId.length > 0 &&
    fromAccountId !== toAccountId;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!canSubmit) {
      setError('Choose different accounts and enter a positive amount.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAccountId,
          toAccountId,
          amount: Number(Number(amount).toFixed(2)),
          date: new Date(date).toISOString(),
          notes: notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to create transfer.');
      }

      setAmount('');
      setNotes('');
      onCreated();
      onClose();
    } catch (transferError) {
      setError(transferError instanceof Error ? transferError.message : 'Failed to create transfer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-sm bg-zinc-100 dark:bg-zinc-900 rounded-3xl p-3 flex flex-col gap-2"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowLeftRight size={16} className="text-emerald-600" />
            <p id={titleId} className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Transfer funds
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center"
          >
            <X className="w-3.5 h-3.5 text-zinc-500" />
          </button>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-2xl text-xs bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/30">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-3 space-y-2.5">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-zinc-400">From account</label>
            <select
              value={fromAccountId}
              onChange={(event) => setFromAccountId(event.target.value)}
              className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-2.5 text-xs"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.type})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-zinc-400">To account</label>
            <select
              value={toAccountId}
              onChange={(event) => setToAccountId(event.target.value)}
              className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-2.5 text-xs"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.type})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-400">Amount</label>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-2.5 text-xs"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-400">Date</label>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-2.5 text-xs"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-zinc-400">Notes (optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="e.g., Move savings to digital wallet"
              className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-2.5 py-2 text-xs resize-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !canSubmit || accounts.length < 2}
          className="h-10 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-medium"
        >
          {loading ? 'Transferring...' : 'Create transfer'}
        </button>
      </form>
    </div>
  );
}
