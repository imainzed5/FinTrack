'use client';

import Link from 'next/link';
import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Eye,
  EyeOff,
  Plus,
  Undo2,
  X,
} from 'lucide-react';
import BerdeSprite from '@/components/BerdeSprite';
import AccountFormDialog from '@/components/accounts/AccountFormDialog';
import {
  getAccountBoardLabel,
  getAccountIconComponent,
  getAccountPalette,
  getAccountTypeBadge,
  getCompactMoneyDisplay,
  getLargestAccount,
} from '@/lib/account-ui';
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

const HIDDEN_BALANCE = '\u20B1\u2022\u2022\u2022\u2022\u2022\u2022';

function formatPeso(amount: number): string {
  return `\u20B1${pesoFormatter.format(amount)}`;
}

function formatVisibleBalance(amount: number, visible: boolean): string {
  return visible ? formatPeso(amount) : HIDDEN_BALANCE;
}

function matchesFilter(type: AccountType, filter: AccountsFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'wallets') return isWalletType(type);
  return isBankGroupType(type);
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

            <p className={`mt-2 text-lg font-semibold leading-snug ${styles.title}`}>{insight.title}</p>
            <p className={`mt-1 text-sm leading-relaxed ${styles.message}`}>{insight.message}</p>
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
                <p className={`mt-1 text-sm leading-relaxed ${detailStyles.note}`}>{detail.note}</p>
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

function getAccountStatusLine(account: AccountWithBalance): string {
  if (account.computedBalance < 0) {
    return 'Needs attention';
  }

  if (Math.abs(account.computedBalance) <= 0.01) {
    return 'Ready for funding';
  }

  if (account.isSystemCashWallet) {
    return 'Primary day-to-day lane';
  }

  return 'Active and tracked';
}

function getMetaLine(account: AccountWithBalance): string {
  if (account.expensePaymentMethod) {
    return `${getAccountBoardLabel(account.type)} \u2022 ${account.expensePaymentMethod}`;
  }

  return getAccountBoardLabel(account.type);
}

