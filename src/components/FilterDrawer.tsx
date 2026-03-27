'use client';

import { Download, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import type { TouchEvent as ReactTouchEvent } from 'react';

type PaymentMethodFilter = 'All methods' | 'Cash' | 'GCash' | 'Card' | 'Bank Transfer';

type CategoryBreakdownItem = {
  category: string;
  amount: number;
  color: string;
};

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
  includeOperationalInAnalytics: boolean;
  onToggleIncludeOperationalInAnalytics: () => void;
  selectedMonth: string;
  monthOptions: Array<{ value: string; label: string }>;
  onMonthChange: (month: string) => void;
  categories: CategoryBreakdownItem[];
  highestCategoryTotal: number;
  selectedCategories: string[];
  onToggleCategory: (category: string) => void;
  selectedPaymentMethod: PaymentMethodFilter;
  paymentMethodOptions: PaymentMethodFilter[];
  onPaymentMethodChange: (method: PaymentMethodFilter) => void;
  onExportCSV: () => void;
  onExportPDF: () => void;
}

export default function FilterDrawer({
  isOpen,
  onClose,
  onApply,
  includeOperationalInAnalytics,
  onToggleIncludeOperationalInAnalytics,
  selectedMonth,
  monthOptions,
  onMonthChange,
  categories,
  highestCategoryTotal,
  selectedCategories,
  onToggleCategory,
  selectedPaymentMethod,
  paymentMethodOptions,
  onPaymentMethodChange,
  onExportCSV,
  onExportPDF,
}: FilterDrawerProps) {
  const [mounted] = useState(() => typeof window !== 'undefined');
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    let immediateTimer: number | null = null;
    let hideTimer: number | null = null;
    let firstFrame = 0;
    let secondFrame = 0;

    if (isOpen) {
      immediateTimer = window.setTimeout(() => {
        setIsVisible(true);
        firstFrame = window.requestAnimationFrame(() => {
          secondFrame = window.requestAnimationFrame(() => setIsAnimating(true));
        });
      }, 0);
    } else {
      immediateTimer = window.setTimeout(() => {
        setIsAnimating(false);
      }, 0);
      hideTimer = window.setTimeout(() => setIsVisible(false), 320);
    }

    return () => {
      if (immediateTimer !== null) {
        window.clearTimeout(immediateTimer);
      }
      if (hideTimer !== null) {
        window.clearTimeout(hideTimer);
      }
      if (firstFrame) {
        window.cancelAnimationFrame(firstFrame);
      }
      if (secondFrame) {
        window.cancelAnimationFrame(secondFrame);
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isVisible, onClose]);

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    touchStartY.current = event.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (touchStartY.current === null) {
      return;
    }

    const endY = event.changedTouches[0]?.clientY ?? touchStartY.current;
    const deltaY = endY - touchStartY.current;
    touchStartY.current = null;

    if (deltaY > 70) {
      onClose();
    }
  };

  if (!isVisible || !mounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 flex items-end md:hidden"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: isAnimating ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
        transition: 'background-color 280ms cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl bg-white dark:bg-zinc-900 border-t border-x border-zinc-200 dark:border-zinc-800"
        style={{
          maxHeight: '86vh',
          transform: isAnimating ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onClick={(event) => event.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-zinc-300" />

        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 px-4 pb-3 pt-3">
          <p className="font-display text-base font-semibold text-zinc-900 dark:text-white">
            Filters
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-4 py-4" style={{ maxHeight: 'calc(86vh - 64px)' }}>
          <section>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.08em]">Spend view</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Choose whether transfers and adjustments affect spend stats and charts.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (includeOperationalInAnalytics) {
                    onToggleIncludeOperationalInAnalytics();
                  }
                }}
                className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                  !includeOperationalInAnalytics
                    ? 'border-[#1D9E75] bg-[#1D9E75]/10 text-[#1D9E75]'
                    : 'border-[var(--color-border-secondary)] text-[var(--color-text-secondary)] hover:border-[#1D9E75]'
                }`}
              >
                Real spending only
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!includeOperationalInAnalytics) {
                    onToggleIncludeOperationalInAnalytics();
                  }
                }}
                className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                  includeOperationalInAnalytics
                    ? 'border-[#1D9E75] bg-[#1D9E75]/10 text-[#1D9E75]'
                    : 'border-[var(--color-border-secondary)] text-[var(--color-text-secondary)] hover:border-[#1D9E75]'
                }`}
              >
                Include transfers
              </button>
            </div>
          </section>

          <section>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.08em]">Month</p>
            <select
              value={selectedMonth}
              onChange={(event) => onMonthChange(event.target.value)}
              className="mt-3 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </section>

          <section>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.08em]">By category</p>
            <div className="mt-3 space-y-2.5">
              {categories.map((entry) => {
                const checked = selectedCategories.includes(entry.category);
                const width = highestCategoryTotal > 0 ? (entry.amount / highestCategoryTotal) * 100 : 0;

                return (
                  <button
                    key={entry.category}
                    type="button"
                    onClick={() => onToggleCategory(entry.category)}
                    className={`w-full rounded-lg px-2 py-2 text-left transition-colors ${checked ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">{entry.category}</span>
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">₱{entry.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${width}%`, backgroundColor: entry.color }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.08em]">Payment method</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {paymentMethodOptions.map((method) => {
                const checked = selectedPaymentMethod === method;
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => onPaymentMethodChange(method)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      checked
                        ? 'border-[#1D9E75] bg-[#1D9E75]/10 text-[#1D9E75]'
                        : 'border-[var(--color-border-secondary)] text-[var(--color-text-secondary)] hover:border-[#1D9E75]'
                    }`}
                  >
                    {method}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.08em]">Export</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onExportCSV}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border-secondary)] text-xs font-semibold text-[var(--color-text-secondary)] transition-colors hover:border-[#1D9E75]"
              >
                <Download size={12} />
                CSV
              </button>
              <button
                type="button"
                onClick={onExportPDF}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border-secondary)] text-xs font-semibold text-[var(--color-text-secondary)] transition-colors hover:border-[#1D9E75]"
              >
                <Download size={12} />
                PDF
              </button>
            </div>
          </section>

          <button
            type="button"
            onClick={onApply}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#1D9E75] text-sm font-semibold text-white"
          >
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
