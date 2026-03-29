'use client';

import Image from 'next/image';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronRight, Plus, Trash2, X } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import {
  CATEGORIES,
  PAYMENT_METHODS,
  RECURRING_FREQUENCIES,
  type Category,
  type PaymentMethod,
  type RecurringFrequency,
  type TransactionSplitInput,
  type Transaction,
} from '@/lib/types';
import {
  deleteTransaction as deleteLocalTransaction,
  getAccounts,
  updateTransaction as updateLocalTransaction,
} from '@/lib/local-store';

interface EditTransactionModalProps {
  transaction: Transaction | null;
  onClose: () => void;
  onUpdated: () => void;
}

interface SplitDraft {
  id: string;
  category: Category;
  subCategory: string;
  amount: string;
}

interface AccountOption {
  id: string;
  name: string;
  type: string;
  isArchived?: boolean;
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

function normalizeDecimalInput(value: string): string {
  const sanitized = value.replace(/[^0-9.]/g, '');
  const dotIndex = sanitized.indexOf('.');
  if (dotIndex === -1) return sanitized;
  return `${sanitized.slice(0, dotIndex + 1)}${sanitized.slice(dotIndex + 1).replace(/\./g, '')}`;
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
    id: crypto.randomUUID(),
    category: defaultCategory,
    subCategory: '',
    amount: '',
  };
}

