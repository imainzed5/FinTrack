'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MobileMonthNavigationProps {
  selectedMonth: string;
  monthOptions: Array<{ value: string; label: string }>;
  onSelectMonth: (value: string) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  copyAction?: {
    label: string;
    busyLabel: string;
    disabled?: boolean;
    onClick: () => void;
  };
}

export default function MobileMonthNavigation({
  selectedMonth,
  monthOptions,
  onSelectMonth,
  onPreviousMonth,
  onNextMonth,
  copyAction,
}: MobileMonthNavigationProps) {
  return (
    <div className="sm:hidden">
      <div className="flex min-h-12 items-center gap-2">
        <button
          type="button"
          onClick={onPreviousMonth}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#ddd6c8] bg-white text-zinc-700 transition-colors hover:bg-[#f6f1e7]"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>

        <select
          value={selectedMonth}
          onChange={(event) => onSelectMonth(event.target.value)}
          className="h-12 min-w-0 flex-1 rounded-full border border-[#ddd6c8] bg-white px-4 text-sm font-medium text-zinc-800 outline-none transition focus:border-[#1D9E75]"
          aria-label="Select month"
        >
          {monthOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onNextMonth}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#ddd6c8] bg-white text-zinc-700 transition-colors hover:bg-[#f6f1e7]"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {copyAction ? (
        <button
          type="button"
          onClick={copyAction.onClick}
          disabled={copyAction.disabled}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#1D9E75] transition-colors hover:text-[#187f5d] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {copyAction.disabled ? copyAction.busyLabel : copyAction.label}
          <ChevronRight size={14} />
        </button>
      ) : null}
    </div>
  );
}
