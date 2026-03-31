'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { differenceInCalendarDays, format, parseISO, subMonths } from 'date-fns';
import { Search, Filter, X, Wallet, SearchX, RefreshCw, StopCircle, ArrowLeftRight } from 'lucide-react';
import type { Transaction, Category, PaymentMethod } from '@/lib/types';
import { isOperationalTransaction, isSpendAnalyticsTransaction } from '@/lib/transaction-classification';
import { formatCurrency } from '@/lib/utils';
import { CATEGORIES } from '@/lib/types';
import TransactionList from '@/components/TransactionList';
import TimelineView from '@/components/TimelineView';
import FloatingAddButton from '@/components/FloatingAddButton';
import AddExpenseModal from '@/components/AddExpenseModal';
import EditTransactionModal from '@/components/EditTransactionModal';
import FilterDrawer from '@/components/FilterDrawer';
import TransferModal from '@/components/TransferModal';
import {
  deleteTransaction,
  getActiveRecurringTransactions,
  getTimelineEvents,
  getTransactions as getStoredTransactions,
  updateTransaction,
} from '@/lib/local-store';
import {
  isSyncStateRealtimeUpdate,
  subscribeAppUpdates,
  subscribeTransactionUpdates,
} from '@/lib/transaction-ws';
import { TransactionsSkeleton } from '@/components/SkeletonLoaders';
import EmptyState from '@/components/EmptyState';
import DebtsPanel from '@/components/DebtsPanel';
import type { TimelineEvent } from '@/lib/types';

