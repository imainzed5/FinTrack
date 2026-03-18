'use client';

import Image from 'next/image';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Repeat, Trash2, X } from 'lucide-react';
import {
  CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  RECURRING_FREQUENCIES,
  type TransactionInput,
  type TransactionType,
  type IncomeCategory,
  type Category,
  type PaymentMethod,
  type RecurringFrequency,
  type Transaction,
  type TransactionSplitInput,
} from '@/lib/types';
import { savePendingTransaction } from '@/lib/indexeddb';

interface AddExpenseModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

interface SplitDraft {
  id: string;
  category: Category;
  subCategory: string;
  amount: string;
}

function parseTags(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  );
}

function nextRecurringRunDate(
  fromDate: string,
  frequency: RecurringFrequency,
  interval = 1
): string {
  const date = new Date(fromDate);
  const steps = Math.max(1, Math.floor(interval));

  if (frequency === 'daily') date.setDate(date.getDate() + steps);
  else if (frequency === 'weekly') date.setDate(date.getDate() + (7 * steps));
  else if (frequency === 'yearly') date.setFullYear(date.getFullYear() + steps);
  else date.setMonth(date.getMonth() + steps);

  return date.toISOString();
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Unable to encode image.'));
      }
    };
    reader.onerror = () => reject(new Error('Unable to read file.'));
    reader.readAsDataURL(file);
  });
}

function createSplitDraft(defaultCategory: Category): SplitDraft {
  return {
    id: uuidv4(),
    category: defaultCategory,
    subCategory: '',
    amount: '',
  };
}

