'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { Search, Filter, Download, ChevronDown } from 'lucide-react';
import type { Transaction, Category } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { CATEGORIES } from '@/lib/types';
import TransactionList from '@/components/TransactionList';
import FloatingAddButton from '@/components/FloatingAddButton';
import AddExpenseModal from '@/components/AddExpenseModal';
import EditTransactionModal from '@/components/EditTransactionModal';
import { subscribeTransactionUpdates } from '@/lib/transaction-ws';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<Category | ''>('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set('category', categoryFilter);
      const res = await fetch(`/api/transactions?${params}`);
      const json = await res.json();
      setTransactions(json);
    } catch {
      // offline
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

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

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/transactions?id=${encodeURIComponent(id)}`, { method: 'DELETE' });

      if (!res.ok) {
        return;
      }
      fetchTransactions();
    } catch {
      // offline
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
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Transactions</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              {filtered.length} transactions · {formatCurrency(totalAmount)} total
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
              Page {page} of {totalPages}
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              title="Export CSV"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl transition-colors"
            >
              <Download size={13} />
              CSV
            </button>
            <button
              onClick={handleExportPDF}
              title="Export PDF"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl transition-colors"
            >
              <Download size={13} />
              PDF
            </button>
          </div>

          <div ref={exportMenuRef} className="relative sm:hidden self-start">
            <button
              type="button"
              onClick={() => setShowExportMenu((prev) => !prev)}
              aria-expanded={showExportMenu}
              aria-haspopup="menu"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl transition-colors"
            >
              <Download size={14} />
              Export
              <ChevronDown size={14} className={`transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>

            {showExportMenu && (
              <div
                role="menu"
                className="absolute left-0 mt-2 w-44 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg p-1.5 z-20"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    handleExportCSV();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
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
                  className="w-full text-left px-3 py-2 text-sm rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Export PDF
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Search & Filters */}
        <div className="space-y-3 mb-6">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search transactions..."
              className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${
                showFilters
                  ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <Filter size={16} />
            </button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-2 animate-fade-in">
              <button
                onClick={() => { setCategoryFilter(''); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  !categoryFilter
                    ? 'bg-emerald-500 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                All
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setCategoryFilter(cat); setPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    categoryFilter === cat
                      ? 'bg-emerald-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
          <TransactionList
            transactions={paginated}
            onDelete={handleDelete}
            onEdit={setEditingTransaction}
            showDelete
            showEdit
          />

          {/* Pagination Controls */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="px-2 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                ← Prev
              </button>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 min-w-[80px] text-center">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
          </>
        )}
      </div>

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
