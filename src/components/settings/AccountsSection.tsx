'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ChevronDown,
  Landmark,
  Pencil,
  Plus,
  Smartphone,
  Undo2,
  Wallet,
} from 'lucide-react';
import AccountAdjustDialog from '@/components/accounts/AccountAdjustDialog';
import AccountFormDialog from '@/components/accounts/AccountFormDialog';
import type { AccountType, AccountWithBalance } from '@/lib/types';
import { formatCurrencySigned } from '@/lib/utils';

export interface AccountsSectionSummary {
  activeCount: number;
  archivedCount: number;
  cashWalletName: string | null;
}

interface AccountsSectionProps {
  onSummaryChange?: (summary: AccountsSectionSummary) => void;
}

function getAccountBadge(account: AccountWithBalance): string | null {
  return account.isSystemCashWallet ? 'Cash wallet' : null;
}

function getAccountTypeLabel(type: AccountType): string {
  if (type === 'Cash') return 'Cash wallet';
  if (type === 'E-Wallet') return 'Digital wallet';
  if (type === 'Bank') return 'Bank account';
  return 'Other account';
}

function getAccountIcon(type: AccountType) {
  if (type === 'Cash') return Wallet;
  if (type === 'E-Wallet') return Smartphone;
  if (type === 'Bank') return Landmark;
  return Wallet;
}

function getIconSurface(type: AccountType): string {
  if (type === 'Cash') return 'bg-emerald-50 text-emerald-700';
  if (type === 'E-Wallet') return 'bg-sky-50 text-sky-700';
  if (type === 'Bank') return 'bg-amber-50 text-amber-700';
  return 'bg-zinc-100 text-zinc-700';
}

