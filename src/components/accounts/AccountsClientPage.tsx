'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Eye,
  EyeOff,
  Landmark,
  RefreshCcw,
  Smartphone,
  Undo2,
  Wallet,
} from 'lucide-react';
import BerdeSprite from '@/components/BerdeSprite';
import AccountFormDialog from '@/components/accounts/AccountFormDialog';
import { getAccountsWithBalances, setAccountArchived } from '@/lib/local-store';
import { isSyncStateRealtimeUpdate, subscribeAppUpdates } from '@/lib/transaction-ws';
import { useNetWorthVisibility } from '@/hooks/useNetWorthVisibility';
import type { AccountType, AccountWithBalance } from '@/lib/types';

type AccountsFilter = 'all' | 'wallets' | 'bank';

const pesoFormatter = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const HIDDEN_BALANCE = '\u20B1\u2022\u2022\u2022\u2022\u2022\u2022';

function formatPeso(amount: number): string {
  return `\u20B1${pesoFormatter.format(amount)}`;
}

function isWalletType(type: AccountType): boolean {
  return type === 'Cash' || type === 'E-Wallet';
}

function isBankGroupType(type: AccountType): boolean {
  return type === 'Bank' || type === 'Other';
}

function matchesFilter(type: AccountType, filter: AccountsFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'wallets') return isWalletType(type);
  return isBankGroupType(type);
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
  if (type === 'E-Wallet') return 'bg-blue-50 text-blue-700';
  if (type === 'Bank') return 'bg-indigo-50 text-indigo-700';
  return 'bg-zinc-100 text-zinc-700';
}

