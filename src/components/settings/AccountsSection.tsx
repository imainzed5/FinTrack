'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Pencil, Plus, RefreshCcw, Undo2, Wallet } from 'lucide-react';
import { ACCOUNT_TYPES, type AccountType } from '@/lib/types';
import { formatCurrencySigned } from '@/lib/utils';

interface AccountWithBalance {
  id: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  color?: string;
  icon?: string;
  isArchived: boolean;
  computedBalance: number;
}

interface AccountFormState {
  id?: string;
  name: string;
  type: AccountType;
  initialBalance: string;
  color: string;
  icon: string;
}

const INITIAL_FORM: AccountFormState = {
  name: '',
  type: 'Cash',
  initialBalance: '0',
  color: '',
  icon: '',
};

export default function AccountsSection() {
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AccountFormState>(INITIAL_FORM);
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/accounts?includeArchived=true', { cache: 'no-store' });
      const json = await res.json();
      setAccounts(Array.isArray(json) ? json : []);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  const activeAccounts = useMemo(
    () => accounts.filter((account) => !account.isArchived),
    [accounts]
  );

  const archivedAccounts = useMemo(
    () => accounts.filter((account) => account.isArchived),
    [accounts]
  );

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setShowForm(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setStatus('Account name is required.');
      return;
    }

    setSaving(true);
    setStatus(null);
    try {
      if (form.id) {
        const res = await fetch('/api/accounts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: form.id,
            name: form.name.trim(),
            type: form.type,
            initialBalance: Number.parseFloat(form.initialBalance || '0') || 0,
            color: form.color.trim() || null,
            icon: form.icon.trim() || null,
          }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to update account.');
        }
      } else {
        const res = await fetch('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            type: form.type,
            initialBalance: Number.parseFloat(form.initialBalance || '0') || 0,
            color: form.color.trim() || null,
            icon: form.icon.trim() || null,
          }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to create account.');
        }
      }

      await fetchAccounts();
      resetForm();
      setStatus('Account saved.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to save account.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async (id: string, action: 'archive' | 'restore') => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `Failed to ${action} account.`);
      }

      await fetchAccounts();
      setStatus(action === 'archive' ? 'Account archived.' : 'Account restored.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `Failed to ${action} account.`);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (account: AccountWithBalance) => {
    setShowForm(true);
    setForm({
      id: account.id,
      name: account.name,
      type: account.type,
      initialBalance: account.initialBalance.toString(),
      color: account.color || '',
      icon: account.icon || '',
    });
  };

  const handleAdjustBalance = async (accountId: string) => {
    const raw = adjustments[accountId] ?? '';
    const amount = Number.parseFloat(raw);
    if (!Number.isFinite(amount) || amount === 0) {
      setStatus('Enter a non-zero adjustment amount (positive or negative).');
      return;
    }

    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: accountId,
          action: 'adjust-balance',
          amount,
          note: 'Manual account balance adjustment',
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to adjust balance.');
      }

      setAdjustments((prev) => ({ ...prev, [accountId]: '' }));
      await fetchAccounts();
      setStatus('Balance adjusted successfully.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to adjust balance.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-white">Accounts</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Real balances per wallet/account. Budget limits remain separate.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm((prev) => {
              const next = !prev;
              if (!next) {
                setForm(INITIAL_FORM);
              }
              return next;
            });
          }}
          className="h-8 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium inline-flex items-center gap-1.5"
        >
          <Plus size={13} />
          {showForm ? 'Cancel' : 'Add account'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="sm:col-span-2">
            <label className="text-[11px] text-zinc-500 dark:text-zinc-400">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Main Wallet"
              className="mt-1 w-full h-8 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 text-xs"
            />
          </div>

          <div>
            <label className="text-[11px] text-zinc-500 dark:text-zinc-400">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as AccountType }))}
              className="mt-1 w-full h-8 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 text-xs"
            >
              {ACCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] text-zinc-500 dark:text-zinc-400">Starting balance</label>
            <input
              type="number"
              step="0.01"
              value={form.initialBalance}
              onChange={(e) => setForm((prev) => ({ ...prev, initialBalance: e.target.value }))}
              placeholder="0.00"
              className="mt-1 w-full h-8 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 text-xs"
            />
          </div>

          <div>
            <label className="text-[11px] text-zinc-500 dark:text-zinc-400">Color (optional)</label>
            <input
              value={form.color}
              onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
              placeholder="#1D9E75"
              className="mt-1 w-full h-8 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 text-xs"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-[11px] text-zinc-500 dark:text-zinc-400">Icon (optional)</label>
            <input
              value={form.icon}
              onChange={(e) => setForm((prev) => ({ ...prev, icon: e.target.value }))}
              placeholder="wallet"
              className="mt-1 w-full h-8 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 text-xs"
            />
          </div>

          <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={resetForm}
              className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-8 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium disabled:opacity-60"
            >
              {saving ? 'Saving...' : form.id ? 'Save changes' : 'Create account'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-xs text-zinc-400 py-6">Loading accounts...</div>
      ) : activeAccounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-4 text-xs text-zinc-500 dark:text-zinc-400">
          No active accounts yet. Create one to track real balances.
        </div>
      ) : (
        <div className="space-y-2">
          {activeAccounts.map((account) => (
            <div key={account.id} className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 bg-zinc-50 dark:bg-zinc-800">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-zinc-900 dark:text-zinc-100 font-medium truncate">
                    {account.name}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {account.type}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatCurrencySigned(account.computedBalance)}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">computed balance</p>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Adjust (+/-)"
                  value={adjustments[account.id] ?? ''}
                  onChange={(e) => setAdjustments((prev) => ({ ...prev, [account.id]: e.target.value }))}
                  className="h-8 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 text-xs"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleAdjustBalance(account.id)}
                  className="h-8 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium disabled:opacity-60"
                >
                  Apply
                </button>
              </div>

              <div className="mt-2.5 flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => openEdit(account)}
                  className="h-7 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs inline-flex items-center gap-1"
                >
                  <Pencil size={12} /> Edit
                </button>
                <button
                  type="button"
                  disabled={saving || activeAccounts.length <= 1}
                  onClick={() => handleArchiveToggle(account.id, 'archive')}
                  className="h-7 px-2.5 rounded-lg border border-amber-200 text-amber-700 dark:border-amber-700 dark:text-amber-300 text-xs inline-flex items-center gap-1 disabled:opacity-50"
                >
                  <Archive size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowArchived((prev) => !prev)}
        className="mt-3 text-xs text-zinc-600 dark:text-zinc-300 inline-flex items-center gap-1"
      >
        <RefreshCcw size={12} />
        {showArchived ? 'Hide archived accounts' : `Show archived accounts (${archivedAccounts.length})`}
      </button>

      {showArchived && archivedAccounts.length > 0 && (
        <div className="mt-2 space-y-2">
          {archivedAccounts.map((account) => (
            <div key={account.id} className="rounded-xl border border-zinc-200/70 dark:border-zinc-700 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">{account.name}</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{account.type}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {formatCurrencySigned(account.computedBalance)}
                  </p>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleArchiveToggle(account.id, 'restore')}
                    className="mt-1 h-7 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs inline-flex items-center gap-1"
                  >
                    <Undo2 size={12} /> Restore
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {status && (
        <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300 inline-flex items-center gap-1.5">
          <Wallet size={12} /> {status}
        </p>
      )}
    </div>
  );
}