export default function AddExpenseModal({ open, onClose, onAdded }: AddExpenseModalProps) {
  const [entryType, setEntryType] = useState<TransactionType>('expense');
  const [incomeCategory, setIncomeCategory] = useState<IncomeCategory>('Freelance');
  const [incomeRecurringMonthly, setIncomeRecurringMonthly] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('Food');
  const [subCategory, setSubCategory] = useState('');
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [notes, setNotes] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [attachmentBase64, setAttachmentBase64] = useState<string | undefined>(undefined);
  const [attachmentName, setAttachmentName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitRows, setSplitRows] = useState<SplitDraft[]>([]);
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>('monthly');
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [showOptional, setShowOptional] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoFocusAmount, setAutoFocusAmount] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const isIncomeEntry = entryType === 'income';

  const amountValue = Number.parseFloat(amount);
  const splitTotal = useMemo(
    () => splitRows.reduce((sum, row) => sum + (Number.parseFloat(row.amount) || 0), 0),
    [splitRows]
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 640px)');
    const syncAutoFocus = () => setAutoFocusAmount(mediaQuery.matches);

    syncAutoFocus();
    mediaQuery.addEventListener('change', syncAutoFocus);

    return () => {
      mediaQuery.removeEventListener('change', syncAutoFocus);
    };
  }, []);

  useEffect(() => {
    if (!open || !autoFocusAmount) return;
    amountInputRef.current?.focus();
  }, [open, autoFocusAmount]);

  useEffect(() => {
    if (entryType !== 'income') {
      return;
    }

    if (splitEnabled) {
      setSplitEnabled(false);
      setSplitRows([]);
    }

    if (showOptional) {
      setShowOptional(false);
    }

    if (recurringFrequency !== 'monthly') {
      setRecurringFrequency('monthly');
    }
  }, [entryType, recurringFrequency, showOptional, splitEnabled]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const resetForm = () => {
    setEntryType('expense');
    setIncomeCategory('Freelance');
    setIncomeRecurringMonthly(false);
    setAmount('');
    setCategory('Food');
    setSubCategory('');
    setDescription('');
    setMerchant('');
    setPaymentMethod('Cash');
    setNotes('');
    setTagsInput('');
    setAttachmentBase64(undefined);
    setAttachmentName('');
    setDate(new Date().toISOString().split('T')[0]);
    setSplitEnabled(false);
    setSplitRows([]);
    setRecurringEnabled(false);
    setRecurringFrequency('monthly');
    setRecurringEndDate('');
    setShowOptional(false);
    setFormError(null);
  };

  const handleAttachmentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setAttachmentBase64(undefined);
      setAttachmentName('');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setFormError('Only image files can be attached as receipts.');
      return;
    }

    try {
      const encoded = await fileToBase64(file);
      setAttachmentBase64(encoded);
      setAttachmentName(file.name);
      setFormError(null);
    } catch {
      setFormError('Unable to read attachment. Please try a different image.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!amount || !Number.isFinite(amountValue) || amountValue <= 0) {
      setFormError('Amount must be greater than zero.');
      return;
    }

    let normalizedSplit: TransactionSplitInput[] | undefined;
    if (!isIncomeEntry && splitEnabled) {
      const parsed = splitRows
        .map((row) => ({
          id: row.id,
          category: row.category,
          subCategory: row.subCategory.trim() || undefined,
          amount: Number.parseFloat(row.amount),
        }))
        .filter((row) => Number.isFinite(row.amount) && row.amount > 0);

      if (parsed.length < 2) {
        setFormError('Split transactions require at least two lines with positive amounts.');
        return;
      }

      const total = parsed.reduce((sum, row) => sum + row.amount, 0);
      if (Math.abs(total - amountValue) > 0.01) {
        setFormError('Split amounts must add up exactly to the transaction total.');
        return;
      }

      normalizedSplit = parsed.map((row) => ({
        id: row.id,
        category: row.category,
        subCategory: row.subCategory,
        amount: Number(row.amount.toFixed(2)),
      }));
    }

    setSaving(true);

    const normalizedDate = new Date(date).toISOString();
    const tags = parseTags(tagsInput);
    const descriptionValue = description.trim() || (isIncomeEntry ? incomeCategory : category);
    const recurring = isIncomeEntry
      ? (incomeRecurringMonthly
        ? {
            frequency: 'monthly' as const,
            interval: 1,
          }
        : undefined)
      : (recurringEnabled
        ? {
            frequency: recurringFrequency,
            interval: 1,
            endDate: recurringEndDate ? new Date(recurringEndDate).toISOString() : undefined,
          }
        : undefined);
    const resolvedType: TransactionType = isIncomeEntry ? 'income' : 'expense';
    const resolvedCategory: Category = isIncomeEntry
      ? 'Miscellaneous'
      : (normalizedSplit?.[0]?.category || category);

    const input: TransactionInput = {
      amount: Number(amountValue.toFixed(2)),
      type: resolvedType,
      incomeCategory: isIncomeEntry ? incomeCategory : undefined,
      category: resolvedCategory,
      subCategory: isIncomeEntry
        ? undefined
        : (normalizedSplit?.[0]?.subCategory || (subCategory.trim() || undefined)),
      merchant: merchant.trim() || undefined,
      description: descriptionValue,
      date: normalizedDate,
      paymentMethod: isIncomeEntry ? 'Cash' : paymentMethod,
      notes: isIncomeEntry ? undefined : (notes.trim() || undefined),
      tags: isIncomeEntry ? [] : tags,
      attachmentBase64: isIncomeEntry ? undefined : attachmentBase64,
      split: isIncomeEntry ? undefined : normalizedSplit,
      recurring,
    };

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!res.ok) throw new Error('Failed');
    } catch {
      // Save offline
      const nowIso = new Date().toISOString();
      const offlineRecurring = recurring
        ? {
            frequency: recurring.frequency,
            interval: recurring.interval || 1,
            nextRunDate: nextRecurringRunDate(normalizedDate, recurring.frequency, recurring.interval),
            endDate: recurring.endDate,
          }
        : undefined;

      const offlineTx: Transaction = {
        id: uuidv4(),
        amount: input.amount,
        type: resolvedType,
        incomeCategory: isIncomeEntry ? incomeCategory : undefined,
        category: input.category,
        subCategory: input.subCategory,
        merchant: input.merchant,
        description: input.description,
        date: normalizedDate,
        paymentMethod: isIncomeEntry ? 'Cash' : (input.paymentMethod || 'Cash'),
        notes: isIncomeEntry ? '' : (input.notes || ''),
        tags: isIncomeEntry ? [] : (input.tags || []),
        attachmentBase64: isIncomeEntry ? undefined : input.attachmentBase64,
        split: isIncomeEntry ? undefined : (input.split as Transaction['split']),
        recurring: offlineRecurring,
        createdAt: nowIso,
        updatedAt: nowIso,
        synced: false,
      };
      await savePendingTransaction(offlineTx);
    }

    setSaving(false);
    resetForm();
    onAdded();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl animate-slide-up max-h-[100dvh] sm:max-h-[90dvh] flex flex-col modal-shell"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <h2 id={titleId} className="text-xl font-bold text-zinc-900 dark:text-white">
            {isIncomeEntry ? 'Log Income' : 'Add Expense'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={isIncomeEntry ? 'Close log income modal' : 'Close add expense modal'}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-4 pb-4 space-y-4 modal-content-scroll">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 p-1 grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setEntryType('expense')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                !isIncomeEntry
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-300'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setEntryType('income')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                isIncomeEntry
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-300'
              }`}
            >
              Income
            </button>
          </div>

          {formError && (
            <div className="px-3 py-2 rounded-xl text-xs bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
              {formError}
            </div>
          )}

          {/* Amount - Primary Input */}
          <div>
            <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {isIncomeEntry ? 'Amount Received' : 'Amount (₱)'}
            </label>
            <input
              ref={amountInputRef}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full mt-1 text-3xl sm:text-4xl font-bold text-center py-4 border-2 border-zinc-200 dark:border-zinc-700 rounded-2xl bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-emerald-500 focus:ring-0 outline-none transition-colors"
              required
            />
          </div>

          {isIncomeEntry && (
            <div>
              <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Frequency</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIncomeRecurringMonthly(false)}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                    !incomeRecurringMonthly
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  One-time
                </button>
                <button
                  type="button"
                  onClick={() => setIncomeRecurringMonthly(true)}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                    incomeRecurringMonthly
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  Recurring monthly
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Dinner with friends"
              className="w-full mt-1 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Merchant</label>
            <input
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="e.g., Starbucks"
              className="w-full mt-1 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Category */}
          {!isIncomeEntry && (
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
          )}

          {isIncomeEntry && (
            <div>
              <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Income Category</label>
              <select
                value={incomeCategory}
                onChange={(e) => setIncomeCategory(e.target.value as IncomeCategory)}
                className="w-full mt-1 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
              >
                {INCOME_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}

          {!isIncomeEntry && (
            <div>
              <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Sub-category (optional)</label>
              <input
                type="text"
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                disabled={splitEnabled}
                placeholder={splitEnabled ? 'Managed via split lines' : 'e.g., Groceries'}
                className="w-full mt-1 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors disabled:opacity-60"
              />
            </div>
          )}

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

          {!isIncomeEntry && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="flex items-center justify-between px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300">
                <span className="font-medium">Split Transaction</span>
                <input
                  type="checkbox"
                  checked={splitEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setSplitEnabled(enabled);
                    if (enabled && splitRows.length < 2) {
                      setSplitRows([
                        createSplitDraft(category),
                        createSplitDraft('Miscellaneous'),
                      ]);
                    }
                  }}
                  className="h-4 w-4 accent-emerald-500"
                />
              </label>
              <label className="flex items-center justify-between px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300">
                <span className="font-medium flex items-center gap-1.5"><Repeat size={14} />Recurring</span>
                <input
                  type="checkbox"
                  checked={recurringEnabled}
                  onChange={(e) => setRecurringEnabled(e.target.checked)}
                  className="h-4 w-4 accent-emerald-500"
                />
              </label>
            </div>
          )}

          {!isIncomeEntry && splitEnabled && (
            <div className="space-y-2 rounded-xl p-3 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/70 animate-fade-in">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Split Breakdown</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {splitTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {' / '}
                  {(Number.isFinite(amountValue) ? amountValue : 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              {splitRows.map((row) => (
                <div key={row.id} className="grid grid-cols-12 gap-2 items-center">
                  <select
                    value={row.category}
                    onChange={(e) => {
                      const next = e.target.value as Category;
                      setSplitRows((prev) => prev.map((entry) => (
                        entry.id === row.id ? { ...entry, category: next } : entry
                      )));
                    }}
                    className="col-span-4 px-2 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={row.subCategory}
                    onChange={(e) => {
                      setSplitRows((prev) => prev.map((entry) => (
                        entry.id === row.id ? { ...entry, subCategory: e.target.value } : entry
                      )));
                    }}
                    placeholder="Sub-cat"
                    className="col-span-4 px-2 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none"
                  />
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={row.amount}
                    onChange={(e) => {
                      setSplitRows((prev) => prev.map((entry) => (
                        entry.id === row.id ? { ...entry, amount: e.target.value } : entry
                      )));
                    }}
                    placeholder="0.00"
                    className="col-span-3 px-2 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none"
                  />
                  <button
                    type="button"
                    disabled={splitRows.length <= 2}
                    onClick={() => setSplitRows((prev) => prev.filter((entry) => entry.id !== row.id))}
                    className="col-span-1 p-1.5 text-zinc-400 hover:text-red-500 disabled:opacity-30"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setSplitRows((prev) => [...prev, createSplitDraft(category)])}
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
              >
                <Plus size={12} /> Add line
              </button>
            </div>
          )}

          {!isIncomeEntry && recurringEnabled && (
            <div className="space-y-3 rounded-xl p-3 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/70 animate-fade-in">
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Frequency</label>
                <select
                  value={recurringFrequency}
                  onChange={(e) => setRecurringFrequency(e.target.value as RecurringFrequency)}
                  className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none"
                >
                  {RECURRING_FREQUENCIES.map((freq) => (
                    <option key={freq} value={freq}>
                      {freq.charAt(0).toUpperCase() + freq.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">End Date (optional)</label>
                <input
                  type="date"
                  value={recurringEndDate}
                  min={date}
                  onChange={(e) => setRecurringEndDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none"
                />
              </div>
            </div>
          )}

          {!isIncomeEntry && (
            <>
              {/* Optional Fields Toggle */}
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
                <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm} value={pm}>{pm}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes for context"
                  rows={2}
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="e.g., work, reimbursable"
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Receipt Attachment</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAttachmentChange}
                  className="w-full mt-1 text-xs text-zinc-500 dark:text-zinc-400"
                />
                {attachmentName && (
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-2">
                    <span className="text-xs text-zinc-600 dark:text-zinc-300 truncate">{attachmentName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentBase64(undefined);
                        setAttachmentName('');
                      }}
                      className="text-xs text-red-500"
                    >
                      Remove
                    </button>
                  </div>
                )}
                {attachmentBase64 && (
                  <div className="relative mt-2 h-24 w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
                    <Image
                      src={attachmentBase64}
                      alt="Receipt preview"
                      fill
                      sizes="(max-width: 768px) 100vw, 448px"
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                )}
              </div>
                </div>
              )}
            </>
          )}

          </div>

          <div className="border-t border-zinc-100 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm px-6 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] sm:pb-4">
            <button
              type="submit"
              disabled={saving || !amount}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white font-bold text-lg rounded-2xl transition-colors shadow-lg shadow-emerald-500/25"
            >
              {saving ? 'Saving...' : isIncomeEntry ? 'Log Income' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