export default function AccountsClientPage() {
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [filter, setFilter] = useState<AccountsFilter>('all');
  const [status, setStatus] = useState<string | null>(null);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const { visible, toggle } = useNetWorthVisibility();

  const fetchAccounts = useCallback(async () => {
    setLoading(true);

    try {
      const json = await getAccountsWithBalances({ includeArchived: true });
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

  useEffect(() => {
    const unsubscribe = subscribeAppUpdates((message) => {
      if (isSyncStateRealtimeUpdate(message)) {
        return;
      }

      void fetchAccounts();
    });

    return unsubscribe;
  }, [fetchAccounts]);

  const activeAccounts = useMemo(
    () => accounts.filter((account) => !account.isArchived),
    [accounts]
  );

  const archivedAccounts = useMemo(
    () => accounts.filter((account) => account.isArchived),
    [accounts]
  );

  const filteredAccounts = useMemo(
    () => activeAccounts.filter((account) => matchesFilter(account.type, filter)),
    [activeAccounts, filter]
  );

  const walletAccounts = useMemo(
    () => filteredAccounts.filter((account) => isWalletType(account.type)),
    [filteredAccounts]
  );

  const bankAccounts = useMemo(
    () => filteredAccounts.filter((account) => isBankGroupType(account.type)),
    [filteredAccounts]
  );

  const netWorth = useMemo(
    () => activeAccounts.reduce((sum, account) => sum + account.computedBalance, 0),
    [activeAccounts]
  );

  const berdeState = netWorth > 0 ? 'proud' : 'neutral';

  const handleArchiveToggle = async (id: string, action: 'archive' | 'restore') => {
    setSaving(true);
    setStatus(null);

    try {
      await setAccountArchived(id, action === 'archive');

      await fetchAccounts();
      setStatus(action === 'archive' ? 'Account archived.' : 'Account restored.');
    } catch (archiveError) {
      setStatus(
        archiveError instanceof Error ? archiveError.message : `Failed to ${action} account.`
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-display text-3xl font-bold text-zinc-900 dark:text-white">Accounts</h1>

          <button
            type="button"
            onClick={() => setShowFormDialog(true)}
            className="inline-flex min-h-11 items-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
          >
            + Add account
          </button>
        </div>

        {loading ? (
          <section className="mt-5 rounded-[28px] border border-[#9FE1CB] bg-[#f0faf5] p-4 sm:p-5">
            <div className="flex items-center gap-4">
              <div className="h-[72px] w-[72px] shrink-0 rounded-3xl bg-white/80" />

              <div className="min-w-0 flex-1">
                <div className="h-3 w-32 rounded-full bg-emerald-100" />
                <div className="mt-2 h-3 w-24 rounded-full bg-emerald-100" />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="h-9 w-40 rounded-full bg-emerald-100" />
                  <div className="h-10 w-10 shrink-0 rounded-full bg-emerald-100" />
                </div>
                <div className="mt-2 h-4 w-32 rounded-full bg-emerald-100" />
              </div>
            </div>
          </section>
        ) : (
          <section className="mt-5 rounded-[28px] border border-[#9FE1CB] bg-[#f0faf5] p-4 sm:p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-3xl bg-white/80">
                <BerdeSprite size={56} state={berdeState} animated={false} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">
                  Berde on accounts
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-800/70">
                  Net Worth
                </p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="inline-flex min-w-[11ch] text-3xl font-semibold tabular-nums text-emerald-950">
                    {visible ? formatPeso(netWorth) : HIDDEN_BALANCE}
                  </span>
                  <button
                    type="button"
                    onClick={toggle}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-emerald-700 transition-colors hover:bg-white/70"
                    aria-label={visible ? 'Hide net worth' : 'Show net worth'}
                  >
                    {visible ? <Eye size={20} /> : <EyeOff size={20} />}
                  </button>
                </div>
                <p className="mt-1 text-sm text-emerald-900/75">
                  across {activeAccounts.length} wallets
                </p>
              </div>
            </div>
          </section>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          {([
            ['all', 'All'],
            ['wallets', 'Wallets'],
            ['bank', 'Bank'],
          ] as const).map(([value, label]) => {
            const isActive = filter === value;

            return (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-full border px-5 py-2 text-base font-semibold transition-colors ${
                  isActive
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-7 space-y-6">
          {loading ? (
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-44 rounded-[28px] border border-zinc-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/70"
                />
              ))}
            </div>
          ) : (
            <>
              {walletAccounts.length > 0 && (
                <section>
                  <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                    Wallets
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {walletAccounts.map((account) => {
                      const Icon = getAccountIcon(account.type);

                      return (
                        <Link
                          key={account.id}
                          href={`/accounts/${account.id}`}
                          className="group rounded-[28px] border border-zinc-200 bg-white p-4 transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-500/40 dark:hover:bg-zinc-900"
                        >
                          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${getIconSurface(account.type)}`}>
                            <Icon size={24} />
                          </div>
                          <div className="mt-6">
                            <p className="truncate text-xl font-semibold text-zinc-900 dark:text-white">
                              {account.name}
                            </p>
                            <p className="mt-1 text-base text-zinc-500 dark:text-zinc-400">
                              {getAccountTypeLabel(account.type)}
                            </p>
                          </div>
                          <div className="mt-6">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                              Balance
                            </p>
                            <p className="mt-2 truncate text-2xl font-semibold text-zinc-900 dark:text-white">
                              {formatPeso(account.computedBalance)}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}

              {bankAccounts.length > 0 && (
                <section>
                  <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                    Bank Accounts
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {bankAccounts.map((account) => {
                      const Icon = getAccountIcon(account.type);

                      return (
                        <Link
                          key={account.id}
                          href={`/accounts/${account.id}`}
                          className="group rounded-[28px] border border-zinc-200 bg-white p-4 transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-500/40 dark:hover:bg-zinc-900"
                        >
                          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${getIconSurface(account.type)}`}>
                            <Icon size={24} />
                          </div>
                          <div className="mt-6">
                            <p className="truncate text-xl font-semibold text-zinc-900 dark:text-white">
                              {account.name}
                            </p>
                            <p className="mt-1 text-base text-zinc-500 dark:text-zinc-400">
                              {getAccountTypeLabel(account.type)}
                            </p>
                          </div>
                          <div className="mt-6">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                              Balance
                            </p>
                            <p className="mt-2 truncate text-2xl font-semibold text-zinc-900 dark:text-white">
                              {formatPeso(account.computedBalance)}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}

              {filteredAccounts.length === 0 && (
                <div className="rounded-[28px] border border-dashed border-zinc-300 bg-white/85 px-5 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-400">
                  No accounts match this filter.
                </div>
              )}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowArchived((current) => !current)}
          className="mt-6 inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300"
        >
          <RefreshCcw size={12} />
          {showArchived ? 'Hide archived accounts' : `Show archived accounts (${archivedAccounts.length})`}
        </button>

        {showArchived && archivedAccounts.length > 0 && (
          <div className="mt-2 space-y-2">
            {archivedAccounts.map((account) => (
              <div key={account.id} className="rounded-xl border border-zinc-200/70 p-3 dark:border-zinc-700">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{account.name}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{account.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {formatPeso(account.computedBalance)}
                    </p>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleArchiveToggle(account.id, 'restore')}
                      className="mt-1 inline-flex h-7 items-center gap-1 rounded-lg border border-zinc-200 px-2.5 text-xs dark:border-zinc-700"
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
          <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">
            {status}
          </p>
        )}
      </div>

      <AccountFormDialog
        open={showFormDialog}
        mode="create"
        onClose={() => setShowFormDialog(false)}
        onSaved={fetchAccounts}
      />
    </>
  );
}
