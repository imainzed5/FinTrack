'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { Search, Filter, Download, ChevronDown, Receipt, X } from 'lucide-react';
import type { WheelEvent as ReactWheelEvent } from 'react';
import type { Transaction, Category } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { CATEGORIES } from '@/lib/types';
import TransactionList from '@/components/TransactionList';
import FloatingAddButton from '@/components/FloatingAddButton';
import AddExpenseModal from '@/components/AddExpenseModal';
import EditTransactionModal from '@/components/EditTransactionModal';
import { subscribeTransactionUpdates } from '@/lib/transaction-ws';
import { TransactionsSkeleton } from '@/components/SkeletonLoaders';

const CATEGORY_FILTERS_STORAGE_KEY = 'transactions:selected-categories';

function isCategory(value: string): value is Category {
  return CATEGORIES.includes(value as Category);
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Category[]>(() => {
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
        (value): value is Category => typeof value === 'string' && isCategory(value)
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
      const res = await fetch(query ? `/api/transactions?${query}` : '/api/transactions');

      if (!res.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const json = await res.json();
      setTransactions(Array.isArray(json) ? json : []);
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
      tx.category,
      tx.subCategory || '',
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
            <td>${tx.category}</td>
            <td>${tx.subCategory || ''}</td>
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

  const toggleCategory = (category: Category) => {
    setSelectedCategories((current) => {
      if (current.includes(category)) {
        return current.filter((existing) => existing !== category);
      }
      return [...current, category];
    });
    setPage(1);
  };

  const removeCategory = (category: Category) => {
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
  const hasNoTransactions = !loading && transactions.length === 0;
  const hasNoMatches = !loading && transactions.length > 0 && filtered.length === 0;

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

                {CATEGORIES.map((category) => {
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
          <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/60 p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
              <Receipt size={24} />
            </div>
            <h2 className="font-display text-xl font-bold text-zinc-900 dark:text-white">No transactions yet</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Start tracking expenses to unlock insights and spending trends.
            </p>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors"
            >
              Add your first transaction →
            </button>
          </div>
        ) : hasNoMatches ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-8 text-center">
            <h2 className="font-display text-xl font-bold text-zinc-900 dark:text-white">No matching transactions</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Try a different search phrase or clear your filters.
            </p>
            <button
              type="button"
              onClick={clearSearchAndFilters}
              className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 px-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <X size={14} />
              Reset search and filters
            </button>
          </div>
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

      <FloatingAddButton onClick={() => setShowAddModal(true)} />
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