export default function EditTransactionModal({
  transaction,
  onClose,
  onUpdated,
}: EditTransactionModalProps) {
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [autoFocusAmount, setAutoFocusAmount] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const isOpen = Boolean(transaction);

  const amountValue = Number.parseFloat(amount);
  const splitTotal = useMemo(
    () => splitRows.reduce((sum, row) => sum + (Number.parseFloat(row.amount) || 0), 0),
    [splitRows]
  );
  const splitTotalMatches = Math.abs(splitTotal - (Number.isFinite(amountValue) ? amountValue : 0)) <= 0.01;
  const showMoreOptions = showOptional;
  const requiresAccountSelection = accounts.length > 0;
  const fieldBaseClass = 'rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 text-base text-zinc-700 dark:text-zinc-300 placeholder-zinc-300 dark:placeholder-zinc-600 outline-none focus:border-[#1D9E75] sm:px-2.5 sm:text-xs';
  const singleLineFieldClass = `h-11 sm:h-8 ${fieldBaseClass}`;
  const compactFieldClass = 'h-11 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 text-base text-zinc-700 dark:text-zinc-300 outline-none focus:border-[#1D9E75] sm:h-7 sm:px-2 sm:text-[11px]';

  const EXPENSE_CATEGORY_ICONS: Record<string, string> = {
    Food: '🍜',
    Transportation: '🚌',
    Shopping: '🛍️',
    Health: '💊',
    Education: '📚',
    Utilities: '⚡',
    Entertainment: '🎮',
    Subscriptions: '📱',
    Miscellaneous: '✦',
  };

  const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
    Food: 'Food',
    Transportation: 'Transit',
    Shopping: 'Shopping',
    Health: 'Health',
    Education: 'Education',
    Utilities: 'Utilities',
    Entertainment: 'Entertain',
    Subscriptions: 'Subscript.',
    Miscellaneous: 'Misc',
  };

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
    if (!isOpen || !autoFocusAmount) return;
    amountInputRef.current?.focus();
  }, [isOpen, autoFocusAmount]);

  useEffect(() => {
    if (!isOpen) return;

    const syncViewportHeight = () => {
      const nextHeight = window.visualViewport?.height ?? window.innerHeight;
      setViewportHeight(Math.round(nextHeight));
    };

    syncViewportHeight();

    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', syncViewportHeight);
    viewport?.addEventListener('scroll', syncViewportHeight);
    window.addEventListener('resize', syncViewportHeight);

    return () => {
      viewport?.removeEventListener('resize', syncViewportHeight);
      viewport?.removeEventListener('scroll', syncViewportHeight);
      window.removeEventListener('resize', syncViewportHeight);
      setViewportHeight(null);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    const scrollY = window.scrollY;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyWidth = document.body.style.width;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overscrollBehavior = 'none';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.width = previousBodyWidth;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      window.scrollTo(0, scrollY);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!transaction) return;

    setAmount(transaction.amount.toString());
    setCategory(transaction.category);
    setSubCategory(transaction.subCategory || '');
    setDescription(transaction.description || '');
    setMerchant(transaction.merchant || '');
    setPaymentMethod(transaction.paymentMethod || 'Cash');
    setNotes(transaction.notes || '');
    setTagsInput((transaction.tags || []).join(', '));
    setAttachmentBase64(transaction.attachmentBase64);
    setAttachmentName(transaction.attachmentBase64 ? 'Attached receipt' : '');
    setDate(transaction.date ? transaction.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setSelectedAccountId(transaction.accountId || '');

    if (transaction.split && transaction.split.length > 0) {
      setSplitEnabled(true);
      setSplitRows(
        transaction.split.map((line) => ({
          id: line.id,
          category: line.category,
          subCategory: line.subCategory || '',
          amount: line.amount.toString(),
        }))
      );
    } else {
      setSplitEnabled(false);
      setSplitRows([]);
    }

    if (transaction.recurring) {
      setRecurringEnabled(true);
      setRecurringFrequency(transaction.recurring.frequency);
      setRecurringEndDate(
        transaction.recurring.endDate ? transaction.recurring.endDate.split('T')[0] : ''
      );
    } else {
      setRecurringEnabled(false);
      setRecurringFrequency('monthly');
      setRecurringEndDate('');
    }

    setShowOptional(false);
    setShowDeleteConfirm(false);
    setFormError(null);
  }, [transaction]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function fetchAccounts() {
      try {
        const json = (await getAccounts({ includeArchived: true })) as AccountOption[];
        if (cancelled) return;
        const nextAccounts = Array.isArray(json) ? json : [];
        setAccounts(nextAccounts);
        if (nextAccounts.length > 0) {
          setSelectedAccountId((prev) => prev || nextAccounts[0].id);
        }
      } catch {
        // Server can preserve linkage if account list cannot load.
      }
    }

    void fetchAccounts();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!transaction) return null;

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

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(normalizeDecimalInput(e.target.value));
  };

  const addSplitRow = () => {
    setSplitRows((prev) => [...prev, createSplitDraft(category)]);
  };

  const removeSplitRow = (id: string) => {
    setSplitRows((prev) => prev.filter((entry) => entry.id !== id));
  };

  const updateSplitRow = (id: string, field: 'category' | 'subCategory' | 'amount', value: string) => {
    setSplitRows((prev) => prev.map((entry) => {
      if (entry.id !== id) return entry;
      if (field === 'category') {
        return { ...entry, category: value as Category };
      }
      if (field === 'subCategory') {
        return { ...entry, subCategory: value };
      }
      return { ...entry, amount: normalizeDecimalInput(value) };
    }));
  };

  const handleDeleteConfirmed = async () => {
    if (!transaction) return;

    setSaving(true);
    setShowDeleteConfirm(false);
    setFormError(null);

    try {
      const deleted = await deleteLocalTransaction(transaction.id);
      if (!deleted) {
        setFormError('Failed to delete transaction.');
        return;
      }

      onUpdated();
      onClose();
    } catch {
      setFormError('Failed to delete transaction.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!amount || !Number.isFinite(amountValue) || amountValue <= 0) {
      setFormError('Amount must be greater than zero.');
      return;
    }

    if (requiresAccountSelection && !selectedAccountId) {
      setFormError('Select which account this expense should be deducted from.');
      return;
    }

    let normalizedSplit: TransactionSplitInput[] | undefined;
    if (splitEnabled) {
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
    try {
      const normalizedDate = new Date(date).toISOString();

      const updated = await updateLocalTransaction(transaction.id, {
        amount: Number(amountValue.toFixed(2)),
        category: normalizedSplit?.[0]?.category || category,
        subCategory: normalizedSplit?.[0]?.subCategory || (subCategory.trim() || ''),
        merchant,
        description,
        date: normalizedDate,
        paymentMethod,
        notes,
        tags: parseTags(tagsInput),
        attachmentBase64: attachmentBase64 || undefined,
        accountId: selectedAccountId || undefined,
        split: splitEnabled ? normalizedSplit : undefined,
        recurring: recurringEnabled
          ? {
              frequency: recurringFrequency,
              interval: 1,
              nextRunDate: transaction.recurring?.nextRunDate || new Date(normalizedDate).toISOString(),
              endDate: recurringEndDate ? new Date(recurringEndDate).toISOString() : undefined,
            }
          : undefined,
      });

      if (!updated) {
        setFormError('Failed to update transaction.');
        return;
      }

      onUpdated();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden overscroll-none sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex w-full justify-center overflow-hidden animate-slide-up"
        style={viewportHeight ? { height: `${viewportHeight}px`, maxHeight: `${viewportHeight}px` } : undefined}
      >
        <form
          onSubmit={handleSubmit}
          className="modal-shell modal-content-scroll flex w-full max-w-sm flex-col gap-2 overflow-y-auto rounded-3xl bg-zinc-100 p-3 dark:bg-zinc-900 sm:mx-auto"
          style={viewportHeight ? { maxHeight: `${viewportHeight}px` } : undefined}
        >
          <div className="flex items-center justify-between px-0.5 pt-0.5">
            <span id={titleId} className="text-sm font-medium text-zinc-700 dark:text-zinc-300 pl-1">Edit expense</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={saving}
                className="w-7 h-7 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close edit expense modal"
                className="w-7 h-7 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5 text-zinc-500" />
              </button>
            </div>
          </div>

          {formError && (
            <div className="px-3 py-2 rounded-2xl text-xs bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/30">
              {formError}
            </div>
          )}

          <div className="bg-[#1D9E75] rounded-2xl px-4 pt-3.5 pb-3">
            <p className="text-[10px] font-medium uppercase tracking-widest mb-1.5 text-white/55">Amount</p>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-medium text-white/65">₱</span>
              <input
                ref={amountInputRef}
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0.00"
                className="bg-transparent text-white text-4xl font-medium tracking-tight leading-none outline-none w-full placeholder-white/30"
              />
            </div>
            <p className="text-[10px] mt-1.5 text-white/40">
              {recurringEnabled ? 'Recurring expense' : splitEnabled ? 'Split across categories' : 'Edit amount'}
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 px-3.5 py-3 flex flex-col gap-2.5">
            <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Details</p>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-400">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Dinner with friends"
                className={singleLineFieldClass}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-400">Sub-category <span className="text-zinc-300">(optional)</span></label>
              <input
                type="text"
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                disabled={splitEnabled}
                placeholder={splitEnabled ? 'Managed via split lines' : 'e.g., Groceries'}
                className={`${singleLineFieldClass} disabled:opacity-60`}
              />
            </div>

            <div className="h-px bg-zinc-100 dark:bg-zinc-700 -mx-3.5" />

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-400">Merchant</label>
                <input
                  type="text"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="e.g., Jollibee"
                  className={singleLineFieldClass}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-400">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={singleLineFieldClass}
                />
              </div>
            </div>

            {(accounts.length > 0 || Boolean(selectedAccountId)) && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-400">Deduct from account</label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className={singleLineFieldClass}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.type}){account.isArchived ? ' - Archived' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-zinc-400">
                  Editing this changes which account balance is affected.
                </p>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 px-3.5 py-3">
            <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2.5">Category</p>
            <div className="grid grid-cols-5 gap-1.5">
              {CATEGORIES.map((cat) => {
                const isActive = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`rounded-[9px] border py-2 px-1 flex flex-col items-center gap-1 transition-colors ${
                      isActive
                        ? 'border-[#1D9E75] bg-[#E1F5EE] dark:bg-[#0F6E56]/20'
                        : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900'
                    }`}
                  >
                    <span className="text-sm leading-none">{EXPENSE_CATEGORY_ICONS[cat] ?? '•'}</span>
                    <span className={`text-[9px] font-medium text-center leading-tight ${
                      isActive ? 'text-[#0F6E56] dark:text-[#5DCAA5]' : 'text-zinc-400 dark:text-zinc-500'
                    }`}>
                      {EXPENSE_CATEGORY_LABELS[cat] ?? cat}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {recurringEnabled && (
            <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 px-3.5 py-3 flex flex-col gap-2.5 animate-fade-in">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Recurring schedule</p>
              <div className="grid grid-cols-4 gap-1.5">
                {RECURRING_FREQUENCIES.map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    onClick={() => setRecurringFrequency(freq)}
                    className={`h-7 rounded-full text-[11px] font-medium border transition-colors ${
                      recurringFrequency === freq
                        ? 'border-[#1D9E75] bg-[#E1F5EE] text-[#0F6E56] dark:bg-[#0F6E56]/20 dark:text-[#5DCAA5]'
                        : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-400'
                    }`}
                  >
                    {freq}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-400">End date <span className="text-zinc-300">(optional)</span></label>
                <input
                  type="date"
                  value={recurringEndDate}
                  min={date}
                  onChange={(e) => setRecurringEndDate(e.target.value)}
                  className={singleLineFieldClass}
                />
              </div>
            </div>
          )}

          {splitEnabled && (
            <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 px-3.5 py-3 flex flex-col gap-2.5 animate-fade-in">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Split transaction</p>

              {splitRows.map((row) => (
                <div key={row.id} className="flex flex-col gap-1.5">
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5 items-center">
                    <select
                      value={row.category}
                      onChange={(e) => updateSplitRow(row.id, 'category', e.target.value)}
                      className={compactFieldClass}
                    >
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.amount}
                      onChange={(e) => updateSplitRow(row.id, 'amount', e.target.value)}
                      placeholder="₱0.00"
                      className={compactFieldClass}
                    />
                    <button
                      type="button"
                      disabled={splitRows.length <= 2}
                      onClick={() => removeSplitRow(row.id)}
                      className="w-5 h-5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-zinc-400 text-[10px] disabled:opacity-40"
                    >
                      ✕
                    </button>
                  </div>
                  <input
                    type="text"
                    value={row.subCategory}
                    onChange={(e) => updateSplitRow(row.id, 'subCategory', e.target.value)}
                    placeholder="Sub-category"
                    className={compactFieldClass}
                  />
                </div>
              ))}

              <button
                type="button"
                onClick={addSplitRow}
                className="h-7 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 text-[11px] text-zinc-400 flex items-center justify-center gap-1"
              >
                <Plus size={11} /> Add row
              </button>

              <div className="flex justify-between items-center pt-1 border-t border-zinc-100 dark:border-zinc-700">
                <span className="text-[10px] text-zinc-400">Total split</span>
                <span className={`text-[11px] font-medium ${splitTotalMatches ? 'text-[#1D9E75]' : 'text-red-400'}`}>
                  ₱{splitTotal.toFixed(2)} / ₱{(Number.isFinite(amountValue) ? amountValue : 0).toFixed(2)} {splitTotalMatches ? '✓' : '✗'}
                </span>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowOptional((v) => !v)}
              className="w-full flex items-center justify-between px-3.5 py-2.5"
            >
              <span className="text-[11px] font-medium text-zinc-400">More options</span>
              <ChevronRight className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${showMoreOptions ? 'rotate-90' : ''}`} />
            </button>

            {showMoreOptions && (
              <div className="px-3.5 pb-3 flex flex-col gap-2.5 border-t border-zinc-100 dark:border-zinc-700 pt-2.5 animate-fade-in">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-400">Payment method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className={singleLineFieldClass}
                  >
                    {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-400">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add a note..."
                    rows={2}
                    className={`${fieldBaseClass} resize-none py-2.5`}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-400">Tags <span className="text-zinc-300">(comma separated)</span></label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="e.g., work, reimbursable"
                    className={singleLineFieldClass}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-400">Receipt attachment</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAttachmentChange}
                    className="w-full text-xs text-zinc-500 dark:text-zinc-400"
                  />
                  {attachmentName && (
                    <div className="mt-1 flex items-center justify-between rounded-lg bg-zinc-100 dark:bg-zinc-900 px-2.5 py-2">
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
                    <div className="relative mt-1 h-20 w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
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
          </div>

          <div className="flex items-center gap-1.5 px-0.5 pb-0.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.125rem)]">
            <button
              type="button"
              onClick={() => setRecurringEnabled((v) => !v)}
              className={`h-9 px-3 rounded-full border text-[11px] font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                recurringEnabled
                  ? 'border-[#1D9E75] bg-[#E1F5EE] text-[#1D9E75] dark:bg-[#0F6E56]/20 dark:text-[#5DCAA5]'
                  : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-400'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${recurringEnabled ? 'bg-[#1D9E75]' : 'bg-zinc-300'}`} />
              Recurring
            </button>

            <button
              type="button"
              onClick={() => {
                setSplitEnabled((v) => {
                  const next = !v;
                  if (next && splitRows.length < 2) {
                    setSplitRows([
                      createSplitDraft(category),
                      createSplitDraft('Miscellaneous'),
                    ]);
                  }
                  return next;
                });
              }}
              className={`h-9 px-3 rounded-full border text-[11px] font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                splitEnabled
                  ? 'border-[#1D9E75] bg-[#E1F5EE] text-[#1D9E75] dark:bg-[#0F6E56]/20 dark:text-[#5DCAA5]'
                  : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-400'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${splitEnabled ? 'bg-[#1D9E75]' : 'bg-zinc-300'}`} />
              Split
            </button>

            <button
              type="submit"
              disabled={saving}
              className={`flex-1 h-9 rounded-full text-xs font-medium text-white bg-[#1D9E75] transition-opacity ${saving ? 'opacity-60' : ''}`}
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>

      <ConfirmModal
        open={showDeleteConfirm}
        title="Delete transaction?"
        message="This action cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
