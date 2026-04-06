'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { Debt, DebtDirection, DebtInput } from '@/lib/types';

interface AddDebtModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitDebt: (input: DebtInput) => Promise<void>;
  initialDebt?: Debt | null;
}

interface DebtFormState {
  direction: DebtDirection;
  personName: string;
  amount: string;
  reason: string;
  date: string;
}

function getInitialFormState(initialDebt?: Debt | null): DebtFormState {
  if (initialDebt) {
    return {
      direction: initialDebt.direction,
      personName: initialDebt.personName,
      amount: initialDebt.amount.toFixed(2),
      reason: initialDebt.reason ?? '',
      date: initialDebt.date,
    };
  }

  return {
    direction: 'owing',
    personName: '',
    amount: '',
    reason: '',
    date: new Date().toISOString().split('T')[0],
  };
}

function normalizeDecimalInput(value: string): string {
  const sanitized = value.replace(/[^0-9.]/g, '');
  const dotIndex = sanitized.indexOf('.');
  if (dotIndex === -1) return sanitized;
  return `${sanitized.slice(0, dotIndex + 1)}${sanitized.slice(dotIndex + 1).replace(/\./g, '')}`;
}

export default function AddDebtModal({
  open,
  onClose,
  onSubmitDebt,
  initialDebt,
}: AddDebtModalProps) {
  const titleId = useId();
  const [formState, setFormState] = useState<DebtFormState>(() => getInitialFormState(initialDebt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditMode = Boolean(initialDebt);
  const { direction, personName, amount, reason, date } = formState;

  const amountValue = useMemo(() => Number.parseFloat(amount), [amount]);
  const isFormValid =
    personName.trim().length > 0 &&
    reason.trim().length > 0 &&
    Number.isFinite(amountValue) &&
    amountValue > 0;

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
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

  if (!open) {
    return null;
  }

  const resetForm = () => {
    setFormState(getInitialFormState(initialDebt));
    setSaving(false);
    setError(null);
  };

  const handleClose = () => {
    if (saving) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!isFormValid) {
      setError('Please complete all required fields.');
      return;
    }

    setSaving(true);

    try {
      await onSubmitDebt({
        direction,
        personName: personName.trim(),
        amount: Number(amountValue.toFixed(2)),
        reason: reason.trim(),
        date,
      });
      handleClose();
    } catch {
      setError(isEditMode ? 'Unable to save debt right now. Please try again.' : 'Unable to add debt right now. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full animate-slide-up"
      >
        <form
          onSubmit={handleSubmit}
          className="bg-zinc-100 dark:bg-zinc-900 rounded-3xl p-3 flex flex-col gap-2 w-full max-w-sm mx-auto overflow-y-auto max-h-[100dvh] modal-shell modal-content-scroll"
        >
          <div className="flex items-center justify-between px-0.5 pt-0.5">
            <p id={titleId} className="font-display text-2xl font-bold text-zinc-900 dark:text-white">
              {isEditMode ? 'Edit Debt' : 'Add Debt'}
            </p>
            <button
              type="button"
              onClick={handleClose}
              aria-label={isEditMode ? 'Close edit debt modal' : 'Close add debt modal'}
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

          <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 px-3.5 py-3 flex flex-col gap-2.5">
            <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              Direction
            </p>

            <div className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-1">
              <button
                type="button"
                onClick={() => setFormState((current) => ({ ...current, direction: 'owing' }))}
                className={direction === 'owing'
                  ? 'h-8 rounded-lg bg-red-100 text-red-600 text-xs font-semibold'
                  : 'h-8 rounded-lg text-zinc-500 dark:text-zinc-400 text-xs font-semibold'}
              >
                I owe someone
              </button>
              <button
                type="button"
                onClick={() => setFormState((current) => ({ ...current, direction: 'owed' }))}
                className={direction === 'owed'
                  ? 'h-8 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-semibold'
                  : 'h-8 rounded-lg text-zinc-500 dark:text-zinc-400 text-xs font-semibold'}
              >
                Someone owes me
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="debt-person" className="text-[10px] text-zinc-400">Person</label>
              <input
                id="debt-person"
                type="text"
                value={personName}
                onChange={(event) => setFormState((current) => ({ ...current, personName: event.target.value }))}
                placeholder="e.g., Marco Castro"
                className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-2.5 text-xs text-zinc-700 dark:text-zinc-300 placeholder-zinc-300 dark:placeholder-zinc-600 outline-none focus:border-[#1D9E75]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="debt-amount" className="text-[10px] text-zinc-400">Amount</label>
              <div className="grid grid-cols-[56px_1fr] gap-2">
                <div className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  ₱
                </div>
                <input
                  id="debt-amount"
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setFormState((current) => ({
                    ...current,
                    amount: normalizeDecimalInput(event.target.value),
                  }))}
                  placeholder="0.00"
                  className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-2.5 text-xs text-zinc-700 dark:text-zinc-300 placeholder-zinc-300 dark:placeholder-zinc-600 outline-none focus:border-[#1D9E75]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="debt-reason" className="text-[10px] text-zinc-400">Reason</label>
              <input
                id="debt-reason"
                type="text"
                value={reason}
                onChange={(event) => setFormState((current) => ({ ...current, reason: event.target.value }))}
                placeholder="e.g., Lunch at Jollibee"
                className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-2.5 text-xs text-zinc-700 dark:text-zinc-300 placeholder-zinc-300 dark:placeholder-zinc-600 outline-none focus:border-[#1D9E75]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="debt-date" className="text-[10px] text-zinc-400">Date</label>
              <input
                id="debt-date"
                type="date"
                value={date}
                onChange={(event) => setFormState((current) => ({ ...current, date: event.target.value }))}
                className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-2.5 text-xs text-zinc-700 dark:text-zinc-300 outline-none focus:border-[#1D9E75]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!isFormValid || saving}
            className="h-11 rounded-xl bg-[#1D9E75] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? (isEditMode ? 'Saving...' : 'Adding...') : (isEditMode ? 'Save Changes' : 'Add Debt')}
          </button>
        </form>
      </div>
    </div>
  );
}
