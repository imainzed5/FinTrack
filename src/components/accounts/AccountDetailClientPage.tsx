'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createElement, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowRightLeft,
  Eye,
  EyeOff,
  Pencil,
  Wallet,
} from 'lucide-react';
import AddExpenseModal from '@/components/AddExpenseModal';
import AccountAdjustDialog from '@/components/accounts/AccountAdjustDialog';
import AccountFormDialog from '@/components/accounts/AccountFormDialog';
import TransactionList from '@/components/TransactionList';
import TransferModal from '@/components/TransferModal';
import {
  getAccountDetailSummary,
  getCashflowMixContext,
  getAccountIconComponent,
  getAccountPalette,
  getAccountTypeBadge,
  getAccountTypeLabel,
  getWeeklyActivitySummary,
} from '@/lib/account-ui';
import { getAccountsWithBalances, getTransactions, setAccountArchived } from '@/lib/local-store';
import { isSyncStateRealtimeUpdate, subscribeAppUpdates } from '@/lib/transaction-ws';
import { useNetWorthVisibility } from '@/hooks/useNetWorthVisibility';
import type { AccountWithBalance, Transaction } from '@/lib/types';

interface AccountDetailClientPageProps {
  accountId: string;
}

type ActiveAction = 'deposit' | 'withdraw' | 'transfer' | 'adjust' | null;

type ExpenseModalState = {
  defaultAccountId?: string;
  defaultLinkedTransferGroupId?: string;
  defaultEntryType: 'expense' | 'income';
} | null;

type WeeklyBar = {
  key: string;
  label: string;
  shortLabel: string;
  net: number;
  direction: 'in' | 'out' | 'flat';
  height: number;
};

const pesoFormatter = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const HIDDEN_BALANCE = '\u20B1\u2022\u2022\u2022\u2022\u2022\u2022';

function formatPeso(amount: number): string {
  return `\u20B1${pesoFormatter.format(amount)}`;
}

function formatSignedPeso(amount: number): string {
  const formatted = formatPeso(Math.abs(amount));

  if (amount > 0) return `+${formatted}`;
  if (amount < 0) return `-${formatted}`;
  return formatted;
}

function getSignedTransactionAmount(transaction: Transaction): number {
  if (transaction.type === 'income') {
    return Math.abs(transaction.amount);
  }

  if (transaction.type === 'savings') {
    return transaction.savingsMeta?.depositType === 'withdrawal'
      ? -Math.abs(transaction.amount)
      : Math.abs(transaction.amount);
  }

  return -Math.abs(transaction.amount);
}

function isInCurrentMonth(dateValue: string): boolean {
  const date = parseISO(dateValue);
  const now = new Date();

  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function getDateGroupLabel(dateValue: string): string {
  const date = parseISO(dateValue);
  if (isToday(date)) return 'TODAY';
  if (isYesterday(date)) return 'YESTERDAY';
  return format(date, 'MMM d').toUpperCase();
}

function getActivityLabel(dateValue: string | null): string {
  if (!dateValue) return 'No activity yet';

  const date = parseISO(dateValue);
  if (isToday(date)) return 'Active today';
  if (isYesterday(date)) return 'Active yesterday';
  return `Last active ${format(date, 'MMM d')}`;
}

function getUpdatedLabel(dateValue: string | null): string {
  if (!dateValue) return 'Updated just now';

  const date = parseISO(dateValue);
  if (isToday(date)) return 'Updated today';
  if (isYesterday(date)) return 'Updated yesterday';
  return `Updated ${format(date, 'MMM d')}`;
}

function buildWeeklyBars(transactions: Transaction[]): WeeklyBar[] {
  const today = new Date();
  const dailyTotals = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const dayKey = date.toISOString().split('T')[0];
    const net = transactions
      .filter((transaction) => transaction.date.startsWith(dayKey))
      .reduce((sum, transaction) => sum + getSignedTransactionAmount(transaction), 0);

    return {
      key: dayKey,
      label: format(date, 'EEE'),
      shortLabel: format(date, 'EEEEE'),
      net,
    };
  });

  const maxAbs = Math.max(...dailyTotals.map((item) => Math.abs(item.net)), 1);

  return dailyTotals.map((item) => ({
    key: item.key,
    label: item.label,
    shortLabel: item.shortLabel,
    net: item.net,
    direction: item.net > 0 ? 'in' : item.net < 0 ? 'out' : 'flat',
    height: Math.max(12, Math.round((Math.abs(item.net) / maxAbs) * 72)),
  }));
}

