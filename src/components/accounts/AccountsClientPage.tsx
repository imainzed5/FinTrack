'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Eye,
  EyeOff,
  Landmark,
  RefreshCcw,
  Smartphone,
  Undo2,
  Wallet,
  X,
} from 'lucide-react';
import BerdeSprite from '@/components/BerdeSprite';
import AccountFormDialog from '@/components/accounts/AccountFormDialog';
import {
  getAccountsInsight,
  isBankGroupType,
  isWalletType,
  type AccountsInsight,
  type AccountsInsightTone,
} from '@/lib/accounts-insights';
import {
  getAccountsWithBalances,
  getTransactions,
  setAccountArchived,
} from '@/lib/local-store';
import { isSyncStateRealtimeUpdate, subscribeAppUpdates } from '@/lib/transaction-ws';
import { useNetWorthVisibility } from '@/hooks/useNetWorthVisibility';
import type { BerdeState } from '@/lib/berde/berde.types';
import type { AccountType, AccountWithBalance, Transaction } from '@/lib/types';

type AccountsFilter = 'all' | 'wallets' | 'bank';

const pesoFormatter = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const HIDDEN_BALANCE = 'P......';

function formatPeso(amount: number): string {
  return `P${pesoFormatter.format(amount)}`;
}

function formatVisibleBalance(amount: number, visible: boolean): string {
  return visible ? formatPeso(amount) : HIDDEN_BALANCE;
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

function getInsightStyles(state: BerdeState) {
  if (state === 'worried') {
    return {
      shell: 'border-amber-200 bg-amber-50/90 dark:border-amber-500/30 dark:bg-amber-500/10',
      sprite: 'bg-white/80 dark:bg-zinc-900/80',
      eyebrow: 'text-amber-700 dark:text-amber-300',
      badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
      title: 'text-amber-950 dark:text-amber-100',
      message: 'text-amber-900/80 dark:text-amber-100/85',
      data: 'text-amber-800/75 dark:text-amber-200/75',
    };
  }

  if (state === 'proud' || state === 'celebratory' || state === 'excited') {
    return {
      shell: 'border-emerald-200 bg-emerald-50/85 dark:border-emerald-500/30 dark:bg-emerald-500/10',
      sprite: 'bg-white/80 dark:bg-zinc-900/80',
      eyebrow: 'text-emerald-700 dark:text-emerald-300',
      badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      title: 'text-emerald-950 dark:text-emerald-100',
      message: 'text-emerald-900/80 dark:text-emerald-100/85',
      data: 'text-emerald-800/75 dark:text-emerald-200/75',
    };
  }

  if (state === 'helper' || state === 'motivational' || state === 'hype') {
    return {
      shell: 'border-sky-200 bg-sky-50/85 dark:border-sky-500/30 dark:bg-sky-500/10',
      sprite: 'bg-white/80 dark:bg-zinc-900/80',
      eyebrow: 'text-sky-700 dark:text-sky-300',
      badge: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
      title: 'text-sky-950 dark:text-sky-100',
      message: 'text-sky-900/80 dark:text-sky-100/85',
      data: 'text-sky-800/75 dark:text-sky-200/75',
    };
  }

  return {
    shell: 'border-zinc-200 bg-zinc-50/90 dark:border-zinc-700 dark:bg-zinc-900/80',
    sprite: 'bg-white/80 dark:bg-zinc-950/80',
    eyebrow: 'text-zinc-600 dark:text-zinc-300',
    badge: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    title: 'text-zinc-900 dark:text-zinc-100',
    message: 'text-zinc-700 dark:text-zinc-300',
    data: 'text-zinc-500 dark:text-zinc-400',
  };
}

function getDetailStyles(tone: AccountsInsightTone) {
  if (tone === 'warning') {
    return {
      shell: 'border-amber-200 bg-amber-50/90 dark:border-amber-500/20 dark:bg-amber-500/10',
      label: 'text-amber-700 dark:text-amber-300',
      value: 'text-amber-950 dark:text-amber-100',
      note: 'text-amber-900/75 dark:text-amber-200/75',
    };
  }

  if (tone === 'good') {
    return {
      shell: 'border-emerald-200 bg-emerald-50/85 dark:border-emerald-500/20 dark:bg-emerald-500/10',
      label: 'text-emerald-700 dark:text-emerald-300',
      value: 'text-emerald-950 dark:text-emerald-100',
      note: 'text-emerald-900/75 dark:text-emerald-200/75',
    };
  }

  return {
    shell: 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900',
    label: 'text-zinc-500 dark:text-zinc-400',
    value: 'text-zinc-900 dark:text-zinc-100',
    note: 'text-zinc-600 dark:text-zinc-300',
  };
}

function AccountsInsightDrawer({
  isOpen,
  onClose,
  insight,
}: {
  isOpen: boolean;
  onClose: () => void;
  insight: AccountsInsight;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const styles = getInsightStyles(insight.state);

  useEffect(() => {
    let showTimer: number | null = null;
    let hideTimer: number | null = null;
    let firstFrame = 0;
    let secondFrame = 0;

    if (isOpen) {
      showTimer = window.setTimeout(() => {
        setIsVisible(true);
        firstFrame = window.requestAnimationFrame(() => {
          secondFrame = window.requestAnimationFrame(() => setIsAnimating(true));
        });
      }, 0);
    } else {
      showTimer = window.setTimeout(() => setIsAnimating(false), 0);
      hideTimer = window.setTimeout(() => setIsVisible(false), 320);
    }

    return () => {
      if (showTimer !== null) window.clearTimeout(showTimer);
      if (hideTimer !== null) window.clearTimeout(hideTimer);
      if (firstFrame) window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isVisible, onClose]);

  if (!isVisible) {
    return null;
  }

  const drawerContent = (
    <>
      <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-zinc-300 md:hidden" />

      <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 pb-3 pt-3.5 dark:border-zinc-800 sm:px-5">
        <div className="flex items-start gap-3">
          <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${styles.sprite}`}>
            <BerdeSprite state={insight.state} size={28} animated={false} />
          </div>
          <div>
            <h2 className="font-display text-lg text-zinc-900 dark:text-zinc-100">Account insights</h2>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{insight.drawerSubtitle}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close account insights"
          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/5"
        >
          <X size={16} />
        </button>
      </div>

      <div className="max-h-[calc(82dvh-4.5rem)] overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 md:max-h-[calc(78vh-4.5rem)] sm:px-5 sm:pb-5">
        <div className="mx-auto grid w-full max-w-3xl gap-4 md:grid-cols-2">
          <div className={`rounded-[22px] border p-4 md:col-span-2 ${styles.shell}`}>
            <div className="flex flex-wrap items-center gap-2">
              <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${styles.eyebrow}`}>
                {insight.eyebrow}
              </p>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${styles.badge}`}>
                {insight.badge}
              </span>
            </div>

            <p className={`mt-2 text-lg font-semibold leading-snug ${styles.title}`}>
              {insight.title}
            </p>
            <p className={`mt-1 text-sm leading-relaxed ${styles.message}`}>
              {insight.message}
            </p>
            <p className={`mt-3 text-xs font-medium uppercase tracking-[0.08em] ${styles.data}`}>
              {insight.dataLine}
            </p>
          </div>

          {insight.details.map((detail) => {
            const detailStyles = getDetailStyles(detail.tone);

            return (
              <article key={detail.label} className={`rounded-[18px] border p-4 ${detailStyles.shell}`}>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${detailStyles.label}`}>
                  {detail.label}
                </p>
                <p className={`mt-2 text-base font-semibold leading-snug ${detailStyles.value}`}>
                  {detail.value}
                </p>
                <p className={`mt-1 text-sm leading-relaxed ${detailStyles.note}`}>
                  {detail.note}
                </p>
              </article>
            );
          })}

          <div className="rounded-[18px] border border-zinc-200 bg-zinc-50/90 p-4 md:col-span-2 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
              Berde&apos;s next move
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {insight.nextStep}
            </p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center md:items-center"
      style={{
        background: 'rgba(0, 0, 0, 0.35)',
        opacity: isAnimating ? 1 : 0,
        transition: 'opacity 280ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full md:hidden"
        style={{
          maxHeight: '82dvh',
          borderRadius: '24px 24px 0 0',
          background: '#f5f5f0',
          border: '1px solid #e4e4df',
          borderBottomWidth: 0,
          transform: isAnimating ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {drawerContent}
      </div>

      <div
        className="hidden w-full max-w-3xl md:block"
        style={{
          borderRadius: '20px',
          background: '#f5f5f0',
          border: '1px solid #e4e4df',
          maxHeight: '78vh',
          overflowY: 'auto',
          transform: isAnimating ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(8px)',
          opacity: isAnimating ? 1 : 0,
          transition:
            'transform 280ms cubic-bezier(0.4, 0, 0.2, 1), opacity 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {drawerContent}
      </div>
    </div>
  );
}

export default function AccountsClientPage() {
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [filter, setFilter] = useState<AccountsFilter>('all');
  const [status, setStatus] = useState<string | null>(null);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [showInsightsDrawer, setShowInsightsDrawer] = useState(false);
  const [saving, setSaving] = useState(false);
  const { visible, toggle } = useNetWorthVisibility();

  const fetchPageData = useCallback(async () => {
    setLoading(true);

    try {
      const [accountsJson, transactionsJson] = await Promise.all([
        getAccountsWithBalances({ includeArchived: true }),
        getTransactions(),
      ]);
      setAccounts(Array.isArray(accountsJson) ? accountsJson : []);
      setTransactions(Array.isArray(transactionsJson) ? transactionsJson : []);
    } catch {
      setAccounts([]);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPageData();
  }, [fetchPageData]);

  useEffect(() => {
    const unsubscribe = subscribeAppUpdates((message) => {
      if (isSyncStateRealtimeUpdate(message)) {
        return;
      }

      void fetchPageData();
    });

    return unsubscribe;
  }, [fetchPageData]);

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

  const accountsInsight = useMemo(
    () => getAccountsInsight({
      activeAccounts,
      archivedCount: archivedAccounts.length,
      transactions,
    }),
    [activeAccounts, archivedAccounts.length, transactions]
  );
  const berdeState = accountsInsight.state;
  const insightStyles = getInsightStyles(accountsInsight.state);

  const handleArchiveToggle = async (id: string, action: 'archive' | 'restore') => {
    setSaving(true);
    setStatus(null);

    try {
      await setAccountArchived(id, action === 'archive');
      await fetchPageData();
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
                <div className="mt-4 h-16 rounded-[22px] bg-emerald-100" />
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
                  across {activeAccounts.length} active account{activeAccounts.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowInsightsDrawer(true)}
              className={`mt-4 w-full rounded-[22px] border p-3.5 text-left transition-colors hover:bg-white/30 dark:hover:bg-zinc-900/40 sm:p-4 ${insightStyles.shell}`}
              aria-label="Open account insights"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${insightStyles.eyebrow}`}>
                      {accountsInsight.eyebrow}
                    </p>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${insightStyles.badge}`}>
                      {accountsInsight.badge}
                    </span>
                  </div>

                  <p className={`mt-2 text-[15px] font-semibold leading-snug sm:text-lg ${insightStyles.title}`}>
                    {accountsInsight.title}
                  </p>
                  <p className={`mt-1 hidden text-sm leading-relaxed sm:block sm:text-[15px] ${insightStyles.message}`}>
                    {accountsInsight.message}
                  </p>
                  <p className={`mt-3 hidden text-xs font-medium uppercase tracking-[0.08em] sm:block ${insightStyles.data}`}>
                    {accountsInsight.dataLine}
                  </p>
                </div>
                <ChevronRight size={18} className="mt-0.5 shrink-0 text-zinc-600 dark:text-zinc-300" />
              </div>
            </button>
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
                              {formatVisibleBalance(account.computedBalance, visible)}
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
                              {formatVisibleBalance(account.computedBalance, visible)}
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
                      {formatVisibleBalance(account.computedBalance, visible)}
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
        onSaved={fetchPageData}
      />
      <AccountsInsightDrawer
        isOpen={showInsightsDrawer}
        onClose={() => setShowInsightsDrawer(false)}
        insight={accountsInsight}
      />
    </>
  );
}
