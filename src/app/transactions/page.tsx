'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { format, parseISO, subMonths } from 'date-fns';
import { Search, Filter, Download, X, Wallet, SearchX } from 'lucide-react';
import type { Transaction, Category, PaymentMethod } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { CATEGORIES } from '@/lib/types';
import TransactionList from '@/components/TransactionList';
import TimelineView from '@/components/TimelineView';
import FloatingAddButton from '@/components/FloatingAddButton';
import AddExpenseModal from '@/components/AddExpenseModal';
import EditTransactionModal from '@/components/EditTransactionModal';
import FilterDrawer from '@/components/FilterDrawer';
import { subscribeAppUpdates, subscribeTransactionUpdates } from '@/lib/transaction-ws';
import { TransactionsSkeleton } from '@/components/SkeletonLoaders';
import EmptyState from '@/components/EmptyState';
import type { TimelineEvent } from '@/lib/types';

const CATEGORY_FILTERS_STORAGE_KEY = 'transactions:selected-categories';
const PAYMENT_METHOD_FILTER_STORAGE_KEY = 'transactions:selected-payment-method';
type CategoryFilter = Category | 'Income' | 'Savings';
type PaymentMethodFilter = 'All methods' | 'Cash' | 'GCash' | 'Card' | 'Bank Transfer';
const CATEGORY_FILTER_OPTIONS: CategoryFilter[] = [...CATEGORIES, 'Income', 'Savings'];
const PAYMENT_FILTER_OPTIONS: PaymentMethodFilter[] = [
  'All methods',
  'Cash',
  'GCash',
  'Card',
  'Bank Transfer',
];

const CATEGORY_DOT_COLORS: Record<string, string> = {
  Food: '#D85A30',
  Transportation: '#378ADD',
  Health: '#1D9E75',
  Subscriptions: '#7F77DD',
  Shopping: '#D4537E',
  Entertainment: '#BA7517',
  Utilities: '#378ADD',
};

