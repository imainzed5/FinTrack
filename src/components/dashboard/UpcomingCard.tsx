'use client';

import Link from 'next/link';
import { addDays, format, isSameDay, parseISO } from 'date-fns';
import { ArrowDownLeft, ArrowUpRight, CalendarDays } from 'lucide-react';
import type { Transaction } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

interface UpcomingCardProps {
  transactions: Transaction[];
}

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

function resolveDueDate(transaction: Transaction): Date {
  if (transaction.recurring?.nextRunDate) {
    return safeParseDate(transaction.recurring.nextRunDate);
  }

  return safeParseDate(transaction.date);
}

export default function UpcomingCard({ transactions }: UpcomingCardProps) {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfWindow = addDays(startOfToday, 14);

  const recurringRows = transactions
    .filter((transaction) => Boolean(transaction.recurring))
    .map((transaction) => ({
      transaction,
      dueDate: resolveDueDate(transaction),
    }));

  const upcoming = recurringRows
    .filter(({ dueDate }) => dueDate >= startOfToday && dueDate <= endOfWindow)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .slice(0, 3);

  return (
    <section className="rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-medium text-zinc-800">Upcoming</h2>
        <Link
          href="/transactions?filter=recurring"
          className="text-xs font-medium text-[#1D9E75] hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="mt-3 space-y-2.5">
        {upcoming.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E1F5EE]">
              <CalendarDays size={16} className="text-[#1D9E75]" />
            </div>
            <p className="text-sm text-zinc-500">No upcoming transactions</p>
            <p className="text-xs text-zinc-500">in the next 14 days</p>
          </div>
        ) : (
          upcoming.map(({ transaction, dueDate }) => {
            const isIncome = transaction.type === 'income';
            const title =
              transaction.merchant ||
              transaction.description ||
              transaction.notes ||
              transaction.category;
            const isDueToday = isSameDay(dueDate, today);

            return (
              <article key={transaction.id} className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <div
                    className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: isIncome ? '#E1F5EE' : '#FDEDE7',
                      color: isIncome ? '#1D9E75' : '#D85A30',
                    }}
                  >
                    {isIncome ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-800">{title}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {format(dueDate, 'MMM d')} • {transaction.category}
                    </p>
                    {isDueToday ? (
                      <span className="mt-1 inline-flex rounded-full bg-[#FDEDE7] px-2 py-0.5 text-[10px] font-medium text-[#D85A30]">
                        Due today
                      </span>
                    ) : null}
                  </div>
                </div>

                <p
                  className="shrink-0 text-sm font-medium"
                  style={{ color: isIncome ? '#1D9E75' : '#D85A30' }}
                >
                  {isIncome ? '+' : ''}
                  {formatCurrency(transaction.amount)}
                </p>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
