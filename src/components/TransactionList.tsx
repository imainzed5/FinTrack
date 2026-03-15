'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { format, parseISO } from 'date-fns';
import {
  CreditCard,
  Landmark,
  Repeat,
  Tag,
  Trash2,
  Pencil,
  ReceiptText,
  SplitSquareHorizontal,
  Wallet,
} from 'lucide-react';
import type { PaymentMethod, Transaction } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { isToday, isYesterday } from 'date-fns';

const categoryColors: Record<string, string> = {
  Food: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
  Transportation: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  Subscriptions: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400',
  Utilities: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400',
  Shopping: 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-400',
  Entertainment: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400',
  Health: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400',
  Education: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400',
  Miscellaneous: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-400',
};

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

function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  const baseClassName =
    'inline-flex items-center gap-1.5 rounded-full border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-100/75 dark:bg-zinc-800/75 px-2 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300';

  if (method === 'Cash') {
    return (
      <span className={baseClassName}>
        <span role="img" aria-hidden="true" className="text-[13px] leading-none">💵</span>
        <span>Cash</span>
      </span>
    );
  }

  if (method === 'GCash') {
    return (
      <span className={baseClassName}>
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
        <span>GCash</span>
      </span>
    );
  }

  if (method === 'Maya') {
    return (
      <span className={baseClassName}>
        <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" aria-hidden="true" />
        <span>Maya</span>
      </span>
    );
  }

  if (method === 'Bank Transfer') {
    return (
      <span className={baseClassName}>
        <Landmark size={12} />
        <span>Bank</span>
      </span>
    );
  }

  if (method === 'Credit Card' || method === 'Debit Card') {
    return (
      <span className={baseClassName}>
        <CreditCard size={12} />
        <span>{method === 'Credit Card' ? 'Credit' : 'Debit'}</span>
      </span>
    );
  }

  return (
    <span className={baseClassName}>
      <Wallet size={12} />
      <span>{method}</span>
    </span>
  );
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
  const offsetRef = useRef(0);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startOffsetRef = useRef(0);
  const axisLockRef = useRef<'x' | 'y' | null>(null);

  const canSwipeLeft = swipeEnabled && Boolean(showDelete && onDelete);
  const canSwipeRight = swipeEnabled && Boolean(showEdit && onEdit);

  const updateOffset = (nextOffset: number) => {
    offsetRef.current = nextOffset;
    setOffsetX(nextOffset);
  };

  const closeSwipe = () => updateOffset(0);

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

  const txDate = safeParseDate(tx.date);
  const merchantAnchor = tx.merchant || tx.description || tx.notes || tx.category;
  const secondaryCopy =
    tx.description && tx.description !== merchantAnchor
      ? tx.description
      : tx.notes && tx.notes !== merchantAnchor
        ? tx.notes
        : '';
  const categoryLabel = tx.subCategory ? `${tx.category} · ${tx.subCategory}` : tx.category;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-100 dark:border-zinc-800">
      {swipeEnabled && (
        <div className="absolute inset-0 flex items-stretch">
          {canSwipeRight && (
            <button
              type="button"
              onClick={() => {
                onEdit?.(tx);
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
        className="relative rounded-2xl bg-white dark:bg-zinc-900 p-4"
        style={cardStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClickCapture={handleForegroundClick}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-display text-[1.9rem] sm:text-3xl leading-none font-bold text-zinc-900 dark:text-white">
              {formatCurrency(tx.amount)}
            </p>
            <p className="mt-2 text-[15px] sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {merchantAnchor}
            </p>
          </div>

          <span className="text-[11px] sm:text-xs font-medium text-zinc-500 dark:text-zinc-400 shrink-0">
            {format(txDate, 'MMM d')}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <PaymentMethodBadge method={tx.paymentMethod} />
          {!tx.synced && (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
              Pending sync
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium opacity-80 ${
              categoryColors[tx.category] || categoryColors.Miscellaneous
            }`}
          >
            {categoryLabel}
          </span>

          {tx.split && tx.split.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 opacity-80">
              <SplitSquareHorizontal size={10} />
              Split ({tx.split.length})
            </span>
          )}

          {tx.recurring && (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 opacity-80">
              <Repeat size={10} />
              {tx.recurring.frequency}
            </span>
          )}

          {tx.tags && tx.tags.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300 opacity-80">
              <Tag size={10} />
              {tx.tags.slice(0, 2).join(', ')}
              {tx.tags.length > 2 ? '...' : ''}
            </span>
          )}

          {tx.attachmentBase64 && (
            <a
              href={tx.attachmentBase64}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 opacity-80"
            >
              <ReceiptText size={10} />
              Receipt
            </a>
          )}
        </div>

        {secondaryCopy && (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
            {secondaryCopy}
          </p>
        )}

        {(showEdit || showDelete) && (
          <div className="mt-3 hidden sm:flex items-center justify-end gap-2">
            {showEdit && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(tx)}
                className="min-h-12 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Edit
              </button>
            )}
            {showDelete && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(tx.id)}
                className="min-h-12 px-4 rounded-xl bg-red-50 dark:bg-red-500/15 text-sm font-medium text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/25 transition-colors"
              >
                Delete
              </button>
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
      <div className="text-center py-10 text-zinc-400 dark:text-zinc-600">
        <p className="text-sm">No transactions yet.</p>
        <p className="text-[13px] sm:text-xs mt-1">Tap the + button to add your first expense.</p>
      </div>
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
      <div className="space-y-3">
        {grouped.map((group) => (
          <section key={group.key} className="space-y-2">
            {groupByDate && (
              <div
                className={`sticky ${stickyHeaderOffsetClassName} z-10 -mx-1 px-1 py-1.5 bg-zinc-50/95 dark:bg-zinc-950/90 backdrop-blur`}
              >
                <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-zinc-500 dark:text-zinc-400">
                  {group.label}
                </p>
              </div>
            )}

            <div className="space-y-2">
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
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((tx) => (
        <div
          key={tx.id}
          className="flex items-start gap-3 p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700 transition-colors"
        >
          <div
            className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium ${
              categoryColors[tx.category] || categoryColors.Miscellaneous
            }`}
          >
            {tx.subCategory ? `${tx.category} · ${tx.subCategory}` : tx.category}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[15px] sm:text-sm font-medium text-zinc-900 dark:text-white truncate">
              {tx.description || tx.merchant || tx.notes || tx.category}
            </p>
            <p className="text-[13px] sm:text-xs text-zinc-400 dark:text-zinc-500">
              {tx.merchant ? `${tx.merchant} · ` : ''}
              {format(parseISO(tx.date), 'MMM d, yyyy')} · {tx.paymentMethod}
              {!tx.synced && (
                <span className="ml-1 text-amber-500">(pending sync)</span>
              )}
            </p>

            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {tx.split && tx.split.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] sm:text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                  <SplitSquareHorizontal size={10} />
                  Split ({tx.split.length})
                </span>
              )}
              {tx.recurring && (
                <span className="inline-flex items-center gap-1 text-[11px] sm:text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <Repeat size={10} />
                  {tx.recurring.frequency}
                </span>
              )}
              {tx.tags && tx.tags.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] sm:text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300">
                  <Tag size={10} />
                  {tx.tags.slice(0, 2).join(', ')}{tx.tags.length > 2 ? '...' : ''}
                </span>
              )}
              {tx.attachmentBase64 && (
                <a
                  href={tx.attachmentBase64}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] sm:text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                >
                  <ReceiptText size={10} />
                  Receipt
                </a>
              )}
            </div>

            {tx.notes && tx.notes !== tx.description && (
              <p className="text-[13px] sm:text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-1">
                {tx.notes}
              </p>
            )}
          </div>

          <p className="font-display text-base sm:text-sm font-bold text-zinc-900 dark:text-white">
            {formatCurrency(tx.amount)}
          </p>

          {showEdit && onEdit && (
            <button
              onClick={() => onEdit(tx)}
              className="p-1.5 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
              aria-label="Edit transaction"
            >
              <Pencil size={14} />
            </button>
          )}

          {showDelete && onDelete && (
            <button
              onClick={() => onDelete(tx.id)}
              className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
              aria-label="Delete transaction"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
