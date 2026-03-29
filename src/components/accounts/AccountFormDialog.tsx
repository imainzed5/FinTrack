'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { ACCOUNT_TYPES, type AccountType, type AccountWithBalance } from '@/lib/types';
import { createAccount, updateAccount } from '@/lib/local-store';

interface AccountFormValues {
  name: string;
  type: AccountType;
  initialBalance: string;
  color: string;
  icon: string;
}

interface AccountFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  account?: AccountWithBalance | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

const INITIAL_VALUES: AccountFormValues = {
  name: '',
  type: 'Cash',
  initialBalance: '0',
  color: '',
  icon: '',
};

export default function AccountFormDialog({
  open,
  mode,
  account,
  onClose,
  onSaved,
}: AccountFormDialogProps) {
  const [values, setValues] = useState<AccountFormValues>(INITIAL_VALUES);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = mode === 'create' ? 'Add account' : 'Edit account';
  const actionLabel = mode === 'create' ? 'Create account' : 'Save changes';

  const normalizedInitialValues = useMemo<AccountFormValues>(() => {
    if (mode === 'edit' && account) {
      return {
        name: account.name,
        type: account.type,
        initialBalance: String(account.initialBalance),
        color: account.color || '',
        icon: account.icon || '',
      };
    }

    return INITIAL_VALUES;
  }, [account, mode]);

  useEffect(() => {
    if (!open) return;
    setValues(normalizedInitialValues);
    setError(null);
    setSaving(false);
  }, [normalizedInitialValues, open]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!values.name.trim()) {
      setError('Account name is required.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (mode === 'create') {
        await createAccount({
          name: values.name.trim(),
          type: values.type,
          initialBalance: Number.parseFloat(values.initialBalance || '0') || 0,
          color: values.color.trim() || null,
          icon: values.icon.trim() || null,
        });
      } else if (account) {
        await updateAccount(account.id, {
          name: values.name.trim(),
          type: values.type,
          initialBalance: Number.parseFloat(values.initialBalance || '0') || 0,
          color: values.color.trim() || null,
          icon: values.icon.trim() || null,
        });
      }

      await onSaved();
      onClose();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : `Failed to ${mode} account.`
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
      aria-labelledby="account-form-title"
    >
      <div
        className="w-full max-w-md rounded-[28px] bg-white p-5 shadow-xl dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
              Accounts
            </p>
            <h2
              id="account-form-title"
              className="mt-1 font-display text-2xl font-bold text-zinc-900 dark:text-white"
            >
              {title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
            aria-label="Close account form"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Name</label>
            <input
              value={values.name}
              onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
              placeholder="e.g. Cash"
              className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition-colors focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Type</label>
              <select
                value={values.type}
                onChange={(event) => setValues((current) => ({ ...current, type: event.target.value as AccountType }))}
                className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition-colors focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950"
              >
                {ACCOUNT_TYPES.map((accountType) => (
                  <option key={accountType} value={accountType}>
                    {accountType}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Starting balance</label>
              <input
                type="number"
                step="0.01"
                value={values.initialBalance}
                onChange={(event) => setValues((current) => ({ ...current, initialBalance: event.target.value }))}
                className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition-colors focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Color</label>
              <input
                value={values.color}
                onChange={(event) => setValues((current) => ({ ...current, color: event.target.value }))}
                placeholder="#1D9E75"
                className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition-colors focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Icon</label>
              <input
                value={values.icon}
                onChange={(event) => setValues((current) => ({ ...current, icon: event.target.value }))}
                placeholder="wallet"
                className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition-colors focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
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
              className="min-h-11 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-60"
            >
              {saving ? 'Saving...' : actionLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
