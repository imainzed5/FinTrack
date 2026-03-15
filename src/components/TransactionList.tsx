'use client';

import { format, parseISO } from 'date-fns';
import { Repeat, Tag, Trash2, Pencil, ReceiptText, SplitSquareHorizontal } from 'lucide-react';
import type { Transaction } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

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
}

export default function TransactionList({
  transactions,
  onDelete,
  onEdit,
  showDelete = false,
  showEdit = false,
}: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-10 text-zinc-400 dark:text-zinc-600">
        <p className="text-sm">No transactions yet.</p>
        <p className="text-[13px] sm:text-xs mt-1">Tap the + button to add your first expense.</p>
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

          <p className="text-base sm:text-sm font-bold text-zinc-900 dark:text-white">
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