function ActionButton({
  label,
  accentClass,
  icon,
  onClick,
}: {
  label: string;
  accentClass: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[96px] flex-col items-center justify-center gap-3 rounded-[24px] border border-[#ddd5c7] bg-white/80 p-4 text-center shadow-[0_16px_30px_-28px_rgba(31,36,48,0.45)] transition-transform duration-300 hover:-translate-y-0.5 ${accentClass}`}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#f8f5ee]">{icon}</span>
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}

export default function AccountDetailClientPage({ accountId }: AccountDetailClientPageProps) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [expenseModalState, setExpenseModalState] = useState<ExpenseModalState>(null);
  const [archiveSaving, setArchiveSaving] = useState(false);
  const [activeWeeklyBarKey, setActiveWeeklyBarKey] = useState<string | null>(null);
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

  const account = useMemo(
    () => accounts.find((item) => item.id === accountId) ?? null,
    [accountId, accounts],
  );

  const accountTransactions = useMemo(() => {
    return transactions
      .filter((transaction) => transaction.accountId === accountId)
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
  }, [accountId, transactions]);

  const monthlyFlow = useMemo(() => {
    return accountTransactions
      .filter((transaction) => isInCurrentMonth(transaction.date))
      .reduce((sum, transaction) => sum + getSignedTransactionAmount(transaction), 0);
  }, [accountTransactions]);

  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, Transaction[]>();

    accountTransactions.forEach((transaction) => {
      const key = format(parseISO(transaction.date), 'yyyy-MM-dd');
      const bucket = groups.get(key) ?? [];
      bucket.push(transaction);
      groups.set(key, bucket);
    });

    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      label: getDateGroupLabel(items[0].date),
      total: items.reduce((sum, item) => sum + getSignedTransactionAmount(item), 0),
      items,
    }));
  }, [accountTransactions]);

  const detailSummary = useMemo(
    () => getAccountDetailSummary(accountId, transactions),
    [accountId, transactions],
  );

  const weeklyBars = useMemo(() => buildWeeklyBars(accountTransactions), [accountTransactions]);
  const weeklySummary = useMemo(
    () => getWeeklyActivitySummary(weeklyBars.map((bar) => ({ label: bar.label, net: bar.net }))),
    [weeklyBars],
  );
  const hasSparseWeeklyActivity = useMemo(
    () => weeklyBars.filter((bar) => bar.direction !== 'flat').length < 3,
    [weeklyBars],
  );
  const cashflowMixContext = useMemo(
    () => getCashflowMixContext(detailSummary.recentIncome, detailSummary.recentExpense),
    [detailSummary.recentExpense, detailSummary.recentIncome],
  );

  const handleArchive = async () => {
    if (!account) return;

    setArchiveSaving(true);
    setStatus(null);

    try {
      await setAccountArchived(account.id, !account.isArchived);

      router.push('/accounts');
    } catch (archiveError) {
      setStatus(
        archiveError instanceof Error
          ? archiveError.message
          : 'Failed to update account archive state.',
      );
    } finally {
      setArchiveSaving(false);
      setShowArchiveConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <div className="h-[300px] rounded-[34px] bg-[linear-gradient(140deg,rgba(33,98,85,0.85)_0%,rgba(33,132,119,0.9)_100%)]" />
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="h-48 rounded-[30px] bg-white/80" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="h-32 rounded-[30px] bg-white/80" />
            <div className="h-32 rounded-[30px] bg-white/80" />
          </div>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <div className="rounded-[28px] border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-white">Account not found</h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            This account may have been removed or you may not have access to it.
          </p>
          <Link
            href="/accounts"
            className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
          >
            Back to accounts
          </Link>
        </div>
      </div>
    );
  }

  const palette = getAccountPalette(account);
  const accountIcon = createElement(getAccountIconComponent(account), { size: 34 });
  const incomeShare =
    detailSummary.recentIncome + detailSummary.recentExpense > 0
      ? Math.round((detailSummary.recentIncome / (detailSummary.recentIncome + detailSummary.recentExpense)) * 100)
      : 50;

  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-3 pb-8 pt-4 sm:px-5 sm:pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <Link
            href="/accounts"
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#ddd5c7] bg-white/[0.82] px-4 text-sm font-semibold text-[#4b5666] transition-colors hover:border-[#cbc1af] hover:text-[#152133] sm:min-h-11"
          >
            <ArrowLeft size={16} />
            Back to accounts
          </Link>

          <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={toggle}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#ddd5c7] bg-white/[0.82] px-3 text-sm font-semibold text-[#4b5666] transition-colors hover:border-[#cbc1af] hover:text-[#152133] sm:min-h-11 sm:px-4"
            >
              {visible ? <Eye size={16} /> : <EyeOff size={16} />}
              <span className="hidden sm:inline">{visible ? 'Hide balance' : 'Show balance'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowArchiveConfirm(true)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50/90 px-3 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100 sm:min-h-11 sm:px-4"
            >
              <Archive size={16} />
              <span className="hidden sm:inline">{account.isArchived ? 'Restore' : 'Archive'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowEditDialog(true)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#ddd5c7] bg-white/[0.82] px-3 text-sm font-semibold text-[#4b5666] transition-colors hover:border-[#cbc1af] hover:text-[#152133] sm:min-h-11 sm:px-4"
            >
              <Pencil size={16} />
              <span className="hidden sm:inline">Edit</span>
            </button>
          </div>
        </div>

        <section className="mt-4 grid gap-3 lg:grid-cols-[1.02fr_0.98fr] sm:gap-4">
          <div
            className="relative overflow-hidden rounded-[28px] border p-4 text-white shadow-[0_30px_60px_-36px_rgba(33,41,51,0.55)] sm:rounded-[34px] sm:p-6"
            style={{
              borderColor: palette.border,
              backgroundImage: palette.cardBackground,
            }}
          >
            <div className="absolute inset-0" style={{ background: palette.cardOverlay }} />
            <div
              className="absolute -right-10 -top-10 h-44 w-44 rounded-full blur-3xl"
              style={{ background: palette.softAccent }}
            />

            <div className="relative flex h-full min-h-[220px] flex-col sm:min-h-[285px]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-white/15 sm:h-[72px] sm:w-[72px] sm:rounded-[24px]"
                    style={{ background: palette.iconBackground }}
                  >
                    {accountIcon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/[0.68]">
                      {getAccountTypeBadge(account.type)}
                    </p>
                    <h1 className="mt-2 truncate font-display text-[1.9rem] leading-none sm:mt-3 sm:text-[2.7rem]">
                      {account.name}
                    </h1>
                    <p className="mt-3 text-sm text-white/[0.76] sm:text-[15px]">
                      {getAccountTypeLabel(account.type)}
                      {account.expensePaymentMethod ? ` \u2022 ${account.expensePaymentMethod}` : ''}
                    </p>
                  </div>
                </div>

                <span className="rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/[0.82] sm:px-3 sm:text-[11px]">
                  {account.isArchived ? 'Archived' : 'Active'}
                </span>
              </div>

              <div className="mt-auto grid gap-3 pt-6 sm:grid-cols-2 sm:gap-4 sm:pt-10">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/[0.64]">
                    Balance
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <p className="min-w-0 max-w-full overflow-hidden text-[clamp(2rem,3vw,3.45rem)] font-semibold leading-none tracking-[-0.05em] tabular-nums whitespace-nowrap">
                      {visible ? formatPeso(account.computedBalance) : HIDDEN_BALANCE}
                    </p>
                  </div>
                </div>

                <div className="rounded-[20px] border border-white/15 bg-white/10 p-3 backdrop-blur-sm sm:rounded-[24px] sm:p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/[0.64]">
                    This month
                  </p>
                  <p className={`mt-3 overflow-hidden text-[1.35rem] font-semibold leading-tight tracking-[-0.04em] tabular-nums whitespace-nowrap sm:text-[1.7rem] sm:leading-none ${monthlyFlow < 0 ? 'text-rose-100' : 'text-white'}`}>
                    {formatSignedPeso(monthlyFlow)}
                  </p>
                  <p className="mt-2 text-sm text-white/[0.72]">
                    {detailSummary.transactionCount} transaction{detailSummary.transactionCount === 1 ? '' : 's'} tracked
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2 sm:gap-4">
            <article className="rounded-[24px] border border-[#ddd5c7] bg-white/[0.82] p-4 shadow-[0_18px_34px_-30px_rgba(31,36,48,0.45)] sm:rounded-[30px] sm:p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9199a6]">
                Cashflow mix
              </p>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                <div
                  className="relative h-24 w-24 shrink-0 rounded-full"
                  style={{
                    background: `conic-gradient(#4f9362 0 ${incomeShare}%, #ef4444 ${incomeShare}% 100%)`,
                  }}
                >
                  <div className="absolute inset-[11px] flex items-center justify-center rounded-full bg-[#fffdf9] text-center">
                    <div>
                      <p className="text-lg font-semibold text-[#183047]">{incomeShare}%</p>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9199a6]">
                        Inflow
                      </p>
                    </div>
                  </div>
                </div>
                <div className="min-w-0 text-left">
                  <p className="overflow-hidden text-sm font-semibold text-[#183047] whitespace-nowrap">
                    In {formatPeso(detailSummary.recentIncome)}
                  </p>
                  <p className="mt-2 overflow-hidden text-sm font-semibold text-rose-500 whitespace-nowrap">
                    Out {formatPeso(detailSummary.recentExpense)}
                  </p>
                  <p className="mt-3 max-w-[18rem] text-xs leading-relaxed text-[#7e8694]">
                    Based on the last 30 days of movement in this account.
                  </p>
                  <p className="mt-2 max-w-[18rem] text-xs font-medium leading-relaxed text-[#526072]">
                    {cashflowMixContext}
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-[24px] border border-[#ddd5c7] bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(245,242,235,0.96)_100%)] p-4 shadow-[0_18px_34px_-30px_rgba(31,36,48,0.45)] sm:rounded-[30px] sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9199a6]">
                    Last 7 days
                  </p>
                  <p className="mt-2 text-sm text-[#6e7785]">A quick read on the rhythm of recent activity.</p>
                </div>
                <span className="rounded-full bg-[#f0ece2] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7a7364]">
                  {getUpdatedLabel(detailSummary.lastActivityDate)}
                </span>
              </div>

              {hasSparseWeeklyActivity ? (
                <div className="mt-5 rounded-[20px] border border-dashed border-[#dfd6c8] bg-[#fffdf9] px-4 py-6 text-center text-sm text-[#6e7785]">
                  No significant activity this week.
                </div>
              ) : (
                <div className="mt-5 flex items-end justify-between gap-2 sm:gap-3">
                  {weeklyBars.map((bar) => {
                    const isActive = activeWeeklyBarKey === bar.key;

                    return (
                      <div key={bar.key} className="flex min-w-0 flex-1 flex-col items-center gap-3">
                        <button
                          type="button"
                          className="relative flex h-[92px] w-full items-end justify-center rounded-[14px] outline-none transition-colors hover:bg-[#f6f1e9] focus-visible:bg-[#f6f1e9]"
                          onMouseEnter={() => setActiveWeeklyBarKey(bar.key)}
                          onMouseLeave={() => setActiveWeeklyBarKey((current) => (current === bar.key ? null : current))}
                          onFocus={() => setActiveWeeklyBarKey(bar.key)}
                          onBlur={() => setActiveWeeklyBarKey((current) => (current === bar.key ? null : current))}
                          onClick={() =>
                            setActiveWeeklyBarKey((current) => (current === bar.key ? null : bar.key))
                          }
                          aria-label={`${bar.label}: ${formatSignedPeso(bar.net)}`}
                        >
                          {isActive ? (
                            <span className="absolute -top-7 rounded-full bg-[#183047] px-2.5 py-1 text-[10px] font-semibold text-white shadow-[0_10px_18px_-12px_rgba(24,48,71,0.75)]">
                              {bar.label} {formatSignedPeso(bar.net)}
                            </span>
                          ) : null}
                          <div
                            className={`w-3 rounded-full ${
                              bar.direction === 'in'
                                ? 'bg-emerald-500'
                                : bar.direction === 'out'
                                  ? 'bg-rose-500'
                                  : 'bg-[#d8d2c7]'
                            }`}
                            style={{ height: `${bar.height}px` }}
                          />
                        </button>
                        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7d8591]">
                          {bar.shortLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="mt-4 text-sm font-medium text-[#526072]">{weeklySummary}</p>
            </article>
          </div>
        </section>

        <section className="mt-4 rounded-[28px] border border-[#ddd5c7] bg-[linear-gradient(180deg,rgba(255,252,247,0.96)_0%,rgba(246,240,231,0.94)_100%)] p-4 shadow-[0_22px_42px_-34px_rgba(31,36,48,0.45)] sm:mt-5 sm:rounded-[32px] sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9199a6]">
                Quick actions
              </p>
              <p className="mt-2 text-sm text-[#6e7785]">Move money, reconcile balance, or keep this account up to date.</p>
            </div>
            <p className="text-sm font-medium text-[#526072]">{getActivityLabel(detailSummary.lastActivityDate)}</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4 sm:mt-5">
            <ActionButton
              label="Deposit"
              accentClass="text-emerald-600"
              icon={<ArrowDown size={24} className="text-emerald-600" />}
              onClick={() => {
                setExpenseModalState({
                  defaultAccountId: accountId,
                  defaultEntryType: 'income',
                });
              }}
            />
            <ActionButton
              label="Withdraw"
              accentClass="text-rose-500"
              icon={<ArrowDown size={24} className="rotate-180 text-rose-500" />}
              onClick={() => setActiveAction('withdraw')}
            />
            <ActionButton
              label="Transfer"
              accentClass="text-sky-600"
              icon={<ArrowRightLeft size={24} className="text-sky-600" />}
              onClick={() => setActiveAction('transfer')}
            />
            <ActionButton
              label="Adjust"
              accentClass="text-[#5d6775]"
              icon={<Wallet size={24} className="text-[#5d6775]" />}
              onClick={() => setActiveAction('adjust')}
            />
          </div>
        </section>

        <section className="mt-4 rounded-[28px] border border-[#ddd5c7] bg-white/[0.88] p-4 shadow-[0_22px_40px_-34px_rgba(31,36,48,0.45)] sm:mt-5 sm:rounded-[32px] sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-[2rem] leading-none text-[#172033]">Transaction history</h2>
              <p className="mt-2 text-sm text-[#6f7786]">
                Expenses, income, savings movements, and transfers tied to this account.
              </p>
            </div>
            <span className="rounded-full border border-[#e1d8ca] bg-[#faf6ee] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#697483]">
              {accountTransactions.length} items
            </span>
          </div>

          <div className="mt-5 space-y-5">
            {groupedTransactions.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[#d9d0c2] bg-[rgba(255,253,248,0.86)] px-5 py-12 text-center text-sm text-[#6f7786]">
                No transactions found for this account yet.
              </div>
            ) : (
              groupedTransactions.map((group) => (
                <section key={group.key} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8d95a2]">
                      {group.label}
                    </p>
                    <span
                      className="text-xs font-medium text-zinc-400"
                    >
                      total: {formatSignedPeso(group.total)}
                    </span>
                  </div>
                  <TransactionList
                    transactions={group.items}
                    mobileFirst
                    groupByDate={false}
                    showDelete={false}
                    showEdit={false}
                  />
                </section>
              ))
            )}
          </div>
        </section>

        {status ? <p className="mt-4 text-sm text-[#5f6a78]">{status}</p> : null}
      </div>

      <AccountFormDialog
        open={showEditDialog}
        mode="edit"
        account={account}
        onClose={() => setShowEditDialog(false)}
        onSaved={fetchPageData}
      />

      <AddExpenseModal
        open={expenseModalState !== null}
        onClose={() => setExpenseModalState(null)}
        onAdded={() => {
          void fetchPageData();
          setExpenseModalState(null);
        }}
        defaultAccountId={expenseModalState?.defaultAccountId}
        defaultLinkedTransferGroupId={expenseModalState?.defaultLinkedTransferGroupId}
        defaultEntryType={expenseModalState?.defaultEntryType}
      />

      <TransferModal
        open={activeAction === 'transfer' || activeAction === 'withdraw'}
        mode={activeAction === 'withdraw' ? 'withdraw' : 'transfer'}
        initialFromAccountId={accountId}
        onClose={() => setActiveAction(null)}
        onCreated={(result) => {
          void fetchPageData();
          if (result?.message) {
            setStatus(result.message);
          }
          setActiveAction(null);
        }}
        onRequestRecordExpense={(payload) => {
          setExpenseModalState({
            defaultAccountId: payload.accountId,
            defaultLinkedTransferGroupId: payload.transferGroupId,
            defaultEntryType: 'expense',
          });
        }}
      />

      <AccountAdjustDialog
        open={activeAction === 'adjust'}
        account={account}
        onClose={() => setActiveAction(null)}
        onAdjusted={fetchPageData}
      />

      {showArchiveConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 px-4 backdrop-blur-sm"
          onClick={() => setShowArchiveConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-[28px] bg-white p-5 shadow-xl dark:bg-zinc-900"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="font-display text-2xl font-bold text-zinc-900 dark:text-white">
              {account.isArchived ? 'Restore account?' : 'Archive account?'}
            </h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {account.isArchived
                ? 'This account will return to the active accounts list.'
                : 'This account will move to archived accounts and can still be restored later.'}
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowArchiveConfirm(false)}
                className="min-h-11 rounded-xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleArchive()}
                disabled={archiveSaving}
                className="min-h-11 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-60"
              >
                {archiveSaving ? 'Saving...' : account.isArchived ? 'Restore' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
