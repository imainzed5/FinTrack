'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  parseISO,
  startOfMonth,
} from 'date-fns';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Landmark,
  Maximize2,
  Minimize2,
  ReceiptText,
  Repeat,
  SplitSquareHorizontal,
  Tag,
  Wallet,
  X,
} from 'lucide-react';
import type { DashboardData, Transaction } from '@/lib/types';
import { formatCurrency, getTodayDateKeyInManila } from '@/lib/utils';

interface CalendarPanelProps {
  isOpen: boolean;
  onClose: () => void;
  calendarSpending: DashboardData['calendarSpending'];
  currentMonthTransactions: Transaction[];
}

type CategoryTone = {
  icon: string;
  label: string;
};

const HEATMAP_COLORS = ['#F5F5F0', '#D4F1E9', '#9FE1CB', '#5DCAA5', '#1D9E75'] as const;

const HEATMAP_TEXT_COLORS = ['#6b7280', '#14532d', '#14532d', '#ffffff', '#ffffff'] as const;

const CATEGORY_TONES: Record<string, CategoryTone> = {
  Food: {
    icon: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
    label: 'text-orange-700 dark:text-orange-300',
  },
  Transportation: {
    icon: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
    label: 'text-blue-700 dark:text-blue-300',
  },
  Subscriptions: {
    icon: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
    label: 'text-purple-700 dark:text-purple-300',
  },
  Utilities: {
    icon: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
    label: 'text-cyan-700 dark:text-cyan-300',
  },
  Shopping: {
    icon: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300',
    label: 'text-pink-700 dark:text-pink-300',
  },
  Entertainment: {
    icon: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300',
    label: 'text-yellow-700 dark:text-yellow-300',
  },
  Health: {
    icon: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
    label: 'text-green-700 dark:text-green-300',
  },
  Education: {
    icon: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
    label: 'text-indigo-700 dark:text-indigo-300',
  },
  Miscellaneous: {
    icon: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-300',
    label: 'text-zinc-600 dark:text-zinc-300',
  },
};

const CATEGORY_ICON_MAP: Record<string, typeof Wallet> = {
  Food: ReceiptText,
  Transportation: Landmark,
  Subscriptions: Repeat,
  Utilities: CreditCard,
  Shopping: Tag,
  Entertainment: Wallet,
  Health: Wallet,
  Education: SplitSquareHorizontal,
  Miscellaneous: Wallet,
};

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toDateKey(value: string): string {
  return value.split('T')[0];
}