const pesoDecimalFormatter = new Intl.NumberFormat('en-PH', {
  style: 'decimal',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatPesoDecimal(value: number): string {
  return `P${pesoDecimalFormatter.format(value)}`;
}

function isValidMonth(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value);
}

function matchesPaymentMethodFilter(
  txPaymentMethod: PaymentMethod,
  selectedPaymentMethod: PaymentMethodFilter
): boolean {
  if (selectedPaymentMethod === 'All methods') return true;
  if (selectedPaymentMethod === 'Card') {
    return txPaymentMethod === 'Credit Card' || txPaymentMethod === 'Debit Card';
  }

  return txPaymentMethod === selectedPaymentMethod;
}

function isCategoryFilter(value: string): value is CategoryFilter {
  return value === 'Income' || value === 'Savings' || CATEGORIES.includes(value as Category);
}

export default function TransactionsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentMonthKey = format(new Date(), 'yyyy-MM');
  const monthParam = searchParams.get('month');
  const selectedDayParam = searchParams.get('selectedDay');
  const selectedDayFilter = selectedDayParam && /^\d{4}-\d{2}-\d{2}$/.test(selectedDayParam)
    ? selectedDayParam
    : null;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalTransactionCount, setTotalTransactionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (monthParam && isValidMonth(monthParam)) {
      return monthParam;
    }
    return currentMonthKey;
  });
  const [selectedCategories, setSelectedCategories] = useState<CategoryFilter[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const stored = window.sessionStorage.getItem(CATEGORY_FILTERS_STORAGE_KEY);
      if (!stored) {
        return [];
      }

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return [];
      }

      const categories = parsed.filter(
        (value): value is CategoryFilter => typeof value === 'string' && isCategoryFilter(value)
      );

      return Array.from(new Set(categories));
    } catch {
      return [];
    }
  });
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodFilter>(() => {
    if (typeof window === 'undefined') {
      return 'All methods';
    }

    const stored = window.sessionStorage.getItem(PAYMENT_METHOD_FILTER_STORAGE_KEY);
    if (!stored) {
      return 'All methods';
    }

    if (PAYMENT_FILTER_OPTIONS.includes(stored as PaymentMethodFilter)) {
      return stored as PaymentMethodFilter;
    }

    return 'All methods';
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isFabVisible, setIsFabVisible] = useState(true);
  const [activeView, setActiveView] = useState<'list' | 'timeline'>('list');
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const paginationRef = useRef<HTMLDivElement>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set('month', selectedMonth);
      if (selectedCategories.length > 0) {
        params.set('categories', selectedCategories.join(','));
      }
      if (selectedPaymentMethod !== 'All methods') {
        params.set('paymentMethod', selectedPaymentMethod);
      }
      const query = params.toString();
      const endpoint = query ? `/api/transactions?${query}` : '/api/transactions';
      const [res, totalRes] = await Promise.all([
        fetch(endpoint),
        query ? fetch('/api/transactions') : Promise.resolve<Response | null>(null),
      ]);

      if (!res.ok || (totalRes && !totalRes.ok)) {
        throw new Error('Failed to fetch transactions');
      }

      const [json, totalJson] = await Promise.all([
        res.json() as Promise<Transaction[]>,
        totalRes ? (totalRes.json() as Promise<Transaction[]>) : Promise.resolve<Transaction[] | null>(null),
      ]);

      const nextTransactions = Array.isArray(json) ? json : [];
      setTransactions(nextTransactions);
      setTotalTransactionCount(
        totalJson && Array.isArray(totalJson)
          ? totalJson.length
          : nextTransactions.length
      );
    } catch {
      // offline
    } finally {
      setLoading(false);
    }
  }, [selectedCategories, selectedMonth, selectedPaymentMethod]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (selectedCategories.length === 0) {
      window.sessionStorage.removeItem(CATEGORY_FILTERS_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(CATEGORY_FILTERS_STORAGE_KEY, JSON.stringify(selectedCategories));
  }, [selectedCategories]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (selectedPaymentMethod === 'All methods') {
      window.sessionStorage.removeItem(PAYMENT_METHOD_FILTER_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(PAYMENT_METHOD_FILTER_STORAGE_KEY, selectedPaymentMethod);
  }, [selectedPaymentMethod]);

  useEffect(() => {
    if (monthParam && isValidMonth(monthParam)) {
      setSelectedMonth(monthParam);
    }
  }, [monthParam]);

  useEffect(() => {
    const unsubscribe = subscribeTransactionUpdates(() => {
      void fetchTransactions();
    });

    return unsubscribe;
  }, [fetchTransactions]);

  const fetchTimeline = useCallback(async () => {
    setTimelineLoading(true);

    try {
      const res = await fetch('/api/timeline');
      const json = await res.json();
      setTimelineEvents(Array.isArray(json) ? json : []);
    } catch {
      // offline
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTimeline();
  }, [fetchTimeline]);

  useEffect(() => {
    const unsubscribe = subscribeAppUpdates(() => {
      void fetchTimeline();
    });

    return unsubscribe;
  }, [fetchTimeline]);

  const requestDeleteConfirmation = (id: string) => {
    setPendingDeleteId(id);
  };

  const closeDeleteConfirmation = () => {
    if (isDeleting) return;
    setPendingDeleteId(null);
  };

  const handleDeleteConfirmed = async () => {
    if (!pendingDeleteId) return;

    setIsDeleting(true);

    try {
      const res = await fetch(`/api/transactions?id=${encodeURIComponent(pendingDeleteId)}`, { method: 'DELETE' });

      if (!res.ok) {
        return;
      }

      setPendingDeleteId(null);
      void fetchTransactions();
    } catch {
      // offline
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Date',
      'Category',
      'Sub-category',
      'Amount',
      'Merchant',
      'Description',
      'Payment Method',
      'Notes',
      'Tags',
      'Recurring',
      'Split Lines',
      'Has Receipt',
    ];
    const rows = filtered.map((tx) => [
      format(parseISO(tx.date), 'yyyy-MM-dd'),
      tx.type === 'income' ? 'Income' : tx.category,
      tx.type === 'income' ? (tx.incomeCategory || '') : (tx.subCategory || ''),
      tx.amount.toFixed(2),
      tx.merchant || '',
      tx.description || '',
      tx.paymentMethod,
      tx.notes || '',
      (tx.tags || []).join('|'),
      tx.recurring ? tx.recurring.frequency : '',
      tx.split ? tx.split.length.toString() : '0',
      tx.attachmentBase64 ? 'yes' : 'no',
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const rows = filtered
      .map(
        (tx) =>
          `<tr>
            <td>${format(parseISO(tx.date), 'MMM d, yyyy')}</td>
            <td>${tx.type === 'income' ? 'Income' : tx.category}</td>
            <td>${tx.type === 'income' ? (tx.incomeCategory || '') : (tx.subCategory || '')}</td>
            <td style="text-align:right">₱${tx.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td>${tx.merchant || ''}</td>
            <td>${tx.description || ''}</td>
            <td>${tx.paymentMethod}</td>
            <td>${tx.notes || ''}</td>
          </tr>`
      )
      .join('');
    const total = filtered.reduce((s, tx) => s + tx.amount, 0);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Transactions</title>
      <style>
        body { font-family: sans-serif; padding: 24px; color: #111; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        p { font-size: 13px; color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { background: #10b981; color: #fff; padding: 8px 10px; text-align: left; }
        td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
        tr:nth-child(even) td { background: #f9fafb; }
        tfoot td { font-weight: bold; border-top: 2px solid #10b981; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>Expense Tracker — Transactions</h1>
      <p>Exported on ${format(new Date(), 'MMMM d, yyyy')} · ${filtered.length} transactions</p>
      <table>
        <thead><tr><th>Date</th><th>Category</th><th>Sub-cat</th><th>Amount</th><th>Merchant</th><th>Description</th><th>Payment</th><th>Notes</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="3">Total</td><td style="text-align:right">₱${total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td colspan="4"></td></tr></tfoot>
      </table>
      <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script>
      </body></html>`;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  const clearSelectedCategories = () => {
    setSelectedCategories([]);
    setPage(1);
  };

  const toggleCategory = (category: CategoryFilter) => {
    setSelectedCategories((current) => {
      if (current.includes(category)) {
        return current.filter((existing) => existing !== category);
      }
      return [...current, category];
    });
    setPage(1);
  };

  const removeCategory = (category: CategoryFilter) => {
    setSelectedCategories((current) => current.filter((existing) => existing !== category));
    setPage(1);
  };

  const handlePaymentMethodChange = (method: PaymentMethodFilter) => {
    setSelectedPaymentMethod(method);
    setPage(1);
  };

  const handleMonthChange = (nextMonth: string) => {
    if (!isValidMonth(nextMonth)) {
      return;
    }

    setSelectedMonth(nextMonth);
    setPage(1);

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('month', nextMonth);
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  const clearSelectedDayFilter = useCallback(() => {
    if (!selectedDayFilter) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('selectedDay');

    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
    setPage(1);
  }, [pathname, router, searchParams, selectedDayFilter]);

  const selectedDayFilterLabel = useMemo(() => {
    if (!selectedDayFilter) {
      return null;
    }

    const parsed = parseISO(selectedDayFilter);
    if (Number.isNaN(parsed.getTime())) {
      return selectedDayFilter;
    }

    return format(parsed, 'MMM d, yyyy');
  }, [selectedDayFilter]);

  const monthOptions = useMemo(
    () => Array.from({ length: 6 }, (_, index) => {
      const date = subMonths(new Date(), index);
      return {
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy'),
      };
    }),
    []
  );

  const monthScopedTransactions = transactions.filter((tx) => tx.date.startsWith(selectedMonth));

  const searchableTransactions = monthScopedTransactions.filter((tx) => {
    if (selectedDayFilter && tx.date.split('T')[0] !== selectedDayFilter) {
      return false;
    }

    if (!matchesPaymentMethodFilter(tx.paymentMethod, selectedPaymentMethod)) {
      return false;
    }

    if (search) {
      const q = search.toLowerCase();
      return (
        (tx.description || '').toLowerCase().includes(q) ||
        (tx.merchant || '').toLowerCase().includes(q) ||
        (tx.notes || '').toLowerCase().includes(q) ||
        (tx.incomeCategory || '').toLowerCase().includes(q) ||
        (tx.savingsMeta?.goalName || '').toLowerCase().includes(q) ||
        tx.type.toLowerCase().includes(q) ||
        (tx.subCategory || '').toLowerCase().includes(q) ||
        (tx.tags || []).some((tag) => tag.toLowerCase().includes(q)) ||
        tx.category.toLowerCase().includes(q) ||
        tx.amount.toString().includes(q)
      );
    }

    return true;
  });

  const filtered = searchableTransactions.filter((tx) => {

    const matchesCategory =
      selectedCategories.length === 0 ||
      selectedCategories.some((filter) => {
        if (filter === 'Income') return tx.type === 'income';
        if (filter === 'Savings') return tx.type === 'savings';
        return tx.category === filter;
      });

    if (!matchesCategory) {
      return false;
    }

    return true;
  });

  const filteredExpenseTransactions = filtered.filter((tx) => tx.type === 'expense');
  const totalSpent = filteredExpenseTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  const trackedDays = new Set(filteredExpenseTransactions.map((tx) => tx.date.split('T')[0]));
  const daysTracked = trackedDays.size;
  const avgPerDay = daysTracked > 0 ? totalSpent / daysTracked : 0;
  const biggestSpendTx = filteredExpenseTransactions.reduce<Transaction | null>((maxTx, tx) => {
    if (!maxTx || tx.amount > maxTx.amount) {
      return tx;
    }
    return maxTx;
  }, null);

  const categoryBreakdown = useMemo(() => {
    const totals = new Map<string, number>();

    searchableTransactions.forEach((tx) => {
      const next = (totals.get(tx.category) ?? 0) + tx.amount;
      totals.set(tx.category, next);
    });

    return Array.from(totals.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        color: CATEGORY_DOT_COLORS[category] ?? '#888780',
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [searchableTransactions]);

  const highestCategoryTotal = categoryBreakdown[0]?.amount ?? 0;

  const topCategories = useMemo(() => {
    const counts = new Map<string, number>();

    filteredExpenseTransactions.forEach((tx) => {
      counts.set(tx.category, (counts.get(tx.category) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([category]) => category);
  }, [filteredExpenseTransactions]);

  const totalAmount = filtered.reduce((sum, tx) => sum + tx.amount, 0);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const activeFilterCount =
    selectedCategories.length +
    (selectedDayFilter ? 1 : 0) +
    (selectedPaymentMethod !== 'All methods' ? 1 : 0);
  const hasCategoryOrPaymentFilter =
    selectedCategories.length > 0 || selectedPaymentMethod !== 'All methods';
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasNoTransactions = !loading && totalTransactionCount === 0;
  const hasNoMatches = !loading && totalTransactionCount > 0 && filtered.length === 0;

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages));
  }, [totalPages]);

  useEffect(() => {
    const el = paginationRef.current;
    if (!el) {
      setIsFabVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsFabVisible(!entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [totalPages, loading, hasNoTransactions, hasNoMatches]);

  useEffect(() => {
    if (!pendingDeleteId || isDeleting) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPendingDeleteId(null);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [pendingDeleteId, isDeleting]);

  const clearSearchAndFilters = () => {
    setSearch('');
    setSelectedCategories([]);
    setSelectedPaymentMethod('All methods');
    clearSelectedDayFilter();
    setPage(1);
  };

  const openAddTransactionModal = () => {
    setShowAddModal(true);
  };

  const pendingDeleteTransaction = transactions.find((tx) => tx.id === pendingDeleteId) ?? null;
  const pendingDeleteLabel = pendingDeleteTransaction
    ? pendingDeleteTransaction.merchant ||
      pendingDeleteTransaction.description ||
      pendingDeleteTransaction.category
    : '';

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pb-6 pt-4 sm:px-6">
        <div className="sticky top-2 z-30 -mx-4 bg-white/95 px-4 pb-3 backdrop-blur supports-[backdrop-filter]:bg-white/90 dark:bg-zinc-950/95 dark:supports-[backdrop-filter]:bg-zinc-950/90 sm:mx-0 sm:px-0">
          <div className="rounded-2xl border border-zinc-200 bg-white/95 p-4 dark:border-zinc-800 dark:bg-zinc-900/95">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-white">Transactions</h1>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                  {filtered.length} transactions
                </p>
              </div>

              <p className="font-display text-3xl font-bold leading-none text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalAmount)}
              </p>
            </div>

            <div className="mt-2 flex items-center justify-between md:hidden">
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Page {page} of {totalPages} · Swipe right to edit, swipe left to delete
              </p>
              <button
                type="button"
                onClick={() => setShowFilterDrawer(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:border-[#1D9E75] hover:text-[#1D9E75] dark:border-zinc-700 dark:text-zinc-400"
              >
                <Filter size={12} />
                Filters
                {hasCategoryOrPaymentFilter && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1D9E75]" />
                )}
              </button>
            </div>

            <p className="mt-2 hidden text-[11px] font-medium text-zinc-500 dark:text-zinc-400 md:block">
              {totalPages > 1 ? `Page ${page} of ${totalPages}` : 'All results in one page'}
              {' · '}
              Swipe right to edit, swipe left to delete
            </p>

            <div className="mt-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-6">
                <button
                  type="button"
                  onClick={() => setActiveView('list')}
                  className={`border-b-2 pb-2 text-sm font-semibold transition-colors ${
                    activeView === 'list'
                      ? 'border-[#1D9E75] text-zinc-900 dark:text-white'
                      : 'border-transparent text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  List
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('timeline')}
                  className={`border-b-2 pb-2 text-sm font-semibold transition-colors ${
                    activeView === 'timeline'
                      ? 'border-[#1D9E75] text-zinc-900 dark:text-white'
                      : 'border-transparent text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  Timeline
                </button>
              </div>
            </div>
          </div>
        </div>

        {activeView === 'list' ? (
          <>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800">
                <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">Total spent</p>
                <p className="font-display text-lg font-bold text-zinc-900 dark:text-white">{formatPesoDecimal(totalSpent)}</p>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">{filteredExpenseTransactions.length} transactions</p>
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800">
                <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">Avg / day</p>
                <p className="font-display text-lg font-bold text-zinc-900 dark:text-white">{formatPesoDecimal(avgPerDay)}</p>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">{daysTracked} days tracked</p>
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800">
                <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">Biggest spend</p>
                <p className="font-display text-lg font-bold text-zinc-900 dark:text-white">
                  {formatPesoDecimal(biggestSpendTx?.amount ?? 0)}
                </p>
                <p className="text-[10px] text-[#1D9E75] mt-0.5">
                  {biggestSpendTx
                    ? `${biggestSpendTx.merchant || biggestSpendTx.description || biggestSpendTx.paymentMethod} · ${format(parseISO(biggestSpendTx.date), 'MMM d')}`
                    : 'No spend yet'}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-row items-start gap-6">
              <aside className="hidden md:flex md:w-64 shrink-0 flex-col gap-5">
                <div>
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.08em]">By category</p>
                  <div className="mt-3 space-y-2.5">
                    {categoryBreakdown.map((entry) => {
                      const checked = selectedCategories.includes(entry.category as CategoryFilter);
                      const width = highestCategoryTotal > 0 ? (entry.amount / highestCategoryTotal) * 100 : 0;

                      return (
                        <button
                          key={entry.category}
                          type="button"
                          onClick={() => toggleCategory(entry.category as CategoryFilter)}
                          className={`w-full text-left transition-colors ${checked ? 'bg-zinc-100 dark:bg-zinc-800 rounded-lg' : ''}`}
                        >
                          <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                              <span className="text-sm text-zinc-700 dark:text-zinc-300 flex-1">{entry.category}</span>
                            </span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 min-w-[40px] text-right">{formatPesoDecimal(entry.amount)}</span>
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
                </div>

                <div>
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.08em]">Payment method</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {PAYMENT_FILTER_OPTIONS.map((method) => {
                      const checked = selectedPaymentMethod === method;
                      return (
                        <button
                          key={method}
                          type="button"
                          onClick={() => handlePaymentMethodChange(method)}
                          className={checked
                            ? 'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors border-[#1D9E75] bg-[#1D9E75]/10 text-[#1D9E75]'
                            : 'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-[#1D9E75]'}
                        >
                          {method}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.08em]">Month</p>
                  <select
                    value={selectedMonth}
                    onChange={(event) => handleMonthChange(event.target.value)}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-700 dark:text-zinc-300 px-3 py-2"
                  >
                    {monthOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1" />

                <div>
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.08em]">Export</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={handleExportCSV}
                      className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:border-[#1D9E75] hover:text-[#1D9E75] transition-colors"
                    >
                      CSV
                    </button>
                    <button
                      onClick={handleExportPDF}
                      className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:border-[#1D9E75] hover:text-[#1D9E75] transition-colors"
                    >
                      PDF
                    </button>
                  </div>
                </div>
              </aside>

              <div className="min-w-0 flex-1">
                <div className="mb-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setPage(1);
                        }}
                        placeholder="Search by merchant, amount, note, or tag"
                        className="h-12 w-full rounded-xl border border-zinc-200 bg-white pl-11 pr-4 text-sm text-zinc-900 outline-none transition-colors focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                      />
                    </div>

                  </div>

                  <div className="md:hidden">
                    <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                      <button
                        type="button"
                        onClick={clearSelectedCategories}
                        className={`min-h-10 shrink-0 rounded-full px-3.5 text-xs font-semibold transition-colors ${
                          selectedCategories.length === 0
                            ? 'bg-emerald-500 text-white'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                        }`}
                      >
                        All categories
                      </button>

                      {CATEGORY_FILTER_OPTIONS.map((category) => {
                        const checked = selectedCategories.includes(category);
                        return (
                          <button
                            key={category}
                            type="button"
                            aria-pressed={checked}
                            onClick={() => toggleCategory(category)}
                            className={`min-h-10 shrink-0 rounded-full px-3.5 text-xs font-semibold transition-colors ${
                              checked
                                ? 'bg-emerald-500 text-white'
                                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                            }`}
                          >
                            {category}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {activeFilterCount > 0 && (
                    <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
                      <div className="flex flex-wrap items-center gap-2">
                        {selectedDayFilter && selectedDayFilterLabel && (
                          <button
                            type="button"
                            onClick={clearSelectedDayFilter}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 dark:border-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          >
                            Day: {selectedDayFilterLabel}
                            <X size={12} aria-hidden="true" />
                          </button>
                        )}

                        {selectedCategories.map((category) => (
                          <button
                            key={category}
                            type="button"
                            onClick={() => removeCategory(category)}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 dark:border-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          >
                            {category}
                            <X size={12} aria-hidden="true" />
                          </button>
                        ))}

                        {selectedPaymentMethod !== 'All methods' && (
                          <button
                            type="button"
                            onClick={() => handlePaymentMethodChange('All methods')}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 dark:border-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          >
                            {selectedPaymentMethod}
                            <X size={12} aria-hidden="true" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            clearSelectedCategories();
                            handlePaymentMethodChange('All methods');
                            clearSelectedDayFilter();
                          }}
                          className="inline-flex min-h-9 items-center rounded-full border border-zinc-200 px-3 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          Clear all
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {loading ? (
                  <TransactionsSkeleton />
                ) : hasNoTransactions ? (
                  <EmptyState
                    icon={Wallet}
                    headline="No transactions yet."
                    subtext="Start logging your expenses and income here."
                    cta={{ label: '+ Add Transaction', action: 'add-transaction' }}
                    onAddTransaction={openAddTransactionModal}
                  />
                ) : hasNoMatches ? (
                  <EmptyState
                    icon={SearchX}
                    headline="No results found."
                    subtext="Try adjusting your search or filters."
                    cta={{ label: 'Clear Filters', action: 'clear-filters' }}
                    onClearFilters={clearSearchAndFilters}
                  />
                ) : (
                  <>
                    <TransactionList
                      transactions={paginated}
                      onDelete={requestDeleteConfirmation}
                      onEdit={setEditingTransaction}
                      showDelete
                      showEdit
                      mobileFirst
                      groupByDate
                      stickyHeaderOffsetClassName="top-28 sm:top-24"
                    />

                    {totalPages > 1 && (
                      <div ref={paginationRef} className="mt-6 space-y-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">Rows per page</span>
                          <select
                            value={pageSize}
                            onChange={(e) => {
                              setPageSize(Number(e.target.value));
                              setPage(1);
                            }}
                            className="h-12 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                          >
                            {[10, 20, 50, 100].map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="min-h-12 rounded-xl bg-zinc-100 px-4 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-200 disabled:opacity-40 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                          >
                            ← Prev
                          </button>

                          <span className="min-w-[90px] text-center text-sm text-zinc-500 dark:text-zinc-400">
                            {page} / {totalPages}
                          </span>

                          <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="min-h-12 rounded-xl bg-zinc-100 px-4 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-200 disabled:opacity-40 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                          >
                            Next →
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        ) : timelineLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <TimelineView events={timelineEvents} onAddTransaction={openAddTransactionModal} />
        )}
      </div>

      <FilterDrawer
        isOpen={showFilterDrawer}
        onClose={() => setShowFilterDrawer(false)}
        onApply={() => setShowFilterDrawer(false)}
        categories={categoryBreakdown}
        highestCategoryTotal={highestCategoryTotal}
        selectedCategories={selectedCategories}
        onToggleCategory={(category) => toggleCategory(category as CategoryFilter)}
        selectedPaymentMethod={selectedPaymentMethod}
        paymentMethodOptions={PAYMENT_FILTER_OPTIONS}
        onPaymentMethodChange={handlePaymentMethodChange}
        onExportCSV={handleExportCSV}
        onExportPDF={handleExportPDF}
      />

      {pendingDeleteTransaction && (
        <div
          className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={closeDeleteConfirmation}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-transaction-title"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="delete-transaction-title" className="font-display text-xl font-bold text-zinc-900 dark:text-white">
              Delete transaction?
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              This will permanently delete
              {' '}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{pendingDeleteLabel}</span>
              {' '}
              for
              {' '}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {formatCurrency(pendingDeleteTransaction.amount)}
              </span>
              .
            </p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteConfirmation}
                disabled={isDeleting}
                className="min-h-12 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm font-semibold text-zinc-700 dark:text-zinc-300 disabled:opacity-50 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmed}
                disabled={isDeleting}
                className="min-h-12 px-4 rounded-xl bg-red-500 text-sm font-semibold text-white disabled:opacity-50 hover:bg-red-600 transition-colors"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <FloatingAddButton
        visible={activeView === 'timeline' ? true : isFabVisible}
        onClick={openAddTransactionModal}
      />
      <AddExpenseModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={fetchTransactions}
      />
      <EditTransactionModal
        transaction={editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onUpdated={fetchTransactions}
      />
    </>
  );
}