function AccountTile({
  account,
  visible,
}: {
  account: AccountWithBalance;
  visible: boolean;
}) {
  const palette = getAccountPalette(account);
  const icon = createElement(getAccountIconComponent(account), { size: 25 });

  return (
    <Link
      href={`/accounts/${account.id}`}
      className="group relative overflow-hidden rounded-[22px] border p-3.5 transition-transform duration-300 hover:-translate-y-1 sm:rounded-[30px] sm:p-5"
      style={{
        borderColor: palette.border,
        backgroundImage: palette.cardOverlay,
        backgroundColor: palette.softAccent,
        boxShadow: `0 24px 40px -26px ${palette.cardGlow}`,
      }}
    >
      <div
        className="absolute inset-0 opacity-100 transition-opacity duration-300"
        style={{ background: palette.cardBackground }}
      />
      <div
        className="absolute -right-14 -top-16 h-44 w-44 rounded-full blur-3xl transition-transform duration-500 group-hover:scale-110"
        style={{ background: palette.softAccent }}
      />
      <div className="absolute inset-x-3.5 bottom-0 h-px bg-white/20 sm:inset-x-5" />

      <div className="relative flex h-full min-h-[154px] flex-col sm:min-h-[220px]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] sm:h-14 sm:w-14 sm:rounded-[20px]"
              style={{ background: palette.iconBackground, color: palette.iconColor }}
            >
              {icon}
            </div>
            <div className="min-w-0">
              <p
                className="inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] sm:px-2.5 sm:text-[11px]"
                style={{ background: palette.mutedSurface, color: palette.secondaryText }}
              >
                {getAccountTypeBadge(account.type)}
              </p>
              <p className="mt-1 truncate text-[12px] font-medium sm:mt-2 sm:text-[15px]" style={{ color: palette.secondaryText }}>
                {getMetaLine(account)}
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 rounded-full bg-white/12 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/90 sm:px-2.5 sm:text-[11px]">
            <span className="hidden sm:inline">View</span>
            <ChevronRight size={12} />
          </span>
        </div>

        <div className="mt-4 sm:mt-8">
          <h3 className="truncate text-[1.15rem] font-semibold leading-none sm:text-[1.95rem]" style={{ color: palette.primaryText }}>
            {account.name}
          </h3>
          <p className="mt-1.5 text-[12px] leading-snug sm:mt-2 sm:text-sm" style={{ color: palette.secondaryText }}>
            {getAccountStatusLine(account)}
          </p>
        </div>

        <div className="mt-auto pt-4 sm:pt-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] sm:text-[11px] sm:tracking-[0.24em]" style={{ color: palette.mutedText }}>
            Balance
          </p>
          <p
            className="mt-1.5 overflow-hidden text-[0.98rem] font-semibold leading-tight tracking-[-0.03em] tabular-nums whitespace-nowrap sm:mt-2 sm:text-[1.9rem] sm:leading-none"
            style={{ color: palette.primaryText }}
          >
            {formatVisibleBalance(account.computedBalance, visible)}
          </p>
        </div>
      </div>
    </Link>
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
    [accounts],
  );

  const archivedAccounts = useMemo(
    () => accounts.filter((account) => account.isArchived),
    [accounts],
  );

  const filteredAccounts = useMemo(
    () => activeAccounts.filter((account) => matchesFilter(account.type, filter)),
    [activeAccounts, filter],
  );

  const walletAccounts = useMemo(
    () => filteredAccounts.filter((account) => isWalletType(account.type)),
    [filteredAccounts],
  );

  const bankAccounts = useMemo(
    () => filteredAccounts.filter((account) => isBankGroupType(account.type)),
    [filteredAccounts],
  );

  const netWorth = useMemo(
    () => activeAccounts.reduce((sum, account) => sum + account.computedBalance, 0),
    [activeAccounts],
  );

  const accountsInsight = useMemo(
    () => getAccountsInsight({
      activeAccounts,
      archivedCount: archivedAccounts.length,
      transactions,
    }),
    [activeAccounts, archivedAccounts.length, transactions],
  );

  const largestAccount = useMemo(() => getLargestAccount(activeAccounts), [activeAccounts]);
  const netWorthDisplay = useMemo(
    () =>
      getCompactMoneyDisplay(netWorth, {
        compactThreshold: 14,
        hiddenText: HIDDEN_BALANCE,
        visible,
      }),
    [netWorth, visible],
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
        archiveError instanceof Error ? archiveError.message : `Failed to ${action} account.`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-5 sm:py-6">
        <section className="rounded-[28px] border border-[#ddd9cb] bg-[linear-gradient(180deg,rgba(255,252,246,0.96)_0%,rgba(246,240,229,0.95)_100%)] p-3 shadow-[0_18px_40px_-34px_rgba(46,39,23,0.28)] sm:rounded-[34px] sm:p-5">
          <div className="flex flex-col gap-3 border-b border-[#e6e0d2] pb-3 sm:gap-4 sm:pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#8b8374]">
                Accounts board
              </p>
              <h1 className="mt-2 font-display text-[2rem] leading-none text-[#172033] sm:text-[2.8rem]">
                Accounts
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-snug text-[#6f7786] sm:text-[15px]">
                Manage the wallets and bank accounts that carry your cash flow, without the clutter.
              </p>
            </div>

            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={toggle}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#ddd8cb] bg-white/85 px-4 text-sm font-semibold text-[#223049] transition-colors hover:border-[#c8c0b0] hover:bg-white"
              >
                {visible ? <Eye size={16} /> : <EyeOff size={16} />}
                {visible ? 'Hide balances' : 'Show balances'}
              </button>
              <button
                type="button"
                onClick={() => setShowFormDialog(true)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
              >
                <Plus size={16} />
                Add account
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] sm:mt-4 sm:gap-4">
            <div className="rounded-[26px] border border-white/70 bg-[linear-gradient(160deg,rgba(14,30,40,0.96)_0%,rgba(33,62,64,0.96)_48%,rgba(55,126,92,0.92)_100%)] p-4 text-white shadow-[0_22px_48px_-32px_rgba(20,37,39,0.7)] sm:rounded-[30px] sm:p-5">
              <div className="flex flex-col gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/[0.62]">
                    Net worth
                  </p>
                  <p
                    className={`mt-2 max-w-full font-semibold leading-none tracking-[-0.05em] tabular-nums whitespace-nowrap sm:mt-3 ${
                      netWorthDisplay.compact
                        ? 'text-[clamp(2rem,2.6vw,2.95rem)]'
                        : 'text-[clamp(2.2rem,3vw,3.3rem)]'
                    }`}
                  >
                    {netWorthDisplay.text}
                  </p>
                  <p className="mt-2 max-w-sm text-sm text-white/[0.72] sm:mt-3 sm:text-[15px]">
                    Across {activeAccounts.length} active account{activeAccounts.length === 1 ? '' : 's'}
                    {largestAccount ? `, led by ${largestAccount.name}.` : '.'}
                  </p>
                </div>

              </div>

              <div className="mt-4 flex flex-col gap-3 sm:mt-5">
                <div className="flex flex-wrap gap-2">
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
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                          isActive
                            ? 'bg-white text-[#17303a] shadow-[0_10px_26px_-20px_rgba(255,255,255,0.8)]'
                            : 'border border-white/15 bg-white/[0.08] text-white/[0.74] hover:bg-white/[0.14]'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="min-w-0">
                  <div className="grid min-w-0 grid-cols-2 gap-2">
                  <div className="rounded-[18px] border border-white/12 bg-white/10 p-3 backdrop-blur-sm sm:rounded-[22px] sm:p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/[0.62]">
                      Active mix
                    </p>
                    <p className="mt-2 text-base font-semibold text-white sm:text-lg">
                      {activeAccounts.filter((account) => isWalletType(account.type)).length} wallets
                    </p>
                    <p className="text-sm text-white/[0.72]">
                      {activeAccounts.filter((account) => isBankGroupType(account.type)).length} bank-side accounts
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-white/12 bg-white/10 p-3 backdrop-blur-sm sm:rounded-[22px] sm:p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/[0.62]">
                      Focus
                    </p>
                    <p className="mt-2 break-words text-sm font-semibold text-white sm:text-base">
                      {largestAccount ? largestAccount.name : 'No primary account yet'}
                    </p>
                    <p className="text-xs leading-snug text-white/[0.72] sm:text-sm">
                      {largestAccount ? 'Largest visible balance in your stack' : 'Add your first account to start the board'}
                    </p>
                  </div>
                </div>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="rounded-[26px] border border-[#d9ebdf] bg-[#edf8f1] p-4 sm:rounded-[30px] sm:p-6">
                <div className="flex items-start gap-4">
                  <div className="h-[68px] w-[68px] shrink-0 rounded-[24px] bg-white/80" />
                  <div className="min-w-0 flex-1">
                    <div className="h-3 w-28 rounded-full bg-emerald-100" />
                    <div className="mt-2 h-8 w-2/3 rounded-full bg-emerald-100" />
                    <div className="mt-3 h-12 rounded-[20px] bg-emerald-100" />
                    <div className="mt-3 h-12 rounded-[20px] bg-emerald-100" />
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowInsightsDrawer(true)}
                className={`group rounded-[26px] border p-3.5 text-left shadow-[0_18px_40px_-34px_rgba(20,20,20,0.34)] transition-transform duration-300 hover:-translate-y-0.5 sm:rounded-[30px] sm:p-5 ${insightStyles.shell}`}
                aria-label="Open account insights"
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] sm:h-[68px] sm:w-[68px] sm:rounded-[24px] ${insightStyles.sprite}`}>
                    <BerdeSprite size={44} state={berdeState} animated={false} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${insightStyles.eyebrow}`}>
                        {accountsInsight.eyebrow}
                      </p>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${insightStyles.badge}`}>
                        {accountsInsight.badge}
                      </span>
                    </div>
                    <p className={`mt-2 text-[1.05rem] font-semibold leading-snug sm:mt-3 sm:text-[1.55rem] ${insightStyles.title}`}>
                      {accountsInsight.title}
                    </p>
                    <p className={`mt-2 hidden text-sm leading-relaxed sm:line-clamp-4 sm:block sm:text-[15px] ${insightStyles.message}`}>
                      {accountsInsight.message}
                    </p>
                    <div className="mt-3 flex items-end justify-between gap-3 sm:mt-4 sm:items-center">
                      <p className={`max-w-[8.5rem] text-[11px] font-medium uppercase tracking-[0.08em] sm:max-w-none sm:text-xs ${insightStyles.data}`}>
                        {accountsInsight.dataLine}
                      </p>
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-700 transition-transform duration-300 group-hover:translate-x-0.5 dark:text-zinc-200">
                        Open details <ChevronRight size={16} />
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            )}
          </div>
        </section>

        <div className="mt-6 space-y-7 sm:mt-8 sm:space-y-8">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-[240px] rounded-[30px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.7)_0%,rgba(245,242,235,0.92)_100%)]"
                />
              ))}
            </div>
          ) : (
            <>
              {walletAccounts.length > 0 && (
                <section>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9b9383]">
                        Wallets
                      </p>
                      <p className="mt-1 text-sm text-[#737b88]">
                        Everyday money, quick access, and faster spending lanes.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-[#e0d8c8] bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#6a7280]">
                        {walletAccounts.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowArchived((current) => !current)}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-[#65707f] transition-colors hover:text-[#1d2538]"
                      >
                        {showArchived ? `Hide archived (${archivedAccounts.length})` : `Show archived (${archivedAccounts.length})`}
                        <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 sm:gap-4">
                    {walletAccounts.map((account) => (
                      <AccountTile key={account.id} account={account} visible={visible} />
                    ))}
                  </div>
                </section>
              )}

              {bankAccounts.length > 0 && (
                <section>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9b9383]">
                        Bank Accounts
                      </p>
                      <p className="mt-1 text-sm text-[#737b88]">
                        Storage, buffers, and accounts with more distance built in.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-[#e0d8c8] bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#6a7280]">
                        {bankAccounts.length}
                      </span>
                      {walletAccounts.length === 0 ? (
                        <button
                          type="button"
                          onClick={() => setShowArchived((current) => !current)}
                          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-[#65707f] transition-colors hover:text-[#1d2538]"
                        >
                          {showArchived ? `Hide archived (${archivedAccounts.length})` : `Show archived (${archivedAccounts.length})`}
                          <span aria-hidden="true">→</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 sm:gap-4">
                    {bankAccounts.map((account) => (
                      <AccountTile key={account.id} account={account} visible={visible} />
                    ))}
                  </div>
                </section>
              )}

              {filteredAccounts.length === 0 && (
                <div className="rounded-[30px] border border-dashed border-[#d8d0bf] bg-[rgba(255,253,248,0.86)] px-5 py-12 text-center text-sm text-[#6f7786]">
                  No accounts match this filter.
                </div>
              )}
            </>
          )}
        </div>

        {showArchived && archivedAccounts.length > 0 ? (
          <div className="mt-8 grid gap-3 md:grid-cols-2">
              {archivedAccounts.map((account) => {
                const palette = getAccountPalette(account);
                const icon = createElement(getAccountIconComponent(account), { size: 22 });

                return (
                  <div
                    key={account.id}
                    className="rounded-[24px] border bg-white/80 p-4 shadow-[0_16px_30px_-28px_rgba(30,34,41,0.35)]"
                    style={{ borderColor: palette.border }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px]"
                          style={{ background: palette.softAccent, color: palette.accent }}
                        >
                          {icon}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-[#1d2538]">{account.name}</p>
                          <p className="mt-1 text-sm text-[#758090]">{getMetaLine(account)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums text-[#1d2538]">
                          {formatVisibleBalance(account.computedBalance, visible)}
                        </p>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void handleArchiveToggle(account.id, 'restore')}
                          className="mt-2 inline-flex min-h-8 items-center gap-1 rounded-full border border-[#d8d0bf] px-3 text-xs font-semibold text-[#5b6470] transition-colors hover:border-[#c7bcaa] hover:text-[#1d2538]"
                        >
                          <Undo2 size={12} />
                          Restore
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        ) : null}

        {status ? (
          <p className="mt-4 text-sm text-[#5f6a78] dark:text-zinc-300">{status}</p>
        ) : null}
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
