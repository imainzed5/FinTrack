'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import {
  CreditCard,
  Landmark,
  MoreVertical,
  Pencil,
  Repeat,
  ReceiptText,
  Smartphone,
  SplitSquareHorizontal,
  Tag,
  Trash2,
  Wallet,
} from 'lucide-react';
import { CATEGORIES, type PaymentMethod, type Transaction } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';

type CategoryColorTokens = {
  accent: string;
  icon: string;
  pill: string;
};

const categoryColors: Record<string, CategoryColorTokens> = {
  Food: {
    accent: 'bg-orange-500 dark:bg-orange-400',
    icon: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
    pill: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  },
  Transportation: {
    accent: 'bg-blue-500 dark:bg-blue-400',
    icon: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
    pill: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  },
  Subscriptions: {
    accent: 'bg-purple-500 dark:bg-purple-400',
    icon: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
    pill: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
  },
  Utilities: {
    accent: 'bg-cyan-500 dark:bg-cyan-400',
    icon: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
    pill: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
  },
  Shopping: {
    accent: 'bg-pink-500 dark:bg-pink-400',
    icon: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300',
    pill: 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
  },
  Entertainment: {
    accent: 'bg-yellow-500 dark:bg-yellow-400',
    icon: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300',
    pill: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300',
  },
  Health: {
    accent: 'bg-green-500 dark:bg-green-400',
    icon: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
    pill: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  },
  Education: {
    accent: 'bg-indigo-500 dark:bg-indigo-400',
    icon: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
    pill: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  },
  Miscellaneous: {
    accent: 'bg-zinc-500 dark:bg-zinc-400',
    icon: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-300',
    pill: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  },
};

const CATEGORY_ICON_MAP: Record<(typeof CATEGORIES)[number], typeof Wallet> = {
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

const PAYMENT_METHOD_ICON_MAP: Record<PaymentMethod, typeof Wallet> = {
  Cash: Wallet,
  'Credit Card': CreditCard,
  'Debit Card': CreditCard,
  GCash: Smartphone,
  Maya: Smartphone,
  'Bank Transfer': Landmark,
  Other: Wallet,
};

function getIconBackgroundTint(category: string): string {
  if (category === 'Food') return '#FAECE7';
  if (category === 'Transportation') return '#E6F1FB';
  if (category === 'Health') return '#EAF3DE';
  if (category === 'Subscriptions') return '#EEEDFE';
  if (category === 'Shopping') return '#FBEAF0';
  return '#F1EFE8';
}

interface TransactionListProps {
  transactions: Transaction[];
  onDelete?: (id: string) => void;
  onEdit?: (tx: Transaction) => void;
  showDelete?: boolean;
  showEdit?: boolean;
  mobileFirst?: boolean;
  groupByDate?: boolean;
  stickyHeaderOffsetClassName?: string;
}

const SWIPE_ACTION_WIDTH = 96;
const SWIPE_OPEN_THRESHOLD = 48;

function safeParseDate(rawDate: string): Date {
  const parsed = parseISO(rawDate);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const fallback = new Date(rawDate);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback;
  }

  return new Date();
}

function getDateGroupLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d');
}

function getTransactionCategoryLabel(tx: Transaction): string {
  if (tx.type === 'income') {
    return tx.incomeCategory || 'Other Income';
  }

  if (tx.type === 'savings') {
    return tx.savingsMeta?.goalName ?? 'Savings';
  }

  return tx.subCategory ? `${tx.category} · ${tx.subCategory}` : tx.category;
}

function formatSignedAmount(value: number): string {
  const formatted = formatCurrency(Math.abs(value));

  if (value > 0) {
    return `+${formatted}`;
  }

  if (value < 0) {
    return `-${formatted}`;
  }

  return formatted;
}

function formatTransactionAmount(tx: Transaction): string {
  let signedValue = -Math.abs(tx.amount);

  if (tx.type === 'income') {
    signedValue = Math.abs(tx.amount);
  }

  if (tx.type === 'savings') {
    signedValue = tx.savingsMeta?.depositType === 'withdrawal'
      ? -Math.abs(tx.amount)
      : Math.abs(tx.amount);
  }

  return formatSignedAmount(signedValue);
}

