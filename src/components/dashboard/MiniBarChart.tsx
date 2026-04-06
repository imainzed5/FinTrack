'use client';

import Link from 'next/link';
import type { DashboardData } from '@/lib/types';
import { getTodayDateKeyInManila, getTodayWeekdayShortInManila } from '@/lib/utils';

type DailyBarPoint = DashboardData['dailySpending'][number] & { date?: string };

interface MiniBarChartProps {
  dailySpending: DailyBarPoint[];
  className?: string;
  tallOnDesktop?: boolean;
}

export default function MiniBarChart({
  dailySpending,
  className,
  tallOnDesktop = false,
}: MiniBarChartProps) {
  const todayLabel = getTodayWeekdayShortInManila();
  const todayDateKey = getTodayDateKeyInManila();
  const sectionClassName = tallOnDesktop
    ? 'min-h-[220px] md:min-h-[280px]'
    : 'min-h-[180px] md:min-h-[220px]';

  const entries = dailySpending.slice(-7).map((entry) => {
    const amountValue = Number(entry.amount);
    const amount = Number.isFinite(amountValue) ? amountValue : 0;
    const dateKey =
      typeof entry.date === 'string' && entry.date.trim().length > 0
        ? entry.date.split('T')[0]
        : undefined;

    return {
      ...entry,
      amount,
      dateKey,
    };
  });

  const maxAmount = Math.max(...entries.map((entry) => entry.amount), 1);
  const sevenDayTotal = entries.reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <section
      className={`flex h-full flex-col rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-4 ${sectionClassName} ${className ?? ''}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-medium text-zinc-800">Last 7 days</h2>
          <p className="mt-1 text-[11px] text-zinc-500">
            {entries.some((entry) => entry.amount > 0)
              ? `${sevenDayTotal.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })} spent across the last 7 days`
              : 'No spending recorded in the last 7 days'}
          </p>
        </div>
        <Link href="/transactions" className="text-xs font-medium text-[#1D9E75] hover:underline">
          See all
        </Link>
      </div>

      <div className="mt-5 flex flex-1 flex-col justify-end">
        <div className="flex h-[104px] flex-1 items-end gap-2 md:h-full md:min-h-[180px]">
          {entries.map((entry, index) => {
            const heightPercent = (entry.amount / maxAmount) * 100;
            const resolvedHeight = entry.amount > 0 ? Math.max(8, heightPercent) : 0;
            const isToday = entry.dateKey
              ? entry.dateKey === todayDateKey
              : entry.day === todayLabel;
            const barColor = isToday ? '#1D9E75' : '#9FE1CB';

            return (
              <div
                key={`${entry.day}-${entry.dateKey || index}-${entry.amount}`}
                className="flex h-full flex-1 items-end"
              >
                <div
                  className="w-full rounded-t-[10px] rounded-b-md"
                  style={{ height: `${resolvedHeight}%`, backgroundColor: barColor }}
                />
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex gap-2">
          {entries.map((entry, index) => {
            const isToday = entry.dateKey
              ? entry.dateKey === todayDateKey
              : entry.day === todayLabel;

            return (
              <p
                key={`label-${entry.day}-${entry.dateKey || index}-${entry.amount}`}
                className={`flex-1 text-center text-[11px] ${
                  isToday ? 'font-medium text-[#1D9E75]' : 'text-zinc-500'
                }`}
              >
                {entry.day}
              </p>
            );
          })}
        </div>
      </div>
    </section>
  );
}
