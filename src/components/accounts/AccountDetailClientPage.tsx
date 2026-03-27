'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowRightLeft,
  Eye,
  EyeOff,
  Landmark,
  Pencil,
  Smartphone,
  Wallet,
} from 'lucide-react';
import AddExpenseModal from '@/components/AddExpenseModal';
import AccountAdjustDialog from '@/components/accounts/AccountAdjustDialog';
import AccountFormDialog from '@/components/accounts/AccountFormDialog';
import TransactionList from '@/components/TransactionList';
import TransferModal from '@/components/TransferModal';
import { useNetWorthVisibility } from '@/hooks/useNetWorthVisibility';
import type { AccountType, AccountWithBalance, Transaction } from '@/lib/types';

interface AccountDetailClientPageProps {
  accountId: string;
}

type ActiveAction = 'deposit' | 'withdraw' | 'transfer' | 'adjust' | null;

type ExpenseModalState = {
  defaultAccountId?: string;
  defaultLinkedTransferGroupId?: string;
  defaultEntryType: 'expense' | 'income';
} | null;

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

function getAccountTypeLabel(type: AccountType): string {
  if (type === 'Cash') return 'Cash wallet';
  if (type === 'E-Wallet') return 'Digital wallet';
  if (type === 'Bank') return 'Bank account';
  return 'Other account';
}

function getAccountTypeBadge(type: AccountType): string {
  if (type === 'Cash') return 'CASH WALLET';
  if (type === 'E-Wallet') return 'DIGITAL WALLET';
  if (type === 'Bank') return 'BANK ACCOUNT';
  return 'OTHER ACCOUNT';
}