function getGroupNetTotal(items: Transaction[]): number {
  return items.reduce((total, item) => {
    return total + (item.type === 'income' ? Math.abs(item.amount) : -Math.abs(item.amount));
  }, 0);
}

function getCategoryTone(tx: Transaction): CategoryColorTokens {
  if (tx.type === 'savings') {
    if (tx.savingsMeta?.depositType === 'withdrawal') {
      return {
        accent: 'bg-amber-500 dark:bg-amber-400',
        icon: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
        pill: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
      };
    }

    return {
      accent: 'bg-emerald-500 dark:bg-emerald-400',
      icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
      pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    };
  }

  return categoryColors[tx.category] || categoryColors.Miscellaneous;
}

function getCategoryIcon(tx: Transaction): typeof Wallet {
  if (tx.type === 'income') {
    return Wallet;
  }

  return CATEGORY_ICON_MAP[tx.category] || Wallet;
}

interface SwipeableTransactionRowProps {
  tx: Transaction;
  onDelete?: (id: string) => void;
  onEdit?: (tx: Transaction) => void;
  showDelete: boolean;
  showEdit: boolean;
  swipeEnabled: boolean;
}

function SwipeableTransactionRow({
  tx,
  onDelete,
  onEdit,
  showDelete,
  showEdit,
  swipeEnabled,
}: SwipeableTransactionRowProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const offsetRef = useRef(0);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startOffsetRef = useRef(0);
  const axisLockRef = useRef<'x' | 'y' | null>(null);

  const isSavingsRow = tx.type === 'savings';
  const hasEditAction = Boolean(showEdit && onEdit && !isSavingsRow);
  const hasDeleteAction = Boolean(showDelete && onDelete);
  const hasMenuActions = hasEditAction || hasDeleteAction;
  const canSwipeLeft = swipeEnabled && Boolean(showDelete && onDelete);
  const canSwipeRight = swipeEnabled && Boolean(showEdit && onEdit && !isSavingsRow);

  const updateOffset = (nextOffset: number) => {
    offsetRef.current = nextOffset;
    setOffsetX(nextOffset);
  };

  const closeSwipe = () => updateOffset(0);
  const closeActionMenu = () => {
    setIsActionMenuOpen(false);
    setShowDeleteConfirmation(false);
  };

  const clampOffset = (value: number) => {
    const min = canSwipeLeft ? -SWIPE_ACTION_WIDTH : 0;
    const max = canSwipeRight ? SWIPE_ACTION_WIDTH : 0;
    return Math.max(min, Math.min(max, value));
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!swipeEnabled) return;
    if (event.pointerType === 'mouse') return;
    if (event.button !== 0) return;

    startXRef.current = event.clientX;
    startYRef.current = event.clientY;
    startOffsetRef.current = offsetRef.current;
    axisLockRef.current = null;
    setIsDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!swipeEnabled || !isDragging) return;

    const deltaX = event.clientX - startXRef.current;
    const deltaY = event.clientY - startYRef.current;

    if (!axisLockRef.current) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) {
        return;
      }

      axisLockRef.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y';
    }

    if (axisLockRef.current !== 'x') {
      return;
    }

    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    event.preventDefault();
    const nextOffset = clampOffset(startOffsetRef.current + deltaX);
    updateOffset(nextOffset);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!swipeEnabled) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!isDragging) return;
    setIsDragging(false);

    if (axisLockRef.current !== 'x') {
      axisLockRef.current = null;
      return;
    }

    if (offsetRef.current <= -SWIPE_OPEN_THRESHOLD && canSwipeLeft) {
      updateOffset(-SWIPE_ACTION_WIDTH);
      return;
    }

    if (offsetRef.current >= SWIPE_OPEN_THRESHOLD && canSwipeRight) {
      updateOffset(SWIPE_ACTION_WIDTH);
      return;
    }

    axisLockRef.current = null;
    closeSwipe();
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!swipeEnabled) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setIsDragging(false);
    axisLockRef.current = null;
    closeSwipe();
  };

  const handleForegroundClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!swipeEnabled || offsetRef.current === 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    closeSwipe();
  };

  const cardStyle: CSSProperties = {
    transform: `translateX(${swipeEnabled ? offsetX : 0}px)`,
    transition: isDragging ? 'none' : 'transform 180ms ease-out',
    touchAction: swipeEnabled ? 'pan-y' : 'auto',
  };

  const merchantAnchor = tx.merchant || tx.description || tx.notes || tx.category;
  const categoryLabel = getTransactionCategoryLabel(tx);
  const categoryTone = getCategoryTone(tx);
  const CategoryIcon = getCategoryIcon(tx);
  const PaymentMethodIcon = PAYMENT_METHOD_ICON_MAP[tx.paymentMethod] || Wallet;
  const iconTint = getIconBackgroundTint(tx.category);
  const amountColorClassName =
    tx.type === 'income'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tx.type === 'savings' && tx.savingsMeta?.depositType === 'deposit'
        ? 'text-emerald-600 dark:text-emerald-400'
        : tx.type === 'savings' && tx.savingsMeta?.depositType === 'withdrawal'
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-red-600 dark:text-red-400';

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-100 dark:border-zinc-800">
      {swipeEnabled && (
        <div className="absolute inset-0 flex items-stretch">
          {canSwipeRight && (
            <button
              type="button"
              onClick={() => {
                if (tx.type === 'savings') return;
                onEdit?.(tx);
                closeActionMenu();
                closeSwipe();
              }}
              className="inline-flex w-24 min-w-24 items-center justify-center gap-1.5 bg-emerald-500 text-white text-sm font-semibold"
              aria-label="Edit transaction"
            >
              <Pencil size={15} />
              Edit
            </button>
          )}
          <div className="flex-1 bg-zinc-100/80 dark:bg-zinc-900/70" />
          {canSwipeLeft && (
            <button
              type="button"
              onClick={() => {
                onDelete?.(tx.id);
                closeActionMenu();
                closeSwipe();
              }}
              className="inline-flex w-24 min-w-24 items-center justify-center gap-1.5 bg-red-500 text-white text-sm font-semibold"
              aria-label="Delete transaction"
            >
              <Trash2 size={15} />
              Delete
            </button>
          )}
        </div>
      )}

      <div
        className="relative rounded-2xl bg-white dark:bg-zinc-900"
        style={cardStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClickCapture={handleForegroundClick}
      >
        <div className="flex items-start gap-3 py-4 pl-4 pr-3 sm:pr-4">
          <div
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${categoryTone.icon}`}
            style={{ backgroundColor: iconTint }}
          >
            <CategoryIcon size={17} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium text-zinc-900 dark:text-zinc-100">
              {merchantAnchor}
            </p>

            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryTone.pill}`}>
                {categoryLabel}
              </span>

              <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                <PaymentMethodIcon size={12} />
                <span>{tx.paymentMethod}</span>
              </span>

              {!tx.synced && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                  Pending sync
                </span>
              )}
            </div>
          </div>

          <div className="ml-1 flex shrink-0 items-center gap-1">
            <div className="text-right">
              <p className={`text-[14px] font-medium leading-tight ${amountColorClassName}`}>
                {formatTransactionAmount(tx)}
              </p>
            </div>

            {hasMenuActions && (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsActionMenuOpen((open) => !open);
                  setShowDeleteConfirmation(false);
                }}
                className="inline-flex h-8 w-8 self-center items-center justify-center rounded-[6px] text-zinc-500 opacity-100 transition-colors transition-opacity hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:hover:bg-[color:var(--color-background-secondary)]"
                aria-label="More transaction actions"
                aria-expanded={isActionMenuOpen}
              >
                <MoreVertical size={16} />
              </button>
            )}
          </div>
        </div>

        {isActionMenuOpen && hasMenuActions && (
          <div className="border-t border-zinc-200/80 bg-zinc-50/85 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/80">
            {!showDeleteConfirmation ? (
              <div className="flex items-center justify-end gap-2">
                {hasEditAction && (
                  <button
                    type="button"
                    onClick={() => {
                      if (tx.type === 'savings') return;
                      onEdit?.(tx);
                      closeActionMenu();
                      closeSwipe();
                    }}
                    className="min-h-10 rounded-lg bg-zinc-200/70 px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-300/70 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                  >
                    Edit
                  </button>
                )}

                {hasDeleteAction && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirmation(true)}
                    className="min-h-10 rounded-lg bg-red-50 px-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-500/25"
                  >
                    Delete
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Delete this transaction?
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onDelete?.(tx.id);
                      closeActionMenu();
                      closeSwipe();
                    }}
                    className="min-h-10 rounded-lg bg-red-500 px-3 text-sm font-semibold text-white transition-colors hover:bg-red-600"
                  >
                    Yes, delete
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirmation(false)}
                    className="min-h-10 rounded-lg bg-zinc-200/70 px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-300/70 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TransactionList({
  transactions,
  onDelete,
  onEdit,
  showDelete = false,
  showEdit = false,
  mobileFirst = false,
  groupByDate = false,
  stickyHeaderOffsetClassName = 'top-24 sm:top-20',
}: TransactionListProps) {
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const swipeEnabled = mobileFirst && isMobileViewport;

  useEffect(() => {
    if (!mobileFirst) {
      return;
    }

    const viewportQuery = window.matchMedia('(max-width: 639px)');
    const syncViewportStateId = window.setTimeout(() => {
      setIsMobileViewport(viewportQuery.matches);
    }, 0);

    const handleViewportChange = (event: MediaQueryListEvent) => {
      setIsMobileViewport(event.matches);
    };

    viewportQuery.addEventListener('change', handleViewportChange);

    return () => {
      window.clearTimeout(syncViewportStateId);
      viewportQuery.removeEventListener('change', handleViewportChange);
    };
  }, [mobileFirst]);

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon="berde"
        headline="No transactions yet."
        subtext="Berde's waiting. Add your first one."
      />
    );
  }

  if (mobileFirst) {
    const sortedTransactions = [...transactions].sort(
      (a, b) => safeParseDate(b.date).getTime() - safeParseDate(a.date).getTime()
    );

    const grouped = (() => {
      if (!groupByDate) {
        return [
          {
            key: 'all',
            label: 'Transactions',
            items: sortedTransactions,
          },
        ];
      }

      const groups: Array<{ key: string; label: string; items: Transaction[] }> = [];
      const map = new Map<string, { key: string; label: string; items: Transaction[] }>();

      sortedTransactions.forEach((tx) => {
        const txDate = safeParseDate(tx.date);
        const key = format(txDate, 'yyyy-MM-dd');

        if (!map.has(key)) {
          const bucket = {
            key,
            label: getDateGroupLabel(txDate),
            items: [] as Transaction[],
          };
          map.set(key, bucket);
          groups.push(bucket);
        }

        map.get(key)?.items.push(tx);
      });

      return groups;
    })();

    return (
      <div className="space-y-4">
        {grouped.map((group) => {
          const groupTotal = formatSignedAmount(getGroupNetTotal(group.items));

          return (
            <section key={group.key} className="space-y-2">
              {groupByDate && (
                <div
                  className={`sticky ${stickyHeaderOffsetClassName} z-10 -mx-1 px-1 py-1.5 bg-zinc-50/95 dark:bg-zinc-950/90 backdrop-blur`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-zinc-500 dark:text-zinc-400">
                      {group.label}
                    </p>
                    <span className="text-xs text-[var(--color-text-tertiary)]">
                      {groupTotal}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                {group.items.map((tx) => (
                  <SwipeableTransactionRow
                    key={tx.id}
                    tx={tx}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    showDelete={showDelete}
                    showEdit={showEdit}
                    swipeEnabled={swipeEnabled}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((tx) => (
        <SwipeableTransactionRow
          key={tx.id}
          tx={tx}
          onDelete={onDelete}
          onEdit={onEdit}
          showDelete={showDelete}
          showEdit={showEdit}
          swipeEnabled={false}
        />
      ))}
    </div>
  );
}