const CATEGORY_FILTERS_STORAGE_KEY = 'transactions:selected-categories';
const PAYMENT_METHOD_FILTER_STORAGE_KEY = 'transactions:selected-payment-method';
const INCLUDE_OPERATIONAL_ANALYTICS_STORAGE_KEY = 'transactions:include-operational-analytics';
type CategoryFilter = Category | 'Income' | 'Savings';
type PaymentMethodFilter = 'All methods' | 'Cash' | 'GCash' | 'Card' | 'Bank Transfer';
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
  const [showTransferModal, setShowTransferModal] = useState(false);
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
  const [includeOperationalInAnalytics, setIncludeOperationalInAnalytics] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.sessionStorage.getItem(INCLUDE_OPERATIONAL_ANALYTICS_STORAGE_KEY) === 'true';
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isFabVisible, setIsFabVisible] = useState(true);
  const [activeView, setActiveView] = useState<'list' | 'timeline' | 'recurring' | 'debts'>('list');
  const [recurringTransactions, setRecurringTransactions] = useState<Transaction[]>([]);
  const [recurringLoading, setRecurringLoading] = useState(true);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const paginationRef = useRef<HTMLDivElement>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);

    try {
      const nextTransactions = await getStoredTransactions();
      setTransactions(nextTransactions);
      setTotalTransactionCount(nextTransactions.length);
    } catch {
      setTransactions([]);
      setTotalTransactionCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

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
    if (typeof window === 'undefined') return;

    if (!includeOperationalInAnalytics) {
      window.sessionStorage.removeItem(INCLUDE_OPERATIONAL_ANALYTICS_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(INCLUDE_OPERATIONAL_ANALYTICS_STORAGE_KEY, 'true');
  }, [includeOperationalInAnalytics]);

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
      const json = await getTimelineEvents();
      setTimelineEvents(Array.isArray(json) ? json : []);
    } catch {
      setTimelineEvents([]);
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  const fetchRecurring = useCallback(async () => {
    setRecurringLoading(true);
    try {
      const json = await getActiveRecurringTransactions();
      setRecurringTransactions(Array.isArray(json) ? json : []);
    } catch {
      setRecurringTransactions([]);
    } finally {
      setRecurringLoading(false);
    }
  }, []);

  const handleStopRecurring = async (tx: Transaction) => {
    setStoppingId(tx.id);
    try {
      const today = new Date().toISOString().split('T')[0];
      const updated = await updateTransaction(tx.id, {
        recurring: tx.recurring ? { ...tx.recurring, endDate: today } : tx.recurring,
      });
      if (updated) {
        void fetchRecurring();
      }
    } catch {
      // offline
    } finally {
      setStoppingId(null);
    }
  };

  useEffect(() => {
    void fetchTimeline();
    void fetchRecurring();
  }, [fetchTimeline, fetchRecurring]);

  useEffect(() => {
    const unsubscribe = subscribeAppUpdates((message) => {
      if (isSyncStateRealtimeUpdate(message)) {
        return;
      }

      void fetchTimeline();
      void fetchRecurring();
    });

    return unsubscribe;
  }, [fetchTimeline, fetchRecurring]);

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
      const deleted = await deleteTransaction(pendingDeleteId);

      if (!deleted) {
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
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const formatPeso = (value: number) =>
      `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const categoryKey = (tx: Transaction) => (tx.type === 'income' ? 'Income' : tx.category);

    const categoryClassMap: Record<string, string> = {
      food: 'badge-food',
      transportation: 'badge-transportation',
      subscriptions: 'badge-subscriptions',
      utilities: 'badge-utilities',
      shopping: 'badge-shopping',
      entertainment: 'badge-entertainment',
      health: 'badge-health',
      education: 'badge-education',
      miscellaneous: 'badge-miscellaneous',
      income: 'badge-income',
    };

    const paymentClass = (method: string) => {
      const normalized = method.trim().toLowerCase();
      if (normalized === 'gcash') return 'pay-gcash';
      if (normalized === 'maya') return 'pay-maya';
      if (normalized === 'cash') return 'pay-cash';
      return 'pay-default';
    };

    const exportTransactions = includeOperationalInAnalytics
      ? filtered
      : filtered.filter((tx) => !isOperationalTransaction(tx));
    const spendTransactions = exportTransactions.filter((tx) =>
      includeOperationalInAnalytics ? tx.type === 'expense' : isSpendAnalyticsTransaction(tx)
    );
    const total = spendTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const uniqueCategoryCount = new Set(spendTransactions.map((tx) => categoryKey(tx))).size;
    const largestSpend = spendTransactions.reduce<Transaction | null>(
      (max, tx) => (!max || tx.amount > max.amount ? tx : max),
      null
    );

    const categoryStats = spendTransactions.reduce<Record<string, { total: number; count: number }>>((acc, tx) => {
      const key = categoryKey(tx);
      if (!acc[key]) {
        acc[key] = { total: 0, count: 0 };
      }
      acc[key].total += tx.amount;
      acc[key].count += 1;
      return acc;
    }, {});

    const topCategoryEntry = Object.entries(categoryStats).sort((a, b) => b[1].total - a[1].total)[0] || null;
    const periodDate = filtered.length > 0 ? parseISO(filtered[0].date) : new Date();
    const periodLabel = format(periodDate, 'MMMM yyyy');
    const exportDate = format(new Date(), 'MMMM d, yyyy');

    const groupedByDay = exportTransactions.reduce<Record<string, Transaction[]>>((acc, tx) => {
      const dayKey = tx.date.split('T')[0];
      if (!acc[dayKey]) {
        acc[dayKey] = [];
      }
      acc[dayKey].push(tx);
      return acc;
    }, {});

    const sortedDays = Object.keys(groupedByDay).sort((a, b) => b.localeCompare(a));

    const rows = sortedDays
      .map((dayKey) => {
        const groupRows = groupedByDay[dayKey]
          .map((tx) => {
            const category = categoryKey(tx);
            const categoryClass = categoryClassMap[category.toLowerCase()] || 'badge-default';
            const merchant = tx.merchant ? escapeHtml(tx.merchant) : '—';
            const description = tx.description ? escapeHtml(tx.description) : '—';
            return `<tr>
              <td class="muted-date">${format(parseISO(tx.date), 'MMM d')}</td>
              <td><span class="category-badge ${categoryClass}">${escapeHtml(category)}</span></td>
              <td class="description-cell">${description}</td>
              <td class="merchant-cell">${merchant}</td>
              <td><span class="payment-badge ${paymentClass(tx.paymentMethod)}">${escapeHtml(tx.paymentMethod)}</span></td>
              <td class="amount-cell">${formatPeso(tx.amount)}</td>
            </tr>`;
          })
          .join('');

        return `<tr class="group-row"><td colspan="6">${format(parseISO(dayKey), 'MMM d').toUpperCase()}</td></tr>${groupRows}`;
      })
      .join('');

    const topCategoryName = topCategoryEntry ? topCategoryEntry[0] : 'No category';
    const topCategoryTotal = topCategoryEntry ? topCategoryEntry[1].total : 0;
    const topCategoryCount = topCategoryEntry ? topCategoryEntry[1].count : 0;
    const largestSpendLabel = largestSpend ? categoryKey(largestSpend) : 'No transactions';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Transaction Export</title>
      <style>
        :root {
          --moneda-green: #0e9f6e;
          --moneda-green-soft: #e8f7f1;
          --text-strong: #1f2937;
          --text-muted: #6b7280;
          --border-soft: #e5e7eb;
          --surface-soft: #f3f4f6;
          --surface-table: #f8fafc;
        }
        * { box-sizing: border-box; }
        body {
          font-family: "Segoe UI", "Inter", "Helvetica Neue", sans-serif;
          margin: 0;
          padding: 32px;
          color: var(--text-strong);
          background: #ffffff;
        }
        .report {
          max-width: 980px;
          margin: 0 auto;
        }
        .brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: var(--moneda-green);
          font-size: 31px;
          line-height: 1;
          margin-bottom: 8px;
        }
        .brand-name {
          font-size: 29px;
          font-weight: 600;
          letter-spacing: 0.2px;
        }
        h1 {
          margin: 0;
          font-size: 42px;
          line-height: 1.1;
          font-weight: 650;
          color: #111827;
        }
        .subtitle {
          margin-top: 10px;
          font-size: 19px;
          color: var(--text-muted);
        }
        .separator {
          margin: 24px 0;
          border: none;
          border-top: 1px solid var(--border-soft);
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 24px;
        }
        .summary-card {
          border: 1px solid var(--border-soft);
          background: var(--surface-soft);
          border-radius: 12px;
          padding: 14px 16px;
        }
        .summary-label {
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #6b7280;
          margin-bottom: 4px;
        }
        .summary-value {
          font-size: 38px;
          font-weight: 600;
          line-height: 1.15;
          color: #111827;
          letter-spacing: -0.01em;
          min-width: 0;
        }
        .summary-value.currency {
          font-size: clamp(24px, 4vw, 34px);
          font-variant-numeric: tabular-nums;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }
        .summary-value.summary-accent {
          color: var(--moneda-green);
        }
        .summary-note {
          margin-top: 6px;
          color: #9ca3af;
          font-size: 12px;
        }
        .section-title {
          margin: 8px 0 10px;
          font-size: 13px;
          letter-spacing: 0.08em;
          color: #6b7280;
          font-weight: 700;
          text-transform: uppercase;
        }
        table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 12px;
          border: 1px solid var(--border-soft);
          border-radius: 12px;
          overflow: hidden;
        }
        thead th {
          background: var(--moneda-green-soft);
          color: var(--moneda-green);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 11px;
          font-weight: 700;
          text-align: left;
          padding: 10px 12px;
          border-bottom: 1px solid #b7e3d3;
        }
        tbody tr:not(.group-row):nth-child(even) {
          background: var(--surface-table);
        }
        tbody td {
          padding: 9px 12px;
          border-bottom: 1px solid #eef2f7;
          vertical-align: middle;
        }
        .group-row td {
          background: #f8fafc;
          color: #9ca3af;
          font-weight: 700;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          font-size: 11px;
          border-top: 1px solid #e5e7eb;
          border-bottom: 1px solid #e5e7eb;
          padding: 8px 12px;
        }
        .muted-date { color: #9ca3af; width: 84px; }
        .description-cell { color: #111827; }
        .merchant-cell { color: #6b7280; }
        .amount-cell {
          text-align: right;
          font-size: 13px;
          font-weight: 500;
          color: #111827;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
          width: 140px;
        }
        .category-badge,
        .payment-badge {
          display: inline-block;
          border-radius: 999px;
          padding: 2px 10px;
          font-size: 11px;
          line-height: 1.35;
          border: 1px solid transparent;
          white-space: nowrap;
        }
        .badge-default { background: #f3f4f6; color: #374151; }
        .badge-food { background: #fff0db; color: #b45309; }
        .badge-transportation { background: #dbeafe; color: #1d4ed8; }
        .badge-subscriptions { background: #e0e7ff; color: #3730a3; }
        .badge-utilities { background: #e0f2fe; color: #0369a1; }
        .badge-shopping { background: #fce7f3; color: #9d174d; }
        .badge-entertainment { background: #ede9fe; color: #6d28d9; }
        .badge-health { background: #dcfce7; color: #166534; }
        .badge-education { background: #fef3c7; color: #92400e; }
        .badge-miscellaneous { background: #f3e8ff; color: #7e22ce; }
        .badge-income { background: #dcfce7; color: #166534; }
        .pay-default { background: #f3f4f6; color: #4b5563; border-color: #e5e7eb; }
        .pay-cash { background: #f3f4f6; color: #4b5563; border-color: #d1d5db; }
        .pay-gcash { background: #e7f8f1; color: #0e9f6e; border-color: #9edfc4; }
        .pay-maya { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
        .table-total-row td {
          background: #e7f8f1;
          color: #0e9f6e;
          border-top: 1px solid #9edfc4;
          border-bottom: none;
          font-size: 15px;
          padding-top: 11px;
          padding-bottom: 11px;
        }
        .table-total-row .total-amount {
          text-align: right;
          font-weight: 650;
          font-variant-numeric: tabular-nums;
        }
        .footer {
          margin-top: 16px;
          padding-top: 10px;
          border-top: 1px solid var(--border-soft);
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          color: #9ca3af;
          font-size: 11px;
        }
        .footer .moneda {
          color: var(--moneda-green);
          text-decoration: none;
        }
        @media print {
          body { padding: 16px; }
          .report { max-width: 100%; }
        }
      </style></head><body>
      <main class="report">
        <div class="brand"><span aria-hidden="true">●</span><span class="brand-name">Moneda</span></div>
        <h1>Transaction Export</h1>
        <p class="subtitle">${periodLabel} · ${exportTransactions.length} transactions · Exported ${exportDate}</p>
        <hr class="separator" />

        <section class="summary-grid" aria-label="Export summary">
          <article class="summary-card">
            <p class="summary-label">Total Spent</p>
            <p class="summary-value currency summary-accent">${formatPeso(total)}</p>
            <p class="summary-note">this period</p>
          </article>
          <article class="summary-card">
            <p class="summary-label">Transactions</p>
            <p class="summary-value">${exportTransactions.length}</p>
            <p class="summary-note">across ${uniqueCategoryCount} categories</p>
          </article>
          <article class="summary-card">
            <p class="summary-label">Largest Spend</p>
            <p class="summary-value currency">${largestSpend ? formatPeso(largestSpend.amount) : '₱0.00'}</p>
            <p class="summary-note">${escapeHtml(largestSpendLabel)}</p>
          </article>
          <article class="summary-card">
            <p class="summary-label">Top Category</p>
            <p class="summary-value">${escapeHtml(topCategoryName)}</p>
            <p class="summary-note">${formatPeso(topCategoryTotal)} · ${topCategoryCount} entr${topCategoryCount === 1 ? 'y' : 'ies'}</p>
          </article>
        </section>

        <h2 class="section-title">Transactions</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Merchant</th>
              <th>Payment</th>
              <th style="text-align:right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr class="table-total-row">
              <td colspan="5">Total · ${periodLabel}</td>
              <td class="total-amount">${formatPeso(total)}</td>
            </tr>
          </tbody>
        </table>

        <footer class="footer">
          <span>Generated by <span class="moneda">Moneda</span> · moneda-nine.vercel.app</span>
          <span>Page 1 of 1</span>
        </footer>
      </main>
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

  const visibleTransactions = includeOperationalInAnalytics
    ? filtered
    : filtered.filter((tx) => !isOperationalTransaction(tx));

  const filteredExpenseTransactions = visibleTransactions.filter((tx) =>
    includeOperationalInAnalytics ? tx.type === 'expense' : isSpendAnalyticsTransaction(tx)
  );
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

    searchableTransactions
      .filter((tx) => includeOperationalInAnalytics ? tx.type === 'expense' : isSpendAnalyticsTransaction(tx))
      .forEach((tx) => {
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
  }, [includeOperationalInAnalytics, searchableTransactions]);

  const highestCategoryTotal = categoryBreakdown[0]?.amount ?? 0;

  const totalAmount = visibleTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  const totalPages = Math.max(1, Math.ceil(visibleTransactions.length / pageSize));
  const activeFilterCount =
    selectedCategories.length +
    (selectedDayFilter ? 1 : 0) +
    (selectedPaymentMethod !== 'All methods' ? 1 : 0);
  const activeDrawerSettingCount = activeFilterCount + (includeOperationalInAnalytics ? 1 : 0);
  const hasCategoryOrPaymentFilter =
    selectedCategories.length > 0 || selectedPaymentMethod !== 'All methods';
  const paginated = visibleTransactions.slice((page - 1) * pageSize, page * pageSize);
  const hasNoTransactions = !loading && totalTransactionCount === 0;
  const hasNoMatches = !loading && totalTransactionCount > 0 && visibleTransactions.length === 0;

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
      <div className="mx-auto max-w-6xl px-4 pb-32 pt-4 sm:px-6 sm:pb-6">
        <div className="-mx-4 bg-white/95 px-4 pb-3 backdrop-blur supports-[backdrop-filter]:bg-white/90 dark:bg-zinc-950/95 dark:supports-[backdrop-filter]:bg-zinc-950/90 sm:mx-0 sm:px-0">
          <div className="rounded-2xl border border-zinc-200 bg-white/95 p-4 dark:border-zinc-800 dark:bg-zinc-900/95">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-white">Transactions</h1>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                  {visibleTransactions.length} transactions
                </p>
              </div>

              <p className="font-display text-3xl font-bold leading-none text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalAmount)}
              </p>
            </div>

            <div className="hidden">
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Page {page} of {totalPages} · Swipe right to edit, swipe left to delete
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:border-[#1D9E75] hover:text-[#1D9E75] dark:border-zinc-700 dark:text-zinc-400"
                >
                  <ArrowLeftRight size={12} />
                  Transfer
                </button>
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
            </div>

            <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500 md:hidden">
              Page {page} of {totalPages}
            </p>

            <p className="mt-2 hidden text-[11px] font-medium text-zinc-500 dark:text-zinc-400 md:block">
              {totalPages > 1 ? `Page ${page} of ${totalPages}` : 'All results in one page'}
              {' · '}
              Swipe right to edit, swipe left to delete
            </p>

            <div className="mt-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="-mx-1 flex items-center gap-5 overflow-x-auto px-1 [scrollbar-width:none]">
                <button
                  type="button"
                  onClick={() => setActiveView('list')}
                  className={`shrink-0 border-b-2 pb-2 text-sm font-semibold transition-colors ${
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
                  className={`shrink-0 border-b-2 pb-2 text-sm font-semibold transition-colors ${
                    activeView === 'timeline'
                      ? 'border-[#1D9E75] text-zinc-900 dark:text-white'
                      : 'border-transparent text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  Timeline
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('recurring')}
                  className={`flex shrink-0 items-center gap-1.5 border-b-2 pb-2 text-sm font-semibold transition-colors ${
                    activeView === 'recurring'
                      ? 'border-[#1D9E75] text-zinc-900 dark:text-white'
                      : 'border-transparent text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  <RefreshCw size={13} />
                  Recurring
                  {recurringTransactions.length > 0 && (
                    <span className="ml-0.5 inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] px-1">
                      {recurringTransactions.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('debts')}
                  className={`shrink-0 border-b-2 pb-2 text-sm font-semibold transition-colors ${
                    activeView === 'debts'
                      ? 'border-[#1D9E75] text-zinc-900 dark:text-white'
                      : 'border-transparent text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  Debts & Splits
                </button>
              </div>
            </div>
          </div>
        </div>

        {activeView === 'list' ? (
          <>
            <div className="mt-4 hidden rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 md:block">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                    Analytics
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                    {includeOperationalInAnalytics
                      ? 'Transfers and adjustments are included in spend stats and category charts.'
                      : 'Showing real spending only. Transfers and adjustments stay visible in the ledger.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIncludeOperationalInAnalytics((current) => !current)}
                  aria-pressed={includeOperationalInAnalytics}
                  className={`inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition-colors ${
                    includeOperationalInAnalytics
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-500/15 dark:text-emerald-300'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {includeOperationalInAnalytics ? 'Including transfers & adjustments' : 'Real spending only'}
                </button>
              </div>
            </div>

            <div className="-mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:hidden">
              <div className="min-w-[152px] rounded-2xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="mb-0.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">Total spent</p>
                <p className="font-display text-lg font-bold text-zinc-900 dark:text-white">{formatPesoDecimal(totalSpent)}</p>
                <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">{filteredExpenseTransactions.length} transactions</p>
              </div>
              <div className="min-w-[152px] rounded-2xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="mb-0.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">Avg / day</p>
                <p className="font-display text-lg font-bold text-zinc-900 dark:text-white">{formatPesoDecimal(avgPerDay)}</p>
                <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">{daysTracked} days tracked</p>
              </div>
              <div className="min-w-[152px] rounded-2xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="mb-0.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">Biggest spend</p>
                <p className="font-display text-lg font-bold text-zinc-900 dark:text-white">
                  {formatPesoDecimal(biggestSpendTx?.amount ?? 0)}
                </p>
                <p className="mt-0.5 text-[10px] text-[#1D9E75]">
                  {biggestSpendTx
                    ? `${biggestSpendTx.merchant || biggestSpendTx.description || biggestSpendTx.paymentMethod} · ${format(parseISO(biggestSpendTx.date), 'MMM d')}`
                    : 'No spend yet'}
                </p>
              </div>
            </div>

            <div className="mt-4 hidden grid-cols-3 gap-3 md:grid">
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

                    <button
                      type="button"
                      onClick={() => setShowTransferModal(true)}
                      className="hidden h-12 shrink-0 rounded-xl border border-zinc-200 bg-white px-4 text-xs font-semibold text-zinc-600 transition-colors hover:border-[#1D9E75] hover:text-[#1D9E75] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 md:inline-flex md:items-center md:gap-1.5"
                    >
                      <ArrowLeftRight size={14} />
                      Transfer
                    </button>

                  </div>

                  <div className="md:hidden">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowFilterDrawer(true)}
                        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition-colors hover:border-[#1D9E75] hover:text-[#1D9E75] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                      >
                        <Filter size={14} />
                        Filters
                        {activeDrawerSettingCount > 0 && (
                          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] text-white">
                            {activeDrawerSettingCount}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowTransferModal(true)}
                        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition-colors hover:border-[#1D9E75] hover:text-[#1D9E75] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                      >
                        <ArrowLeftRight size={14} />
                        Transfer
                      </button>
                    </div>

                    <div className="mt-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                            Spend view
                          </p>
                          <p className="mt-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
                            {includeOperationalInAnalytics ? 'Including transfers & adjustments' : 'Real spending only'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowFilterDrawer(true)}
                          className="text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                        >
                          Adjust
                        </button>
                      </div>
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
                  previewOnDesktop
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
        ) : activeView === 'recurring' ? (
          <div className="space-y-3">
            {recurringLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : recurringTransactions.length === 0 ? (
              <div className="text-center py-16">
                <RefreshCw size={32} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
                <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">No active recurring transactions.</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Add a recurring expense or income from the + button.</p>
              </div>
            ) : (
              recurringTransactions.map((tx) => {
                const nextRunDate = tx.recurring?.nextRunDate
                  ? parseISO(tx.recurring.nextRunDate)
                  : null;
                const daysUntilNext = nextRunDate
                  ? differenceInCalendarDays(nextRunDate, new Date())
                  : null;
                const freqLabel =
                  tx.recurring?.frequency
                    ? tx.recurring.frequency.charAt(0).toUpperCase() + tx.recurring.frequency.slice(1)
                    : '';

                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${
                          tx.type === 'income'
                            ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                        }`}>
                          {tx.type === 'income' ? 'Income' : tx.category}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-700 rounded-full px-1.5 py-0.5">
                          <RefreshCw size={8} />
                          {freqLabel}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                        {tx.description || tx.merchant || tx.category}
                      </p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                        {formatCurrency(tx.amount)}
                        {nextRunDate && (
                          <> · Next: {format(nextRunDate, 'MMM d, yyyy')}
                            {daysUntilNext !== null && daysUntilNext >= 0 && (
                              <span className="ml-1 text-zinc-300 dark:text-zinc-600">
                                ({daysUntilNext === 0 ? 'today' : `in ${daysUntilNext}d`})
                              </span>
                            )}
                          </>
                        )}
                        {tx.recurring?.endDate && (
                          <> · Ends {format(parseISO(tx.recurring.endDate), 'MMM d, yyyy')}</>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStopRecurring(tx)}
                      disabled={stoppingId === tx.id}
                      title="Stop this recurring transaction"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-500 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 disabled:opacity-50 transition-colors shrink-0"
                    >
                      <StopCircle size={13} />
                      {stoppingId === tx.id ? 'Stopping…' : 'Stop'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        ) : activeView === 'debts' ? (
          <DebtsPanel showHeader={false} />
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
        includeOperationalInAnalytics={includeOperationalInAnalytics}
        onToggleIncludeOperationalInAnalytics={() => setIncludeOperationalInAnalytics((current) => !current)}
        selectedMonth={selectedMonth}
        monthOptions={monthOptions}
        onMonthChange={handleMonthChange}
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
          className="fixed inset-0 z-[51] bg-zinc-950/50 backdrop-blur-sm flex items-center justify-center px-4"
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
        compactOnMobile
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
      <TransferModal
        open={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        onCreated={() => {
          void fetchTransactions();
          void fetchRecurring();
          void fetchTimeline();
        }}
      />
    </>
  );
}
