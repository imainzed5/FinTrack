'use client';

import Image from 'next/image';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChevronRight, Plus, Trash2, X } from 'lucide-react';
import {
  CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
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
  defaultCategory?: string;
  defaultAccountId?: string;
  defaultLinkedTransferGroupId?: string;
  defaultEntryType?: Extract<TransactionType, 'expense' | 'income'>;
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

const DEFAULT_CATEGORY_ALIASES: Record<string, Category> = {
  transport: 'Transportation',
  transportation: 'Transportation',
  school: 'Education',
  education: 'Education',
  bills: 'Utilities',
  utilities: 'Utilities',
  savings: 'Miscellaneous',
  other: 'Miscellaneous',
  misc: 'Miscellaneous',
  miscellaneous: 'Miscellaneous',
};

function resolveDefaultCategory(defaultCategory?: string): Category {
  if (!defaultCategory) {
    return 'Food';
  }

  const normalized = defaultCategory.trim().toLowerCase();
  const directMatch = CATEGORIES.find((cat) => cat.toLowerCase() === normalized);
  if (directMatch) {
    return directMatch;
  }

  return DEFAULT_CATEGORY_ALIASES[normalized] ?? 'Food';
}

export default function AddExpenseModal({
  open,
  onClose,
  onAdded,
  defaultCategory,
  defaultAccountId,
  defaultLinkedTransferGroupId,
  defaultEntryType = 'expense',
}: AddExpenseModalProps) {
  const [entryType, setEntryType] = useState<TransactionType>(defaultEntryType);
  const [incomeCategory, setIncomeCategory] = useState<IncomeCategory>('Freelance');
  const [incomeRecurringMonthly, setIncomeRecurringMonthly] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>(() => resolveDefaultCategory(defaultCategory));
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
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [autoFocusAmount, setAutoFocusAmount] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const isIncomeEntry = entryType === 'income';

  const amountValue = Number.parseFloat(amount);
  const splitTotal = useMemo(
    () => splitRows.reduce((sum, row) => sum + (Number.parseFloat(row.amount) || 0), 0),
    [splitRows]
  );
  const splitTotalMatches = Math.abs(splitTotal - (Number.isFinite(amountValue) ? amountValue : 0)) <= 0.01;
  const showMoreOptions = showOptional;
  const isRecurring = isIncomeEntry ? incomeRecurringMonthly : recurringEnabled;
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

  const INCOME_CATEGORY_ICONS: Record<string, string> = {
    Freelance: '💻',
    Salary: '🏢',
    'Side Job': '🔧',
    'Part-time': '⏰',
    Bonus: '🎁',
    Refund: '↩️',
    Gift: '🤝',
    'Other Income': '✦',
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

  const INCOME_CATEGORY_LABELS: Record<string, string> = {
    Freelance: 'Freelance',
    Salary: 'Salary',
    'Side Job': 'Side Job',
    'Part-time': 'Part-time',
    Bonus: 'Bonus',
    Refund: 'Refund',
    Gift: 'Gift',
    'Other Income': 'Other',
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
    if (!open || !autoFocusAmount) return;
    amountInputRef.current?.focus();
  }, [open, autoFocusAmount]);

  useEffect(() => {
    if (!open) return;

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
  }, [open]);

  useEffect(() => {
    if (defaultCategory) {
      setCategory(resolveDefaultCategory(defaultCategory));
    }
  }, [defaultCategory]);

  useEffect(() => {
    if (!open) return;

    setEntryType(defaultEntryType);
    setCategory(resolveDefaultCategory(defaultCategory));
    setSelectedAccountId(defaultAccountId ?? '');
  }, [defaultAccountId, defaultCategory, defaultEntryType, open]);

  useEffect(() => {
    if (entryType !== 'income') {
      return;
    }

    if (splitEnabled) {
      setSplitEnabled(false);
      setSplitRows([]);
    }

    if (recurringFrequency !== 'monthly') {
      setRecurringFrequency('monthly');
    }
  }, [entryType, recurringFrequency, splitEnabled]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function fetchAccounts() {
      try {
        const res = await fetch('/api/accounts', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as AccountOption[];
        const nextAccounts = Array.isArray(json) ? json : [];
        if (cancelled) return;

        setAccounts(nextAccounts);
        setSelectedAccountId((prev) => {
          if (defaultAccountId && nextAccounts.some((account) => account.id === defaultAccountId)) {
            return defaultAccountId;
          }
          if (prev && nextAccounts.some((account) => account.id === prev)) {
            return prev;
          }
          return nextAccounts[0]?.id ?? '';
        });
      } catch {
        // Fallback to server-side default account resolution.
      }
    }

    void fetchAccounts();
    return () => {
      cancelled = true;
    };
  }, [defaultAccountId, open]);

  useEffect(() => {
    if (!open) return;

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
  }, [open, onClose]);

  if (!open) return null;

  const resetForm = () => {
    setEntryType(defaultEntryType);
    setIncomeCategory('Freelance');
    setIncomeRecurringMonthly(false);
    setAmount('');
    setCategory(resolveDefaultCategory(defaultCategory));
    setSubCategory('');
    setDescription('');
    setMerchant('');
    setPaymentMethod('Bank Transfer');
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
    setSelectedAccountId(defaultAccountId ?? '');
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

    if (requiresAccountSelection && !selectedAccountId) {
      setFormError(
        isIncomeEntry
          ? 'Select which account will receive this income.'
          : 'Select which account this expense should be deducted from.'
      );
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
      accountId: selectedAccountId || undefined,
      linkedTransferGroupId: isIncomeEntry ? undefined : defaultLinkedTransferGroupId,
      incomeCategory: isIncomeEntry ? incomeCategory : undefined,
      category: resolvedCategory,
      subCategory: isIncomeEntry
        ? undefined
        : (normalizedSplit?.[0]?.subCategory || (subCategory.trim() || undefined)),
      merchant: merchant.trim() || undefined,
      description: descriptionValue,
      date: normalizedDate,
      paymentMethod: paymentMethod,
      notes: notes.trim() || undefined,
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
        accountId: selectedAccountId || undefined,
        linkedTransferGroupId: input.linkedTransferGroupId,
        incomeCategory: isIncomeEntry ? incomeCategory : undefined,
        category: input.category,
        subCategory: input.subCategory,
        merchant: input.merchant,
        description: input.description,
        date: normalizedDate,
        paymentMethod: input.paymentMethod || 'Bank Transfer',
        notes: input.notes || '',
        tags: isIncomeEntry ? [] : (input.tags || []),
        attachmentBase64: isIncomeEntry ? undefined : input.attachmentBase64,
        metadata: input.metadata,
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

  const setRecurringFrequencyLabel = (value: 'Daily' | 'Weekly' | 'Monthly' | 'Yearly') => {
    setRecurringFrequency(value.toLowerCase() as RecurringFrequency);
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
            <p id={titleId} className="sr-only">{isIncomeEntry ? 'Log Income' : 'Add Expense'}</p>

            <div className="flex bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full p-1 gap-0.5">
              <button
                type="button"
                onClick={() => setEntryType('expense')}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  entryType === 'expense'
                    ? 'bg-[#1D9E75] text-white'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => setEntryType('income')}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  entryType === 'income'
                    ? 'bg-[#085041] text-[#9FE1CB]'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                Income
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={isIncomeEntry ? 'Close log income modal' : 'Close add expense modal'}
              className="w-7 h-7 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5 text-zinc-500" />
            </button>
          </div>

          {formError && (
            <div className="px-3 py-2 rounded-2xl text-xs bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/30">
              {formError}
            </div>
          )}

          <div className={`rounded-2xl px-4 pt-3.5 pb-3 ${entryType === 'expense' ? 'bg-[#1D9E75]' : 'bg-[#085041]'}`}>
            <p className={`text-[10px] font-medium uppercase tracking-widest mb-1.5 ${
              entryType === 'expense' ? 'text-white/55' : 'text-[#5DCAA5]'
            }`}>
              {entryType === 'expense' ? 'Amount' : 'Amount received'}
            </p>
            <div className="flex items-baseline gap-1">
              <span className={`text-lg font-medium ${entryType === 'expense' ? 'text-white/65' : 'text-[#5DCAA5]'}`}>₱</span>
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
            <p className={`text-[10px] mt-1.5 ${entryType === 'expense' ? 'text-white/40' : 'text-[#5DCAA5]/60'}`}>
              {isRecurring
                ? `Recurring ${isIncomeEntry ? 'monthly' : recurringFrequency}`
                : splitEnabled
                ? 'Split across categories'
                : 'Tap to enter amount'}
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 px-3.5 py-3 flex flex-col gap-2.5">
            <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Details</p>

            {accounts.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-400">
                  {isIncomeEntry ? 'Receive into account' : 'Deduct from account'}
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className={singleLineFieldClass}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.type})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-zinc-400">
                  {isIncomeEntry
                    ? 'Income will increase this account balance.'
                    : 'Expense will reduce this account balance.'}
                </p>
              </div>
            )}

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

            {!isIncomeEntry && (
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
            )}

            <div className="h-px bg-zinc-100 dark:bg-zinc-700 -mx-3.5" />

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-400">
                  {isIncomeEntry ? 'Received via' : 'Merchant'}
                </label>
                <input
                  type="text"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder={isIncomeEntry ? 'e.g., GCash' : 'e.g., Jollibee'}
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
          </div>

          <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 px-3.5 py-3">
            <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2.5">
              {isIncomeEntry ? 'Income type' : 'Category'}
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {(isIncomeEntry ? INCOME_CATEGORIES : CATEGORIES).map((cat) => {
                const iconMap = isIncomeEntry ? INCOME_CATEGORY_ICONS : EXPENSE_CATEGORY_ICONS;
                const labelMap = isIncomeEntry ? INCOME_CATEGORY_LABELS : EXPENSE_CATEGORY_LABELS;
                const activeVal = isIncomeEntry ? incomeCategory : category;
                const isActive = activeVal === cat;
                const activeExpenseCls = 'border-[#1D9E75] bg-[#E1F5EE] dark:bg-[#0F6E56]/20';
                const activeIncomeCls = 'border-[#085041] bg-[#E1F5EE] dark:bg-[#085041]/20';
                const activeCls = isIncomeEntry ? activeIncomeCls : activeExpenseCls;

                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      if (isIncomeEntry) {
                        setIncomeCategory(cat as IncomeCategory);
                      } else {
                        setCategory(cat as Category);
                      }
                    }}
                    className={`rounded-[9px] border py-2 px-1 flex flex-col items-center gap-1 transition-colors ${
                      isActive
                        ? activeCls
                        : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900'
                    }`}
                  >
                    <span className="text-sm leading-none">{iconMap[cat] ?? '•'}</span>
                    <span className={`text-[9px] font-medium text-center leading-tight ${
                      isActive
                        ? (isIncomeEntry ? 'text-[#085041] dark:text-[#5DCAA5]' : 'text-[#0F6E56]')
                        : 'text-zinc-400 dark:text-zinc-500'
                    }`}>
                      {labelMap[cat] ?? cat}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {isRecurring && (
            <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 px-3.5 py-3 flex flex-col gap-2.5 animate-fade-in">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Recurring schedule
              </p>

              {!isIncomeEntry ? (
                <>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['Daily', 'Weekly', 'Monthly', 'Yearly'] as const).map((freq) => (
                      <button
                        key={freq}
                        type="button"
                        onClick={() => setRecurringFrequencyLabel(freq)}
                        className={`h-7 rounded-full text-[11px] font-medium border transition-colors ${
                          recurringFrequency === freq.toLowerCase()
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
                </>
              ) : (
                <div className="flex gap-1.5">
                  {(['One-time', 'Monthly'] as const).map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => setIncomeRecurringMonthly(freq === 'Monthly')}
                      className={`flex-1 h-7 rounded-full text-[11px] font-medium border transition-colors ${
                        (incomeRecurringMonthly && freq === 'Monthly') || (!incomeRecurringMonthly && freq === 'One-time')
                          ? 'border-[#085041] bg-[#E1F5EE] text-[#085041] dark:bg-[#085041]/20 dark:text-[#5DCAA5]'
                          : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-400'
                      }`}
                    >
                      {freq}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!isIncomeEntry && splitEnabled && (
            <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 px-3.5 py-3 flex flex-col gap-2.5 animate-fade-in">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Split transaction
              </p>

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
                      <Trash2 size={10} />
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

                {!isIncomeEntry && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-zinc-400">Tags (comma-separated)</label>
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
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 px-0.5 pb-0.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.125rem)]">
            <button
              type="button"
              onClick={() => {
                if (isIncomeEntry) {
                  setIncomeRecurringMonthly((v) => !v);
                  return;
                }
                setRecurringEnabled((v) => !v);
              }}
              className={`h-9 px-3 rounded-full border text-[11px] font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                isRecurring
                  ? 'border-[#1D9E75] bg-[#E1F5EE] text-[#1D9E75] dark:bg-[#0F6E56]/20 dark:text-[#5DCAA5]'
                  : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-400'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isRecurring ? 'bg-[#1D9E75]' : 'bg-zinc-300'}`} />
              Recurring
            </button>

            {!isIncomeEntry && (
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
            )}

            <button
              type="submit"
              disabled={saving || !amount}
              className={`flex-1 h-9 rounded-full text-xs font-medium text-white transition-opacity ${
                saving ? 'opacity-60' : ''
              } ${entryType === 'expense' ? 'bg-[#1D9E75]' : 'bg-[#085041]'}`}
            >
              {saving ? 'Saving...' : isIncomeEntry ? 'Save income' : 'Save expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
