'use client';

import { format, parseISO } from 'date-fns';
import { Trash2, Pencil } from 'lucide-react';
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
        <p className="text-xs mt-1">Tap the + button to add your first expense.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((tx) => (
        <div
          key={tx.id}
          className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700 transition-colors"
        >
          <div
            className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium ${
              categoryColors[tx.category] || categoryColors.Miscellaneous
            }`}
          >
            {tx.category}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
              {tx.notes || tx.category}
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              {format(parseISO(tx.date), 'MMM d, yyyy')} · {tx.paymentMethod}
              {!tx.synced && (
                <span className="ml-1 text-amber-500">(pending sync)</span>
              )}
            </p>
          </div>

          <p className="text-sm font-bold text-zinc-900 dark:text-white">
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
