'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { CalendarDays, ChevronRight, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface PaydayCountdownCardProps {
  nextPaydayDate: Date | null;
  daysUntilPayday: number | null;
  remainingBudget: number;
}

function getHeadline(daysUntilPayday: number | null): string {
  if (daysUntilPayday === null) {
    return 'Set your payday';
  }

  if (daysUntilPayday < 0) {
    return 'Payday needs an update';
  }

  if (daysUntilPayday === 0) {
    return 'Payday is today';
  }

  if (daysUntilPayday === 1) {
    return '1 day until payday';
  }

  return `${daysUntilPayday} days until payday`;
}

function getSupportCopy(nextPaydayDate: Date | null, daysUntilPayday: number | null): string {
  if (!nextPaydayDate || daysUntilPayday === null) {
    return 'Add a payday date so the dashboard can anchor your month to something real.';
  }

  if (daysUntilPayday < 0) {
    return `Your saved payday (${format(nextPaydayDate, 'MMM d')}) has passed. Update it to keep pacing accurate.`;
  }

  if (daysUntilPayday === 0) {
    return 'Your next planning checkpoint lands today.';
  }

  return `Next payday: ${format(nextPaydayDate, 'EEEE, MMM d')}.`;
}

function getPaceLabel(remainingBudget: number, daysUntilPayday: number | null): string {
  if (daysUntilPayday === null) {
    return 'Add payday to see a daily pace';
  }

  if (daysUntilPayday <= 0) {
    return 'Refresh payday after this cycle';
  }

  if (remainingBudget <= 0) {
    return 'Budget is already fully used';
  }

  return `${formatCurrency(remainingBudget / daysUntilPayday)} / day runway`;
}

export default function PaydayCountdownCard({
  nextPaydayDate,
  daysUntilPayday,
  remainingBudget,
}: PaydayCountdownCardProps) {
  const headline = getHeadline(daysUntilPayday);
  const supportCopy = getSupportCopy(nextPaydayDate, daysUntilPayday);
  const paceLabel = getPaceLabel(remainingBudget, daysUntilPayday);

  return (
    <section className="rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-4 md:px-5 md:py-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#E1F5EE] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0F6E56]">
            <CalendarDays size={12} />
            Payday
          </div>
          <h2 className="mt-2 text-base font-semibold text-zinc-900 md:text-[19px]">{headline}</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">{supportCopy}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row xl:justify-end">
          <div className="rounded-2xl bg-[#F7F5EE] px-4 py-3 sm:min-w-[170px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">
              Remaining budget
            </p>
            <p className="mt-1 text-base font-semibold text-zinc-900">
              {formatCurrency(remainingBudget)}
            </p>
          </div>

          <div className="rounded-2xl bg-[#F7F5EE] px-4 py-3 sm:min-w-[220px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">
              Pacing
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-900">{paceLabel}</p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3 border-t border-[color:var(--color-border-tertiary,#e8dfd0)] pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2 text-sm text-zinc-600">
          <Wallet size={15} className="shrink-0 text-[#1D9E75]" />
          <span className="truncate">
            {nextPaydayDate
              ? daysUntilPayday !== null && daysUntilPayday >= 0
                ? 'Keep spending paced against your next payday.'
                : 'Your payday date needs a quick refresh.'
              : 'Add a payday date to unlock better pacing context.'}
          </span>
        </div>

        <Link
          href="/settings?section=payday"
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[#1D9E75] hover:underline"
        >
          {nextPaydayDate ? 'Manage' : 'Set payday'}
          <ChevronRight size={15} />
        </Link>
      </div>
    </section>
  );
}