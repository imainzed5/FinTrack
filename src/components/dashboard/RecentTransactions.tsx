'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { useMemo } from 'react';
import type { Transaction } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

interface RecentTransactionsProps {
  transactions: Transaction[];
  limit?: number;
}

type CategoryPalette = {
  iconBg: string;
  iconText: string;
  pillBg: string;
  pillText: string;
  label: string;
};

const CATEGORY_PALETTES: Record<string, CategoryPalette> = {
  Transportation: {
    iconBg: '#E6F1FB',
    iconText: '#185FA5',
    pillBg: '#E6F1FB',
    pillText: '#185FA5',
    label: 'Transportation',
  },
  Food: {
    iconBg: '#FAEEDA',
    iconText: '#854F0B',
    pillBg: '#FAEEDA',
    pillText: '#854F0B',
    label: 'Food',
  },
  Subscription: {
    iconBg: '#EEEDFE',
    iconText: '#3C3489',
    pillBg: '#EEEDFE',
    pillText: '#3C3489',
    label: 'Subscription',
  },
  Others: {
    iconBg: '#F1EFE8',
    iconText: '#5F5E5A',
    pillBg: '#F1EFE8',
    pillText: '#5F5E5A',
    label: 'Others',
  },
};

function safeParseDate(value: string): Date {
  const parsed = parseISO(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const fallback = new Date(value);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback;
  }

  return new Date();
}

function getPalette(transaction: Transaction): CategoryPalette {
  if (transaction.type === 'income') {
    return {
      iconBg: '#E1F5EE',
      iconText: '#1D9E75',
      pillBg: '#E1F5EE',
      pillText: '#1D9E75',
      label: transaction.incomeCategory || 'Income',
    };
  }

  if (transaction.type === 'savings') {
    return {
      iconBg: '#E1F5EE',
      iconText: '#1D9E75',
      pillBg: '#E1F5EE',
      pillText: '#1D9E75',
      label: transaction.savingsMeta?.goalName ?? 'Savings',
    };
  }

  if (transaction.category === 'Transportation') {
    return CATEGORY_PALETTES.Transportation;
  }

  if (transaction.category === 'Food') {
    return CATEGORY_PALETTES.Food;
  }

  if (transaction.category === 'Subscriptions') {
    return CATEGORY_PALETTES.Subscription;
  }

  return {
    ...CATEGORY_PALETTES.Others,
    label: transaction.category,
  };
}

function getTransactionTitle(transaction: Transaction): string {
  return (
    transaction.merchant ||
    transaction.description ||
    transaction.notes ||
    transaction.category
  );
}

export default function RecentTransactions({
  transactions,
  limit,
}: RecentTransactionsProps) {
  const fallbackDesktopLimit = 5;
  const fallbackMobileLimit = 3;
  const activeLimit = limit ?? fallbackDesktopLimit;

  const rows = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => safeParseDate(b.date).getTime() - safeParseDate(a.date).getTime())
        .slice(0, activeLimit),
    [transactions, activeLimit]
  );

  return (
    <section className="rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-medium text-zinc-800">Recent transactions</h2>
        <Link href="/transactions" className="text-xs font-medium text-[#1D9E75] hover:underline">
          See all
        </Link>
      </div>

      <div className="mt-3 space-y-2.5">
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-500">No transactions recorded yet.</p>
        ) : (
          rows.map((transaction, index) => {
            const palette = getPalette(transaction);
            const title = getTransactionTitle(transaction);
            const date = format(safeParseDate(transaction.date), 'MMM d');
            const amountLabel =
              transaction.type === 'income'
                ? `+${formatCurrency(transaction.amount)}`
                : transaction.type === 'savings'
                ? transaction.savingsMeta?.depositType === 'deposit'
                  ? `+${formatCurrency(transaction.amount)}`
                  : `-${formatCurrency(transaction.amount)}`
                : formatCurrency(transaction.amount);
            const amountColor =
              transaction.type === 'income'
                ? '#1D9E75'
                : transaction.type === 'savings'
                ? transaction.savingsMeta?.depositType === 'deposit'
                  ? '#1D9E75'
                  : '#D85A30'
                : '#D85A30';
            const rowVisibilityClass =
              typeof limit === 'number' || index < fallbackMobileLimit ? 'flex' : 'hidden md:flex';

            return (
              <article
                key={transaction.id}
                className={`${rowVisibilityClass} items-start justify-between gap-3`}
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <div
                    className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: palette.iconBg,
                      color: palette.iconText,
                    }}
                  >
                    {palette.label.slice(0, 1).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-800">{title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                      <span
                        className="inline-flex rounded-full px-2 py-0.5"
                        style={{
                          backgroundColor: palette.pillBg,
                          color: palette.pillText,
                        }}
                      >
                        {palette.label}
                      </span>
                      <span>{date}</span>
                      <span>{transaction.paymentMethod}</span>
                    </div>
                  </div>
                </div>

                <p
                  className="shrink-0 text-sm font-medium"
                  style={{ color: amountColor }}
                >
                  {amountLabel}
                </p>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