function getAccountIcon(type: AccountType) {
  if (type === 'Cash') return Wallet;
  if (type === 'E-Wallet') return Smartphone;
  if (type === 'Bank') return Landmark;
  return Wallet;
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

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function getDateGroupLabel(dateValue: string): string {
  const date = parseISO(dateValue);
  if (isToday(date)) return 'TODAY';
  if (isYesterday(date)) return 'YESTERDAY';
  return format(date, 'MMM d').toUpperCase();
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
  const { visible, toggle } = useNetWorthVisibility();

  const fetchPageData = useCallback(async () => {
    setLoading(true);

    try {
      const [accountsResponse, transactionsResponse] = await Promise.all([
        fetch('/api/accounts?includeArchived=true', { cache: 'no-store' }),
        fetch('/api/transactions'),
      ]);

      const [accountsJson, transactionsJson] = await Promise.all([
        accountsResponse.json(),
        transactionsResponse.json(),
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

  const account = useMemo(
    () => accounts.find((item) => item.id === accountId) ?? null,
    [accountId, accounts]
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

  const handleArchive = async () => {
    if (!account) return;

    setArchiveSaving(true);
    setStatus(null);

    try {
      const response = await fetch('/api/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: account.id,
          action: account.isArchived ? 'restore' : 'archive',
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to update account archive state.');
      }

      router.push('/accounts');
      router.refresh();
    } catch (archiveError) {
      setStatus(
        archiveError instanceof Error
          ? archiveError.message
          : 'Failed to update account archive state.'
      );
    } finally {
      setArchiveSaving(false);
      setShowArchiveConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <div className="h-72 rounded-[32px] bg-emerald-500/90" />
        <div className="mt-4 h-24 rounded-[28px] bg-white dark:bg-zinc-900" />
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

  const AccountIcon = getAccountIcon(account.type);

  return (
    <>
      <div className="mx-auto w-full max-w-5xl px-4 pb-8 pt-4 sm:px-6">
        <section className="overflow-hidden rounded-[32px] bg-[#1D9E75] text-white">
          <div className="p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
              <Link
                href="/accounts"
                className="inline-flex items-center gap-2 text-sm font-medium text-white/90 transition-colors hover:text-white sm:text-base"
              >
                <ArrowLeft size={16} />
                Back to accounts
              </Link>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditDialog(true)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-white/60 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/10 sm:min-h-10 sm:px-3 sm:text-sm"
                >
                  <Pencil size={13} />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setShowArchiveConfirm(true)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-white/60 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/10 sm:min-h-10 sm:px-3 sm:text-sm"
                >
                  <Archive size={13} />
                  {account.isArchived ? 'Restore' : 'Archive'}
                </button>
              </div>
            </div>

            <div className="mt-5 flex items-start gap-3 sm:mt-7 sm:gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-white/12 sm:h-16 sm:w-16 sm:rounded-[22px]">
                <AccountIcon size={24} className="sm:hidden" />
                <AccountIcon size={30} className="hidden sm:block" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70 sm:text-sm">
                  {getAccountTypeBadge(account.type)}
                </p>
                <h1 className="mt-1.5 truncate font-display text-[2.25rem] font-bold leading-none sm:mt-2 sm:text-4xl">
                  {account.name}
                </h1>
                <p className="mt-1.5 text-sm text-white/75 sm:mt-2">{getAccountTypeLabel(account.type)}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-6 sm:gap-3">
              <div className="rounded-2xl bg-white/15 p-3 sm:p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70 sm:text-sm">
                  Balance
                </p>
                <div className="mt-2 flex items-center justify-between gap-2 sm:mt-3">
                  <p className="inline-flex min-w-0 text-[1.45rem] font-semibold leading-none tabular-nums sm:min-w-[10ch] sm:text-4xl">
                    {visible ? formatPeso(account.computedBalance) : HIDDEN_BALANCE}
                  </p>
                  <button
                    type="button"
                    onClick={toggle}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10"
                    aria-label={visible ? 'Hide account balance' : 'Show account balance'}
                  >
                    {visible ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl bg-white/15 p-3 sm:p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70 sm:text-sm">
                  This Month
                </p>
                <p
                  className={`mt-2 text-[1.45rem] font-semibold leading-none tabular-nums sm:mt-3 sm:text-4xl ${
                    monthlyFlow < 0 ? 'text-red-200' : 'text-white'
                  }`}
                >
                  {formatSignedPeso(monthlyFlow)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 border-t border-zinc-200 bg-white px-4 py-4 text-center text-sm sm:gap-3 sm:px-6 sm:py-5 dark:border-zinc-800 dark:bg-zinc-950">
            <button
              type="button"
              onClick={() => {
                setExpenseModalState({
                  defaultAccountId: accountId,
                  defaultEntryType: 'income',
                });
              }}
              className="flex flex-col items-center gap-2 sm:gap-3"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 sm:h-16 sm:w-16 sm:rounded-3xl">
                <ArrowDown size={22} className="sm:hidden" />
                <ArrowDown size={28} className="hidden sm:block" />
              </span>
              <span className="text-[13px] font-medium text-emerald-600 sm:text-sm">Deposit</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveAction('withdraw')}
              className="flex flex-col items-center gap-2 sm:gap-3"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500 sm:h-16 sm:w-16 sm:rounded-3xl">
                <ArrowDown size={22} className="rotate-180 sm:hidden" />
                <ArrowDown size={28} className="hidden rotate-180 sm:block" />
              </span>
              <span className="text-[13px] font-medium text-red-500 sm:text-sm">Withdraw</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveAction('transfer')}
              className="flex flex-col items-center gap-2 sm:gap-3"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-500 sm:h-16 sm:w-16 sm:rounded-3xl">
                <ArrowRightLeft size={22} className="sm:hidden" />
                <ArrowRightLeft size={28} className="hidden sm:block" />
              </span>
              <span className="text-[13px] font-medium text-blue-500 sm:text-sm">Transfer</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveAction('adjust')}
              className="flex flex-col items-center gap-2 sm:gap-3"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 sm:h-16 sm:w-16 sm:rounded-3xl">
                <Wallet size={22} className="sm:hidden" />
                <Wallet size={28} className="hidden sm:block" />
              </span>
              <span className="text-[13px] font-medium text-zinc-500 sm:text-sm">Adjust</span>
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-[28px] border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div>
            <h2 className="font-display text-2xl font-bold text-zinc-900 dark:text-white">
              Transaction history
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Expenses, income, and transfers for this account.
            </p>
          </div>

          <div className="mt-5 space-y-5">
            {groupedTransactions.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-zinc-300 bg-white px-5 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                No transactions found for this account yet.
              </div>
            ) : (
              groupedTransactions.map((group) => (
                <section key={group.key} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                      {group.label}
                    </p>
                    <span
                      className={`text-sm font-semibold ${
                        group.total < 0
                          ? 'text-red-500'
                          : group.total > 0
                            ? 'text-emerald-600'
                            : 'text-zinc-500 dark:text-zinc-400'
                      }`}
                    >
                      {formatSignedPeso(group.total)}
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

        {status && (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
            {status}
          </p>
        )}
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