function parseDateSafely(value: string): Date | null {
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getCategoryTone(category: Transaction['category']): CategoryTone {
  return CATEGORY_TONES[category] || CATEGORY_TONES.Miscellaneous;
}

function getCategoryIcon(transaction: Transaction): typeof Wallet {
  if (transaction.type === 'income') {
    return Wallet;
  }

  return CATEGORY_ICON_MAP[transaction.category] || Wallet;
}

function getHeatLevel(amount: number, maxAmount: number): 0 | 1 | 2 | 3 | 4 {
  if (amount <= 0 || maxAmount <= 0) {
    return 0;
  }

  const ratio = amount / maxAmount;
  if (ratio < 0.25) {
    return 1;
  }
  if (ratio < 0.5) {
    return 2;
  }
  if (ratio < 0.75) {
    return 3;
  }
  return 4;
}

function CalendarPanelContent({
  onClose,
  viewedMonth,
  onPrevMonth,
  onNextMonth,
  canGoPrev,
  canGoNext,
  totalSpent,
  spendDays,
  noSpendDays,
  bestNoSpendStreak,
  currentNoSpendStreak,
  monthDays,
  monthOffset,
  selectedDay,
  onSelectDay,
  getAmountForDate,
  maxAmountInMonth,
  todayKey,
  selectedDayTransactions,
  selectedDayTotal,
  selectedDayLabel,
  onTransactionTap,
  isExpanded,
  onToggleExpand,
}: {
  onClose: () => void;
  viewedMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
  totalSpent: number;
  spendDays: number;
  noSpendDays: number;
  bestNoSpendStreak: number;
  currentNoSpendStreak: number;
  monthDays: Date[];
  monthOffset: number;
  selectedDay: string | null;
  onSelectDay: (dateKey: string) => void;
  getAmountForDate: (dateKey: string) => number;
  maxAmountInMonth: number;
  todayKey: string;
  selectedDayTransactions: Transaction[];
  selectedDayTotal: number;
  selectedDayLabel: string;
  onTransactionTap: () => void;
  isExpanded: boolean;
  onToggleExpand?: () => void;
}) {
  const showStreakCallout = currentNoSpendStreak > 0 || bestNoSpendStreak > 1;
  const streakMessage =
    currentNoSpendStreak > 0
      ? `🔥 ${currentNoSpendStreak}-day no-spend streak!${
          currentNoSpendStreak === bestNoSpendStreak ? ' Personal best! 🎉' : ''
        }`
      : `Best this month: ${bestNoSpendStreak}-day streak`;

  const dayDetailContent = selectedDay === null ? (
    <p className="py-4 text-center text-xs text-zinc-500">Select a day to see transactions</p>
  ) : (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-zinc-800">{selectedDayLabel}</p>
        <p className="text-sm font-semibold text-[#1D9E75]">{formatCurrency(selectedDayTotal)}</p>
      </div>

      {selectedDayTransactions.length === 0 ? (
        <p className="rounded-xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-[#f8f7f2] px-3 py-3 text-center text-xs text-zinc-500">
          No spend this day
        </p>
      ) : (
        <div className="space-y-2">
          {selectedDayTransactions.map((transaction) => {
            const categoryTone = getCategoryTone(transaction.category);
            const CategoryIcon = getCategoryIcon(transaction);
            const title =
              transaction.merchant ||
              transaction.description ||
              transaction.notes ||
              transaction.category;
            const categoryLabel = transaction.subCategory
              ? `${transaction.category} · ${transaction.subCategory}`
              : transaction.category;

            return (
              <button
                key={transaction.id}
                type="button"
                onClick={onTransactionTap}
                className="flex w-full items-center gap-3 rounded-xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white px-3 py-2.5 text-left transition-colors hover:bg-zinc-50"
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${categoryTone.icon}`}
                >
                  <CategoryIcon size={14} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-zinc-800">{title}</p>
                  <p className={`mt-0.5 truncate text-[11px] ${categoryTone.label}`}>
                    {categoryLabel}
                  </p>
                </div>

                <p className="shrink-0 text-xs font-semibold text-zinc-800">
                  {formatCurrency(transaction.amount)}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {showStreakCallout ? (
        <div
          className="rounded-[var(--border-radius-md)] bg-gradient-to-r from-yellow-50 to-orange-50 px-3 py-2.5"
          style={{ border: '0.5px solid #FAC775' }}
        >
          <p className="text-xs font-medium text-[#A24726]">{streakMessage}</p>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-4 pb-4">
      <header className="rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[14px] font-medium text-zinc-900">Calendar</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Daily spending - {format(viewedMonth, 'MMMM yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onToggleExpand ? (
              <button
                type="button"
                onClick={onToggleExpand}
                aria-label={isExpanded ? 'Collapse panel' : 'Expand panel'}
                className="hidden h-8 w-8 items-center justify-center rounded-full border border-[color:var(--color-border-tertiary,#d9d7cf)] text-zinc-600 transition-colors hover:bg-zinc-100 md:inline-flex"
              >
                {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close calendar"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--color-border-tertiary,#d9d7cf)] text-zinc-600 transition-colors hover:bg-zinc-100"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      </header>

      {isExpanded ? (
        <div style={{ minWidth: 0 }} className="flex flex-col">
          <div className="flex gap-0 border-b border-[color:var(--color-border-tertiary,#d9d7cf)]">
            <div className="w-[280px] flex-shrink-0 p-4 border-r border-[color:var(--color-border-tertiary,#d9d7cf)]">
              <section className="grid grid-cols-2 gap-2">
                <article className="rounded-xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-zinc-500">
                    Total spent
                  </p>
                  <p className="mt-1 text-lg font-medium text-zinc-900">{formatCurrency(totalSpent)}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">elapsed days</p>
                </article>

                <article className="rounded-xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-zinc-500">
                    Spend days
                  </p>
                  <p className="mt-1 text-lg font-medium text-zinc-900">{spendDays}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">with activity</p>
                </article>

                <article className="rounded-xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-zinc-500">
                    No-spend days
                  </p>
                  <p className="mt-1 text-lg font-medium text-[#1D9E75]">{noSpendDays}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">elapsed only</p>
                </article>

                <article className="rounded-xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-zinc-500">
                    Best streak
                  </p>
                  <p className="mt-1 text-lg font-medium text-zinc-900">{bestNoSpendStreak}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">no-spend run</p>
                </article>
              </section>
            </div>

            <div className="flex-1 min-w-0 p-4">{dayDetailContent}</div>
          </div>

          <div className="p-4">
            <div className="mb-4">
              <section className="rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white px-3 py-2.5">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={onPrevMonth}
                  disabled={!canGoPrev}
                  aria-label="Previous month"
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                    canGoPrev
                      ? 'border-[color:var(--color-border-tertiary,#d9d7cf)] text-zinc-700 hover:bg-zinc-100'
                      : 'cursor-not-allowed border-[color:var(--color-border-tertiary,#d9d7cf)] text-zinc-400 opacity-50'
                  }`}
                >
                  <ChevronLeft size={14} />
                </button>

                <p className="text-sm font-medium text-zinc-800">{format(viewedMonth, 'MMMM yyyy')}</p>

                <button
                  type="button"
                  onClick={onNextMonth}
                  disabled={!canGoNext}
                  aria-label="Next month"
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                    canGoNext
                      ? 'border-[color:var(--color-border-tertiary,#d9d7cf)] text-zinc-700 hover:bg-zinc-100'
                      : 'cursor-not-allowed border-[color:var(--color-border-tertiary,#d9d7cf)] text-zinc-400 opacity-50'
                  }`}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
              </section>
            </div>

            <section className="rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-3.5">
              <div className="grid grid-cols-7 gap-1.5">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((weekday) => (
                  <p
                    key={weekday}
                    className="text-center text-[10px] font-medium uppercase tracking-[0.04em] text-zinc-500"
                  >
                    {weekday}
                  </p>
                ))}

                {Array.from({ length: monthOffset }).map((_, index) => (
                  <div key={`offset-${index}`} className="aspect-square" aria-hidden="true" />
                ))}

                {monthDays.map((day) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const amount = getAmountForDate(dateKey);
                  const level = getHeatLevel(amount, maxAmountInMonth);
                  const isTodayCell = dateKey === todayKey;
                  const isSelected = selectedDay === dateKey;

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => onSelectDay(dateKey)}
                      className="flex aspect-square w-full cursor-pointer flex-col items-center justify-center rounded-[6px] border transition-shadow"
                      style={{
                        backgroundColor: HEATMAP_COLORS[level],
                        color: HEATMAP_TEXT_COLORS[level],
                        borderColor: isSelected || isTodayCell ? '#1D9E75' : 'transparent',
                        borderWidth: '1.5px',
                        boxShadow: isSelected ? '0 0 0 2px #1D9E7530' : 'none',
                      }}
                      aria-label={`${format(day, 'MMM d')}: ${formatCurrency(amount)}`}
                    >
                      <span className="text-[10px] font-medium leading-none">{format(day, 'd')}</span>
                      {amount > 0 ? (
                        <span
                          className="mt-1 h-[3px] w-[3px] rounded-full"
                          style={{ backgroundColor: level === 4 ? '#ffffff' : '#1D9E75' }}
                        />
                      ) : (
                        <span className="mt-1 h-[3px] w-[3px]" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-zinc-500">Less</span>
                  {HEATMAP_COLORS.map((color) => (
                    <span
                      key={color}
                      className="inline-flex h-[14px] w-[14px] rounded-[3px] border border-black/5"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                  ))}
                  <span className="text-[10px] text-zinc-500">More</span>
                </div>

                <p className="text-[10px] text-zinc-500">tap a day</p>
              </div>
            </section>
          </div>
        </div>
      ) : (
        <div className="w-full space-y-4" style={{ minWidth: 0 }}>
          <section className="rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white px-3 py-2.5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={onPrevMonth}
                disabled={!canGoPrev}
                aria-label="Previous month"
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                  canGoPrev
                    ? 'border-[color:var(--color-border-tertiary,#d9d7cf)] text-zinc-700 hover:bg-zinc-100'
                    : 'cursor-not-allowed border-[color:var(--color-border-tertiary,#d9d7cf)] text-zinc-400 opacity-50'
                }`}
              >
                <ChevronLeft size={14} />
              </button>

              <p className="text-sm font-medium text-zinc-800">{format(viewedMonth, 'MMMM yyyy')}</p>

              <button
                type="button"
                onClick={onNextMonth}
                disabled={!canGoNext}
                aria-label="Next month"
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                  canGoNext
                    ? 'border-[color:var(--color-border-tertiary,#d9d7cf)] text-zinc-700 hover:bg-zinc-100'
                    : 'cursor-not-allowed border-[color:var(--color-border-tertiary,#d9d7cf)] text-zinc-400 opacity-50'
                }`}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </section>

          <section className={`grid gap-2 ${isExpanded ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <article className="rounded-xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-zinc-500">Total spent</p>
              <p className="mt-1 text-lg font-medium text-zinc-900">{formatCurrency(totalSpent)}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">elapsed days</p>
            </article>

            <article className="rounded-xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-zinc-500">Spend days</p>
              <p className="mt-1 text-lg font-medium text-zinc-900">{spendDays}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">with activity</p>
            </article>

            <article className="rounded-xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-zinc-500">No-spend days</p>
              <p className="mt-1 text-lg font-medium text-[#1D9E75]">{noSpendDays}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">elapsed only</p>
            </article>

            <article className="rounded-xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-zinc-500">Best streak</p>
              <p className="mt-1 text-lg font-medium text-zinc-900">{bestNoSpendStreak}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">no-spend run</p>
            </article>
          </section>

          <section className="rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-3.5">
            <div className="grid grid-cols-7 gap-1.5">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((weekday) => (
                <p
                  key={weekday}
                  className="text-center text-[10px] font-medium uppercase tracking-[0.04em] text-zinc-500"
                >
                  {weekday}
                </p>
              ))}

              {Array.from({ length: monthOffset }).map((_, index) => (
                <div key={`offset-${index}`} className="aspect-square" aria-hidden="true" />
              ))}

              {monthDays.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const amount = getAmountForDate(dateKey);
                const level = getHeatLevel(amount, maxAmountInMonth);
                const isTodayCell = dateKey === todayKey;
                const isSelected = selectedDay === dateKey;

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => onSelectDay(dateKey)}
                    className="flex aspect-square w-full cursor-pointer flex-col items-center justify-center rounded-[6px] border transition-shadow"
                    style={{
                      backgroundColor: HEATMAP_COLORS[level],
                      color: HEATMAP_TEXT_COLORS[level],
                      borderColor: isSelected || isTodayCell ? '#1D9E75' : 'transparent',
                      borderWidth: '1.5px',
                      boxShadow: isSelected ? '0 0 0 2px #1D9E7530' : 'none',
                    }}
                    aria-label={`${format(day, 'MMM d')}: ${formatCurrency(amount)}`}
                  >
                    <span className="text-[10px] font-medium leading-none">{format(day, 'd')}</span>
                    {amount > 0 ? (
                      <span
                        className="mt-1 h-[3px] w-[3px] rounded-full"
                        style={{ backgroundColor: level === 4 ? '#ffffff' : '#1D9E75' }}
                      />
                    ) : (
                      <span className="mt-1 h-[3px] w-[3px]" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-500">Less</span>
                {HEATMAP_COLORS.map((color) => (
                  <span
                    key={color}
                    className="inline-flex h-[14px] w-[14px] rounded-[3px] border border-black/5"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                ))}
                <span className="text-[10px] text-zinc-500">More</span>
              </div>

              <p className="text-[10px] text-zinc-500">tap a day</p>
            </div>

            {!isExpanded ? (
              <>
                <div className="mt-3 border-t-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)]" />
                <div className="pt-3">{dayDetailContent}</div>
              </>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}

export default function CalendarPanel({
  isOpen,
  onClose,
  calendarSpending,
  currentMonthTransactions,
}: CalendarPanelProps) {
  const router = useRouter();
  const panelRef = useRef<HTMLElement>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      return window.localStorage.getItem('moneda-calendar-expanded') === 'true';
    } catch {
      return false;
    }
  });
  const [viewedMonth, setViewedMonth] = useState<Date>(() => startOfMonth(new Date()));

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (window.innerWidth < 768) {
        return;
      }

      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const now = new Date();
  const todayKey = getTodayDateKeyInManila();
  const selectedMonth = format(viewedMonth, 'yyyy-MM');
  const currentMonthKey = format(now, 'yyyy-MM');

  const maxMonth = startOfMonth(now);
  const minMonth = startOfMonth(addMonths(maxMonth, -12));
  const viewedMonthStart = startOfMonth(viewedMonth);

  const canGoPrev = viewedMonthStart.getTime() > minMonth.getTime();
  const canGoNext = viewedMonthStart.getTime() < maxMonth.getTime();

  const monthStart = startOfMonth(viewedMonth);
  const monthEnd = endOfMonth(viewedMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const monthOffset = getDay(monthStart);
  const elapsedDaysCount = selectedMonth === currentMonthKey ? now.getDate() : monthDays.length;

  const spendingByDate = useMemo(() => {
    const byDate = new Map<string, number>();

    for (const point of calendarSpending) {
      const dateKey = toDateKey(point.date);
      byDate.set(dateKey, toNumber(point.amount));
    }

    return byDate;
  }, [calendarSpending]);

  const maxAmountInMonth = useMemo(() => {
    return calendarSpending.reduce((maxAmount, point) => {
      if (!point.date.startsWith(selectedMonth)) {
        return maxAmount;
      }

      return Math.max(maxAmount, toNumber(point.amount));
    }, 0);
  }, [calendarSpending, selectedMonth]);

  const elapsedData = useMemo(() => {
    return calendarSpending.filter((point) => {
      if (!point.date.startsWith(selectedMonth)) {
        return false;
      }

      const dayNum = Number.parseInt(point.date.split('-')[2] || '0', 10);
      return dayNum > 0 && dayNum <= elapsedDaysCount;
    });
  }, [calendarSpending, elapsedDaysCount, selectedMonth]);

  const totalSpent = elapsedData.reduce((sum, point) => sum + toNumber(point.amount), 0);
  const spendDays = elapsedData.filter((point) => toNumber(point.amount) > 0).length;
  const noSpendDays = elapsedData.filter((point) => toNumber(point.amount) === 0).length;

  let bestNoSpendStreak = 0;
  let runningNoSpendStreak = 0;

  for (const point of elapsedData) {
    if (toNumber(point.amount) > 0) {
      runningNoSpendStreak = 0;
      continue;
    }

    runningNoSpendStreak += 1;
    bestNoSpendStreak = Math.max(bestNoSpendStreak, runningNoSpendStreak);
  }

  const currentNoSpendStreak = runningNoSpendStreak;

  const selectedDayTransactions = selectedDay
    ? currentMonthTransactions.filter(
        (transaction) =>
          transaction.type !== 'income' && toDateKey(transaction.date) === selectedDay
      )
    : [];

  const selectedDayTotal = selectedDayTransactions.reduce(
    (sum, transaction) => sum + Math.abs(toNumber(transaction.amount)),
    0
  );

  const selectedDayLabel = selectedDay
    ? (() => {
        const parsed = parseDateSafely(selectedDay);
        return parsed ? format(parsed, 'EEE, MMM d') : selectedDay;
      })()
    : '';

  const toggleExpand = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('moneda-calendar-expanded', String(next));
      } catch {
        // Ignore localStorage issues.
      }
      return next;
    });
  };

  const panelWidth = isExpanded ? 560 : 340;

  const handlePrevMonth = () => {
    if (!canGoPrev) {
      return;
    }

    setViewedMonth((current) => startOfMonth(addMonths(current, -1)));
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    if (!canGoNext) {
      return;
    }

    setViewedMonth((current) => startOfMonth(addMonths(current, 1)));
    setSelectedDay(null);
  };

  const handleSelectDay = (dateKey: string) => {
    setSelectedDay(dateKey);
  };

  const handleTransactionTap = () => {
    if (!selectedDay) {
      return;
    }

    router.push(`/transactions?selectedDay=${selectedDay}`);
    onClose();
  };

  const getAmountForDate = (dateKey: string) => spendingByDate.get(dateKey) || 0;

  return (
    <>
      <section className={`${isOpen ? 'block' : 'hidden'} md:hidden`}>
        <div className="min-h-screen bg-[#f5f5f0] px-4 py-5 sm:px-6">
          <CalendarPanelContent
            onClose={onClose}
            viewedMonth={viewedMonth}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            totalSpent={totalSpent}
            spendDays={spendDays}
            noSpendDays={noSpendDays}
            bestNoSpendStreak={bestNoSpendStreak}
            currentNoSpendStreak={currentNoSpendStreak}
            monthDays={monthDays}
            monthOffset={monthOffset}
            selectedDay={selectedDay}
            onSelectDay={handleSelectDay}
            getAmountForDate={getAmountForDate}
            maxAmountInMonth={maxAmountInMonth}
            todayKey={todayKey}
            selectedDayTransactions={selectedDayTransactions}
            selectedDayTotal={selectedDayTotal}
            selectedDayLabel={selectedDayLabel}
            onTransactionTap={handleTransactionTap}
            isExpanded={false}
          />
        </div>
      </section>

      <aside
        ref={panelRef}
        className="fixed right-0 top-0 z-30 hidden h-screen overflow-hidden bg-[#f8f7f2] md:block"
        style={{
          width: isOpen ? `${panelWidth}px` : '0px',
          opacity: isOpen ? 1 : 0,
          borderLeftWidth: isOpen ? '1px' : '0px',
          borderLeftStyle: 'solid',
          borderLeftColor: 'var(--color-border-tertiary, #d9d7cf)',
          boxShadow: isOpen ? '-10px 0 24px rgba(15, 23, 42, 0.08)' : 'none',
          transition:
            'width 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div
          className={`h-full overflow-y-auto overflow-x-hidden p-4 ${
            isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          }`}
          style={{
            width: `${panelWidth}px`,
            transform: isOpen ? 'translateX(0)' : 'translateX(24px)',
            transition:
              'transform 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <CalendarPanelContent
            onClose={onClose}
            viewedMonth={viewedMonth}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            totalSpent={totalSpent}
            spendDays={spendDays}
            noSpendDays={noSpendDays}
            bestNoSpendStreak={bestNoSpendStreak}
            currentNoSpendStreak={currentNoSpendStreak}
            monthDays={monthDays}
            monthOffset={monthOffset}
            selectedDay={selectedDay}
            onSelectDay={handleSelectDay}
            getAmountForDate={getAmountForDate}
            maxAmountInMonth={maxAmountInMonth}
            todayKey={todayKey}
            selectedDayTransactions={selectedDayTransactions}
            selectedDayTotal={selectedDayTotal}
            selectedDayLabel={selectedDayLabel}
            onTransactionTap={handleTransactionTap}
            isExpanded={isExpanded}
            onToggleExpand={toggleExpand}
          />
        </div>
      </aside>
    </>
  );
}
