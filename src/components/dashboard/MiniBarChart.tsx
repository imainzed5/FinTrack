'use client';

import Link from 'next/link';
import type { DashboardData } from '@/lib/types';
import { getTodayDateKeyInManila, getTodayWeekdayShortInManila } from '@/lib/utils';

type DailyBarPoint = DashboardData['dailySpending'][number] & { date?: string };

interface MiniBarChartProps {
  dailySpending: DailyBarPoint[];
}

export default function MiniBarChart({ dailySpending }: MiniBarChartProps) {
  const todayLabel = getTodayWeekdayShortInManila();
  const todayDateKey = getTodayDateKeyInManila();
  const maxMobileBarHeight = 60;
  const maxDesktopBarHeight = 52;

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

  return (
    <section className="rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-medium text-zinc-800">Last 7 days</h2>
        <Link href="/transactions" className="text-xs font-medium text-[#1D9E75] hover:underline">
          See all
        </Link>
      </div>

      <div className="mt-4">
        <div className="flex h-[60px] items-end gap-1.5 md:h-[52px]">
          {entries.map((entry, index) => {
            const heightPercent = (entry.amount / maxAmount) * 100;
            const mobileHeightPx = Math.round((heightPercent / 100) * maxMobileBarHeight);
            const desktopHeightPx = Math.round((heightPercent / 100) * maxDesktopBarHeight);
            const resolvedMobileHeight = entry.amount > 0 ? Math.max(6, mobileHeightPx) : 0;
            const resolvedDesktopHeight = entry.amount > 0 ? Math.max(6, desktopHeightPx) : 0;
            const isToday = entry.dateKey
              ? entry.dateKey === todayDateKey
              : entry.day === todayLabel;
            const barColor = isToday ? '#1D9E75' : '#9FE1CB';

            return (
              <div
                key={`${entry.day}-${entry.dateKey || index}-${entry.amount}`}
                className="flex flex-1 items-end"
              >
                <div
                  className="block w-full rounded-md md:hidden"
                  style={{ height: `${resolvedMobileHeight}px`, backgroundColor: barColor }}
                />
                <div
                  className="hidden w-full rounded-md md:block"
                  style={{ height: `${resolvedDesktopHeight}px`, backgroundColor: barColor }}
                />
              </div>
            );
          })}
        </div>

        <div className="mt-2 flex gap-1.5">
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