export default function AccountsSection({
  onSummaryChange,
}: AccountsSectionProps = {}) {
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountWithBalance | null>(null);
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [adjustingAccount, setAdjustingAccount] = useState<AccountWithBalance | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/accounts?includeArchived=true', {
        cache: 'no-store',
      });
      const json = await response.json();
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

  const cashWalletAccount = useMemo(
    () => activeAccounts.find((account) => account.isSystemCashWallet) ?? null,
    [activeAccounts]
  );

  useEffect(() => {
    onSummaryChange?.({
      activeCount: activeAccounts.length,
      archivedCount: archivedAccounts.length,
      cashWalletName: cashWalletAccount?.name ?? null,
    });
  }, [
    activeAccounts.length,
    archivedAccounts.length,
    cashWalletAccount?.name,
    onSummaryChange,
  ]);

  const closeFormDialog = () => {
    setShowFormDialog(false);
    setEditingAccount(null);
  };

  const closeAdjustDialog = () => {
    setShowAdjustDialog(false);
    setAdjustingAccount(null);
  };

  const handleArchiveToggle = async (id: string, action: 'archive' | 'restore') => {
    setSaving(true);
    setStatus(null);

    try {
      const response = await fetch('/api/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Failed to ${action} account.`);
      }

      await fetchAccounts();
      setExpandedAccountId(null);
      setStatus(action === 'archive' ? 'Account archived.' : 'Account restored.');
    } catch (archiveError) {
      setStatus(
        archiveError instanceof Error
          ? archiveError.message
          : `Failed to ${action} account.`
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSavedAccount = async () => {
    await fetchAccounts();
    setStatus(editingAccount ? 'Account updated.' : 'Account created.');
  };

  const handleAdjustedAccount = async () => {
    await fetchAccounts();
    setStatus('Balance adjusted successfully.');
  };

  const openCreateDialog = () => {
    setEditingAccount(null);
    setShowFormDialog(true);
  };

  const openEditDialog = (account: AccountWithBalance) => {
    setEditingAccount(account);
    setShowFormDialog(true);
    setExpandedAccountId(null);
  };

  const openAdjustDialog = (account: AccountWithBalance) => {
    setAdjustingAccount(account);
    setShowAdjustDialog(true);
    setExpandedAccountId(null);
  };

  return (
    <>
      <div className="rounded-[30px] border border-[color:var(--color-border-tertiary,#ddd8ca)] bg-white/92 p-4 shadow-[0_12px_34px_rgba(42,42,28,0.05)] backdrop-blur sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#eef7f0] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1D9E75]">
              <Wallet size={12} />
              Accounts
            </div>
            <h3 className="mt-3 font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Active accounts first
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              Settings stays focused on the balances you actively use. Archived accounts remain accessible, but quietly out of the way.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/accounts"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-[color:var(--color-border-secondary,#d9d7cf)] px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-[#f5f1e8] dark:text-zinc-200"
            >
              Full accounts page
            </Link>
            <button
              type="button"
              onClick={openCreateDialog}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-[#1D9E75] px-4 text-sm font-medium text-white transition-colors hover:bg-[#187f5d]"
            >
              <Plus size={14} />
              Add account
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-[24px] border border-[#e8e1d4] bg-[#fbf7ee] px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Active accounts
            </p>
            <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {activeAccounts.length}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Shown by default in Settings
            </p>
          </div>
          <div className="rounded-[24px] border border-[#e8e1d4] bg-[#fbf7ee] px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Archived
            </p>
            <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {archivedAccounts.length}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Hidden until you expand them
            </p>
          </div>
          <div className="rounded-[24px] border border-[#e8e1d4] bg-[#fbf7ee] px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Cash wallet
            </p>
            <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {cashWalletAccount?.name ?? 'Not available'}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              System wallet for cash moves
            </p>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Active accounts ({activeAccounts.length})
            </h4>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Lightweight account management lives here. Deeper browsing stays on the full Accounts page.
            </p>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-28 animate-pulse rounded-[26px] border border-[#e8dfd0] bg-[#fbf8f1]"
                />
              ))}
            </div>
          ) : activeAccounts.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-zinc-300 bg-[#fbf8f1] px-4 py-5 text-sm text-zinc-500">
              No active accounts yet. Create one to start tracking real balances.
            </div>
          ) : (
            <div className="space-y-3">
              {activeAccounts.map((account) => {
                const badge = getAccountBadge(account);
                const Icon = getAccountIcon(account.type);
                const expanded = expandedAccountId === account.id;

                return (
                  <article
                    key={account.id}
                    className="rounded-[28px] border border-[#e8dfd0] bg-[#fbf8f1] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${getIconSurface(account.type)}`}
                        >
                          <Icon size={18} />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {account.name}
                            </p>
                            {badge ? (
                              <span className="inline-flex rounded-full bg-[#e1f5ee] px-2 py-0.5 text-[11px] font-medium text-[#1D9E75]">
                                {badge}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            {getAccountTypeLabel(account.type)}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2 text-right">
                        <div>
                          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                            {formatCurrencySigned(account.computedBalance)}
                          </p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            computed balance
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedAccountId((current) =>
                              current === account.id ? null : account.id
                            )
                          }
                          className="inline-flex min-h-9 items-center justify-center gap-1 rounded-full border border-[#ddd6c8] bg-white/80 px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-white sm:hidden"
                        >
                          Manage
                          <ChevronDown
                            size={14}
                            className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </div>
                    </div>

                    {expanded ? (
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:hidden">
                        <button
                          type="button"
                          onClick={() => openAdjustDialog(account)}
                          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                        >
                          Adjust balance
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditDialog(account)}
                          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                        >
                          <Pencil size={14} />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={saving || activeAccounts.length <= 1}
                          onClick={() => void handleArchiveToggle(account.id, 'archive')}
                          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-amber-200 bg-white px-4 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50"
                        >
                          <Archive size={14} />
                          Archive
                        </button>
                      </div>
                    ) : null}

                    <div className="mt-3 hidden items-center gap-2 sm:flex">
                      <button
                        type="button"
                        onClick={() => openAdjustDialog(account)}
                        className="inline-flex min-h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                      >
                        Adjust balance
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditDialog(account)}
                        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                      >
                        <Pencil size={14} />
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={saving || activeAccounts.length <= 1}
                        onClick={() => void handleArchiveToggle(account.id, 'archive')}
                        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-amber-200 bg-white px-4 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50"
                      >
                        <Archive size={14} />
                        Archive
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowArchived((current) => !current)}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#ddd6c8] bg-white/80 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-white"
        >
          {showArchived ? 'Hide archived accounts' : `Show archived accounts (${archivedAccounts.length})`}
          <ChevronDown
            size={14}
            className={`transition-transform ${showArchived ? 'rotate-180' : ''}`}
          />
        </button>

        {showArchived && archivedAccounts.length > 0 ? (
          <div className="mt-3 rounded-[28px] border border-[color:var(--color-border-secondary,#d9d7cf)] bg-[#f7f3ea] p-4">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Archived accounts ({archivedAccounts.length})
            </h4>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Archived accounts stay out of the way here, but you can restore them anytime.
            </p>

            <div className="mt-3 space-y-2.5">
              {archivedAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex flex-col gap-3 rounded-[24px] border border-[#e3dccd] bg-white/88 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                        {account.name}
                      </p>
                      {account.isSystemCashWallet ? (
                        <span className="inline-flex rounded-full bg-[#e1f5ee] px-2 py-0.5 text-[11px] font-medium text-[#1D9E75]">
                          Cash wallet
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {getAccountTypeLabel(account.type)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {formatCurrencySigned(account.computedBalance)}
                    </p>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleArchiveToggle(account.id, 'restore')}
                      className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                    >
                      <Undo2 size={14} />
                      Restore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {status ? (
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#eef7f0] px-3 py-2 text-sm text-[#1D9E75]">
            <Wallet size={14} />
            {status}
          </p>
        ) : null}
      </div>

      <AccountFormDialog
        open={showFormDialog}
        mode={editingAccount ? 'edit' : 'create'}
        account={editingAccount}
        onClose={closeFormDialog}
        onSaved={handleSavedAccount}
      />

      <AccountAdjustDialog
        open={showAdjustDialog}
        account={adjustingAccount}
        onClose={closeAdjustDialog}
        onAdjusted={handleAdjustedAccount}
      />
    </>
  );
}
