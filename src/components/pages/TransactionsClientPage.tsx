'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { differenceInCalendarDays, parseISO, format } from 'date-fns';
import { Search, Filter, Download, ChevronDown, X, Wallet, SearchX, RefreshCw, StopCircle } from 'lucide-react';
import type { WheelEvent as ReactWheelEvent } from 'react';
import type { Transaction, Category, TimelineEvent } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { CATEGORIES } from '@/lib/types';
import TransactionList from '@/components/TransactionList';
import TimelineView from '@/components/TimelineView';
import FloatingAddButton from '@/components/FloatingAddButton';
import AddExpenseModal from '@/components/AddExpenseModal';
import EditTransactionModal from '@/components/EditTransactionModal';
import { subscribeAppUpdates, subscribeTransactionUpdates } from '@/lib/transaction-ws';
import { TransactionsSkeleton } from '@/components/SkeletonLoaders';
import EmptyState from '@/components/EmptyState';

const CATEGORY_FILTERS_STORAGE_KEY = 'transactions:selected-categories';
type CategoryFilter = Category | 'Income';
const CATEGORY_FILTER_OPTIONS: CategoryFilter[] = [...CATEGORIES, 'Income'];

function isCategoryFilter(value: string): value is CategoryFilter {
  return value === 'Income' || CATEGORIES.includes(value as Category);
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalTransactionCount, setTotalTransactionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
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
  const [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [activeView, setActiveView] = useState<'list' | 'timeline' | 'recurring'>('list');
  const [recurringTransactions, setRecurringTransactions] = useState<Transaction[]>([]);
  const [recurringLoading, setRecurringLoading] = useState(true);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const categoryFiltersScrollerRef = useRef<HTMLDivElement>(null);

  const handleCategoryFiltersWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const scroller = categoryFiltersScrollerRef.current;
    if (!scroller) return;
    if (scroller.scrollWidth <= scroller.clientWidth) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

    const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
    const boundedScrollLeft = Math.max(
      0,
      Math.min(maxScrollLeft, scroller.scrollLeft + event.deltaY)
    );

    if (boundedScrollLeft === scroller.scrollLeft) return;

    event.preventDefault();
    scroller.scrollLeft = boundedScrollLeft;
  };

  const fetchTransactions = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (selectedCategories.length > 0) {
        params.set('categories', selectedCategories.join(','));
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
  }, [selectedCategories]);

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

  const fetchRecurring = useCallback(async () => {
    setRecurringLoading(true);
    try {
      const res = await fetch('/api/transactions/recurring');
      if (res.ok) {
        const json = await res.json();
        setRecurringTransactions(Array.isArray(json) ? json : []);
      }
    } catch {
      // offline
    } finally {
      setRecurringLoading(false);
    }
  }, []);

  const handleStopRecurring = async (tx: Transaction) => {
    setStoppingId(tx.id);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/transactions?id=${encodeURIComponent(tx.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recurring: { ...tx.recurring, endDate: today } }),
      });
      if (res.ok) {
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
    const unsubscribe = subscribeAppUpdates(() => {
      void fetchTimeline();
    });

    return unsubscribe;
  }, [fetchTimeline]);

  useEffect(() => {
    if (!showExportMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!exportMenuRef.current) return;
      if (event.target instanceof Node && exportMenuRef.current.contains(event.target)) return;
      setShowExportMenu(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowExportMenu(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [showExportMenu]);

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

    const total = filtered.reduce((sum, tx) => sum + tx.amount, 0);
    const uniqueCategoryCount = new Set(filtered.map((tx) => categoryKey(tx))).size;
    const largestSpend = filtered.reduce<Transaction | null>(
      (max, tx) => (!max || tx.amount > max.amount ? tx : max),
      null
    );

    const categoryStats = filtered.reduce<Record<string, { total: number; count: number }>>((acc, tx) => {
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

    const groupedByDay = filtered.reduce<Record<string, Transaction[]>>((acc, tx) => {
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
        <p class="subtitle">${periodLabel} · ${filtered.length} transactions · Exported ${exportDate}</p>
        <hr class="separator" />

        <section class="summary-grid" aria-label="Export summary">
          <article class="summary-card">
            <p class="summary-label">Total Spent</p>
            <p class="summary-value currency summary-accent">${formatPeso(total)}</p>
            <p class="summary-note">this period</p>
          </article>
          <article class="summary-card">
            <p class="summary-label">Transactions</p>
            <p class="summary-value">${filtered.length}</p>
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

  const filtered = transactions.filter((tx) => {
    if (search) {
      const q = search.toLowerCase();
      return (
        (tx.description || '').toLowerCase().includes(q) ||
        (tx.merchant || '').toLowerCase().includes(q) ||
        (tx.notes || '').toLowerCase().includes(q) ||
        (tx.incomeCategory || '').toLowerCase().includes(q) ||
        tx.type.toLowerCase().includes(q) ||
        (tx.subCategory || '').toLowerCase().includes(q) ||
        (tx.tags || []).some((tag) => tag.toLowerCase().includes(q)) ||
        tx.category.toLowerCase().includes(q) ||
        tx.amount.toString().includes(q)
      );
    }
    return true;
  });

  const totalAmount = filtered.reduce((sum, tx) => sum + tx.amount, 0);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const activeFilterCount = selectedCategories.length;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasNoTransactions = !loading && totalTransactionCount === 0;
  const hasNoMatches = !loading && totalTransactionCount > 0 && filtered.length === 0;

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages));
  }, [totalPages]);

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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4 pb-6">
        <div className="sticky top-2 z-30 -mx-4 sm:mx-0 px-4 sm:px-0 pb-3 bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-50/90 dark:supports-[backdrop-filter]:bg-zinc-950/90">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-white">Transactions</h1>
                <p className="mt-1 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  {filtered.length} transactions
                </p>
              </div>
              <p className="font-display text-3xl sm:text-4xl leading-none font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalAmount)}
              </p>
            </div>
            <p className="mt-2 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              {totalPages > 1 ? `Page ${page} of ${totalPages}` : 'All results in one page'}
              {' · '}
              Swipe right to edit, swipe left to delete
            </p>
          </div>
        </div>

        <div className="mb-5 border-b border-zinc-200 dark:border-zinc-800">
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
            <button
              type="button"
              onClick={() => setActiveView('recurring')}
              className={`flex items-center gap-1.5 border-b-2 pb-2 text-sm font-semibold transition-colors ${
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
          </div>
        </div>

        {activeView === 'list' ? (
          <>
            <div className="space-y-3 mb-5">
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
                className="w-full h-12 pl-11 pr-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              className={`inline-flex items-center gap-2 min-h-12 px-4 rounded-xl text-sm font-semibold border transition-colors ${
                showFilters || activeFilterCount > 0
                  ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
              }`}
              aria-expanded={showFilters}
            >
              <Filter size={16} />
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[11px] px-1.5">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Tip: try words like groceries, lunch, or an amount like 250.
          </p>

          {activeFilterCount > 0 && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3">
              <div className="flex flex-wrap items-center gap-2">
                {selectedCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => removeCategory(category)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                  >
                    {category}
                    <X size={12} aria-hidden="true" />
                  </button>
                ))}

                <button
                  type="button"
                  onClick={clearSelectedCategories}
                  className="inline-flex min-h-9 items-center rounded-full border border-zinc-200 dark:border-zinc-700 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Clear all
                </button>
              </div>
            </div>
          )}

          {showFilters && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 animate-fade-in">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">
                  Category filters
                </p>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearSelectedCategories}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div
                ref={categoryFiltersScrollerRef}
                onWheel={handleCategoryFiltersWheel}
                className="mt-3 -mx-1 px-1 flex items-center gap-2 overflow-x-auto pb-1 snap-x snap-mandatory [scrollbar-width:thin] category-filter-scrollbar"
              >
                <button
                  type="button"
                  onClick={clearSelectedCategories}
                  className={`min-h-10 shrink-0 snap-start rounded-full px-3.5 text-xs font-semibold transition-colors ${
                    activeFilterCount === 0
                      ? 'bg-emerald-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
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
                      className={`min-h-10 shrink-0 snap-start rounded-full px-3.5 text-xs font-semibold transition-colors ${
                        checked
                          ? 'bg-emerald-500 text-white'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>

              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">Use mouse wheel, trackpad, or scrollbar to browse categories.</p>
            </div>
          )}
          </div>

          <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            Export
          </p>

          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              title="Export CSV"
              className="inline-flex items-center gap-1.5 min-h-12 px-4 text-sm font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl transition-colors"
            >
              <Download size={15} />
              CSV
            </button>
            <button
              onClick={handleExportPDF}
              title="Export PDF"
              className="inline-flex items-center gap-1.5 min-h-12 px-4 text-sm font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl transition-colors"
            >
              <Download size={15} />
              PDF
            </button>
          </div>

          <div ref={exportMenuRef} className="relative sm:hidden self-start">
            <button
              type="button"
              onClick={() => setShowExportMenu((prev) => !prev)}
              aria-expanded={showExportMenu}
              aria-haspopup="menu"
              className="inline-flex items-center gap-1.5 min-h-12 px-4 text-sm font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl transition-colors"
            >
              <Download size={14} />
              Export
              <ChevronDown size={14} className={`transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>

            {showExportMenu && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-44 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg p-1.5 z-20"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    handleExportCSV();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left min-h-12 px-3 py-2 text-sm rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    handleExportPDF();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left min-h-12 px-3 py-2 text-sm rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Export PDF
                </button>
              </div>
            )}
          </div>
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
                  <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">Rows per page</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setPage(1);
                        }}
                        className="h-12 px-3 text-sm border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none"
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
                        className="min-h-12 px-4 text-sm font-semibold rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                      >
                        ← Prev
                      </button>

                      <span className="text-sm text-zinc-500 dark:text-zinc-400 min-w-[90px] text-center">
                        {page} / {totalPages}
                      </span>

                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="min-h-12 px-4 text-sm font-semibold rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
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
        ) : timelineLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <TimelineView events={timelineEvents} onAddTransaction={openAddTransactionModal} />
        )}
      </div>

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

      <FloatingAddButton onClick={openAddTransactionModal} />
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
