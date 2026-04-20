'use client';

import { Lock } from 'lucide-react';

interface LockedInsightCardProps {
  title: string;
  description: string;
  currentCount: number;
  requiredCount: number;
  tier: number;
  isFullWidth?: boolean;
}

export default function LockedInsightCard({
  title,
  description,
  currentCount,
  requiredCount,
  tier,
  isFullWidth,
}: LockedInsightCardProps) {
  const safeCurrent = Math.max(0, currentCount);
  const safeRequired = Math.max(1, requiredCount);
  const remaining = Math.max(0, safeRequired - safeCurrent);
  const progress = Math.max(0, Math.min(100, (safeCurrent / safeRequired) * 100));

  return (
    <div className={`rounded-xl border-0 p-3.5 bg-zinc-50 dark:bg-zinc-900/50 flex flex-col gap-2 ${isFullWidth ? 'col-span-2 lg:col-span-3 xl:col-span-4' : ''}`}>
      <div className="flex items-center gap-2">
        <Lock size={12} className="text-zinc-400 dark:text-zinc-500" />
        <p className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400">{title}</p>
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 ml-auto">
          T{tier} · {remaining} more
        </span>
      </div>

      <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
        {description || `Log ${remaining} more transactions to unlock ${title}`}
      </p>

      <div className="h-[3px] rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${progress}%`, backgroundColor: '#1D9E75' }}
        />
      </div>
    </div>
  );
}
