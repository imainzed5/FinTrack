'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { Settings as SettingsIcon, Plus, Trash2, Wifi, WifiOff, Download, Upload, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import type { Budget, Category, Transaction } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { subscribeBudgetUpdates } from '@/lib/transaction-ws';
import { SettingsSkeleton } from '@/components/SkeletonLoaders';

export default function SettingsPage() {
  const { theme, toggle } = useTheme();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [newCategory, setNewCategory] = useState<Category | 'Overall'>('Overall');
  const [newSubCategory, setNewSubCategory] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [newRollover, setNewRollover] = useState(false);
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBudgets = useCallback(async () => {
    try {
      const res = await fetch('/api/budgets');
      const json = await res.json();
      setBudgets(json);
    } catch {
      // offline
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBudgets();
    setOnline(navigator.onLine);

    const unsubscribeRealtime = subscribeBudgetUpdates(() => {
      void fetchBudgets();
    });

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    async function checkPending() {
      try {
        const { getPendingTransactions } = await import('@/lib/indexeddb');
        const pending = await getPendingTransactions();
        setPendingCount(pending.length);
      } catch {
        // no indexeddb
      }
    }
    checkPending();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeRealtime();
    };
  }, [fetchBudgets]);

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLimit || parseFloat(newLimit) <= 0) return;

    const budget: Budget = {
      id: uuidv4(),
      category: newCategory,
      subCategory: newCategory === 'Overall' ? undefined : (newSubCategory.trim() || undefined),
      monthlyLimit: parseFloat(newLimit),
      month,
      rollover: newRollover,
      alertThresholdsTriggered: [],
    };

    try {
      await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(budget),
      });
      setNewLimit('');
      setNewSubCategory('');
      setNewRollover(false);
      setShowAddBudget(false);
      fetchBudgets();
    } catch {
      // offline
    }
  };

  const handleDeleteBudget = async (id: string) => {
    try {
      await fetch(`/api/budgets?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      fetchBudgets();
    } catch {
      // offline
    }
  };

  const handleSync = async () => {
    try {
      const { syncPendingTransactions } = await import('@/lib/indexeddb');
      const result = await syncPendingTransactions();
      if (result.synced > 0) {
        setPendingCount((prev) => prev - result.synced);
      }
    } catch {
      // failed
    }
  };

  const handleExportJSON = async () => {
    try {
      const res = await fetch('/api/transactions');
      const transactions: Transaction[] = await res.json();
      const blob = new Blob([JSON.stringify(transactions, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expense-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // offline
    }
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus('Importing...');
    try {
      const text = await file.text();
      const transactions: Transaction[] = JSON.parse(text);

      if (!Array.isArray(transactions)) {
        setImportStatus('Invalid file format.');
        return;
      }

      let imported = 0;
      for (const tx of transactions) {
        if (!tx.amount || !tx.category || !tx.date) continue;
        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: tx.amount,
            category: tx.category,
            subCategory: tx.subCategory,
            merchant: tx.merchant,
            description: tx.description,
            date: tx.date,
            paymentMethod: tx.paymentMethod ?? 'Cash',
            notes: tx.notes ?? '',
            tags: tx.tags ?? [],
            attachmentBase64: tx.attachmentBase64,
            split: tx.split,
            recurring: tx.recurring
              ? {
                  frequency: tx.recurring.frequency,
                  interval: tx.recurring.interval,
                  endDate: tx.recurring.endDate,
                }
              : undefined,
          }),
        });
        if (res.ok) imported++;
      }

      setImportStatus(`Imported ${imported} transaction${imported !== 1 ? 's' : ''} successfully.`);
    } catch {
      setImportStatus('Failed to import. Make sure the file is a valid JSON export.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setImportStatus(null), 5000);
    }
  };

  const monthBudgets = budgets
    .filter((b) => b.month === month)
    .sort((a, b) => {
      if (a.category === 'Overall' && b.category !== 'Overall') return -1;
      if (a.category !== 'Overall' && b.category === 'Overall') return 1;
      const aLabel = `${a.category}:${a.subCategory || ''}`.toLowerCase();
      const bLabel = `${b.category}:${b.subCategory || ''}`.toLowerCase();
      return aLabel.localeCompare(bLabel);
    });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <SettingsIcon size={20} className="text-zinc-600 dark:text-zinc-400" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-white">Settings</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage budgets and preferences
          </p>
        </div>
      </div>

      {/* Connection Status */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 mb-4">
        <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-white mb-3">Sync Status</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {online ? (
              <Wifi size={16} className="text-emerald-500" />
            ) : (
              <WifiOff size={16} className="text-red-500" />
            )}
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {online ? 'Online' : 'Offline'}
            </span>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-600 dark:text-amber-400">
                {pendingCount} pending
              </span>
              <button
                onClick={handleSync}
                disabled={!online}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-300 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Sync Now
              </button>
            </div>
          )}
          {pendingCount === 0 && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">All synced</span>
          )}
        </div>
      </div>

      {/* Budget Management */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-white">Budget Management</h3>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none"
            />
            <button
              onClick={() => setShowAddBudget(true)}
              className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {showAddBudget && (
          <form onSubmit={handleAddBudget} className="mb-4 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl space-y-3 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => {
                    const nextCategory = e.target.value as Category | 'Overall';
                    setNewCategory(nextCategory);
                    if (nextCategory === 'Overall') setNewSubCategory('');
                  }}
                  className="w-full mt-1 px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none"
                >
                  <option value="Overall">Overall</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Sub-category (optional)</label>
                <input
                  type="text"
                  value={newSubCategory}
                  onChange={(e) => setNewSubCategory(e.target.value)}
                  disabled={newCategory === 'Overall'}
                  placeholder={newCategory === 'Overall' ? 'Not applicable for overall' : 'e.g., Groceries'}
                  className="w-full mt-1 px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Monthly Limit (₱)</label>
                <input
                  type="number"
                  min="1"
                  value={newLimit}
                  onChange={(e) => setNewLimit(e.target.value)}
                  placeholder="12000"
                  className="w-full mt-1 px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none"
                  required
                />
              </div>
              <label className="flex items-center justify-between px-3 py-2 mt-5 sm:mt-0 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Enable rollover</span>
                <input
                  type="checkbox"
                  checked={newRollover}
                  onChange={(e) => setNewRollover(e.target.checked)}
                  className="h-4 w-4 accent-emerald-500"
                />
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowAddBudget(false);
                  setNewSubCategory('');
                  setNewRollover(false);
                }}
                className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
              >
                Save Budget
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <SettingsSkeleton />
        ) : monthBudgets.length === 0 ? (
          <div className="text-center py-8 text-zinc-400 dark:text-zinc-600 text-sm">
            No budgets set for {format(new Date(month + '-01'), 'MMMM yyyy')}.
          </div>
        ) : (
          <div className="space-y-2">
            {monthBudgets.map((budget) => (
              <div
                key={budget.id}
                className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">
                    {budget.subCategory ? `${budget.category} · ${budget.subCategory}` : budget.category}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {formatCurrency(budget.monthlyLimit)} / month
                    {budget.rollover ? ' · rollover on' : ''}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteBudget(budget.id)}
                  className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Data Management */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 mt-4">
        <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-white mb-1">Data Management</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
          Export a JSON backup of all your transactions, or import a previously exported backup.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleExportJSON}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Download size={15} />
            Export JSON Backup
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-xl transition-colors"
          >
            <Upload size={15} />
            Import JSON Backup
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportJSON}
            className="hidden"
          />
        </div>
        {importStatus && (
          <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400">{importStatus}</p>
        )}
      </div>

      {/* Theme Preferences */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 mt-4">
        <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-white mb-4">Theme</h3>
        <button
          onClick={toggle}
          className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl border border-zinc-200 dark:border-zinc-700 transition-colors"
        >
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
          </span>
          {theme === 'dark' ? (
            <Moon size={18} className="text-zinc-500 dark:text-zinc-400" />
          ) : (
            <Sun size={18} className="text-zinc-500" />
          )}
        </button>
      </div>
    </div>
  );
}
