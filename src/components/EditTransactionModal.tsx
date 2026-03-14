'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import {
  CATEGORIES,
  PAYMENT_METHODS,
  type Category,
  type PaymentMethod,
  type Transaction,
} from '@/lib/types';

interface EditTransactionModalProps {
  transaction: Transaction | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditTransactionModal({
  transaction,
  onClose,
  onUpdated,
}: EditTransactionModalProps) {
  const [amount, setAmount] = useState(transaction?.amount.toString() ?? '');
  const [category, setCategory] = useState<Category>(transaction?.category ?? 'Food');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    transaction?.paymentMethod ?? 'Cash'
  );
  const [notes, setNotes] = useState(transaction?.notes ?? '');
  const [date, setDate] = useState(
    transaction?.date ? transaction.date.split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [showOptional, setShowOptional] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!transaction) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;

    setSaving(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: transaction.id,
          amount: parseFloat(amount),
          category,
          date: new Date(date).toISOString(),
          paymentMethod,
          notes,
        }),
      });
      if (res.ok) {
        onUpdated();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl p-6 pb-8 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Edit Expense</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount */}
          <div>
            <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Amount (₱)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full mt-1 text-4xl font-bold text-center py-4 border-2 border-zinc-200 dark:border-zinc-700 rounded-2xl bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-emerald-500 focus:ring-0 outline-none transition-colors"
              autoFocus
              required
            />
          </div>

          {/* Category Grid */}
          <div>
            <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Category</label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                    category === cat
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full mt-1 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Optional Fields */}
          <button
            type="button"
            onClick={() => setShowOptional(!showOptional)}
            className="text-sm text-emerald-600 dark:text-emerald-400 font-medium"
          >
            {showOptional ? 'Hide' : 'Show'} optional fields
          </button>

          {showOptional && (
            <div className="space-y-3 animate-fade-in">
              <div>
                <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm} value={pm}>
                      {pm}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional note..."
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-400 text-white font-semibold rounded-2xl transition-colors mt-2"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
