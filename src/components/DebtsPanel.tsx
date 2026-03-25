'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CheckCircle2, Pencil, Trash2, Users } from 'lucide-react';
import type { Debt, DebtInput } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import AddDebtModal from '@/components/AddDebtModal';
import ConfirmModal from '@/components/ConfirmModal';
import EmptyState from '@/components/EmptyState';

type DebtsTab = 'active' | 'settled';

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function formatDebtDate(date: string): string {
  const parsed = parseISO(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return format(parsed, 'MMM d');
}

interface DebtsPanelProps {
  showHeader?: boolean;
}

export default function DebtsPanel({ showHeader = true }: DebtsPanelProps) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DebtsTab>('active');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [pendingDeleteDebt, setPendingDeleteDebt] = useState<Debt | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDebts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/debts', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to fetch debts');
      }

      const json = (await response.json()) as Debt[];
      setDebts(Array.isArray(json) ? json : []);
    } catch {
      setError('Unable to load debts right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDebts();
  }, [fetchDebts]);

  const handleCreateDebt = async (input: DebtInput) => {
    const response = await fetch('/api/debts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Failed to create debt');
    }

    void fetchDebts();
  };

  const handleEditDebt = async (input: DebtInput) => {
    if (!editingDebt) {
      throw new Error('Missing debt to edit');
    }

    const response = await fetch(`/api/debts?id=${encodeURIComponent(editingDebt.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Failed to update debt');
    }

    setEditingDebt(null);
    void fetchDebts();
  };

  const handleSettle = async (id: string) => {
    setSettlingId(id);

    try {
      const response = await fetch(`/api/debts?id=${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'settle' }),
      });

      if (!response.ok) {
        throw new Error('Failed to settle debt');
      }

      void fetchDebts();
    } catch {
      setError('Unable to settle this debt right now.');
    } finally {
      setSettlingId(null);
    }
  };

  const handleDeleteDebt = async () => {
    if (!pendingDeleteDebt) {
      return;
    }

    setDeletingId(pendingDeleteDebt.id);

    try {
      const response = await fetch(`/api/debts?id=${encodeURIComponent(pendingDeleteDebt.id)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete debt');
      }

      setPendingDeleteDebt(null);
      void fetchDebts();
    } catch {
      setError('Unable to delete this debt right now.');
    } finally {
      setDeletingId(null);
    }
  };

  const activeDebts = useMemo(
    () => debts.filter((debt) => debt.status === 'active'),
    [debts]
  );

  const settledDebts = useMemo(
    () => debts.filter((debt) => debt.status === 'settled'),
    [debts]
  );

  const owedByMe = useMemo(
    () => activeDebts.filter((debt) => debt.direction === 'owing'),
    [activeDebts]
  );

  const owedToMe = useMemo(
    () => activeDebts.filter((debt) => debt.direction === 'owed'),
    [activeDebts]
  );

  const totalOwing = useMemo(
    () => owedByMe.reduce((sum, debt) => sum + debt.amount, 0),
    [owedByMe]
  );

  const totalOwed = useMemo(
    () => owedToMe.reduce((sum, debt) => sum + debt.amount, 0),
    [owedToMe]
  );

  const owingPeopleCount = new Set(owedByMe.map((debt) => debt.personName.toLowerCase())).size;
  const owedPeopleCount = new Set(owedToMe.map((debt) => debt.personName.toLowerCase())).size;

  const renderActiveCard = (debt: Debt) => {
    const isOwing = debt.direction === 'owing';

    return (
      <div
        key={debt.id}
        className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3.5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={isOwing
                ? 'h-10 w-10 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center'
                : 'h-10 w-10 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center'}
            >
              {getInitials(debt.personName)}
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold text-zinc-900 dark:text-white truncate">{debt.personName}</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">{debt.reason}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className={isOwing ? 'text-lg font-bold text-red-600' : 'text-lg font-bold text-emerald-600'}>
              {formatCurrency(debt.amount)}
            </p>
            <p className="text-xs text-zinc-400">{formatDebtDate(debt.date)}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <span
            className={isOwing
              ? 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-red-100 text-red-600'
              : 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700'}
          >
            {isOwing ? `You owe ${debt.personName.split(' ')[0]}` : `${debt.personName.split(' ')[0]} owes you`}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setEditingDebt(debt)}
              className="h-9 w-9 rounded-xl border border-zinc-200 dark:border-zinc-700 inline-flex items-center justify-center text-zinc-500 dark:text-zinc-300"
              title="Edit debt"
              aria-label="Edit debt"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => setPendingDeleteDebt(debt)}
              className="h-9 w-9 rounded-xl border border-red-200 dark:border-red-800 inline-flex items-center justify-center text-red-500"
              title="Delete debt"
              aria-label="Delete debt"
            >
              <Trash2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => void handleSettle(debt.id)}
              disabled={settlingId === debt.id}
              className="h-9 rounded-xl border border-zinc-200 dark:border-zinc-700 px-3.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 disabled:opacity-40"
            >
              {settlingId === debt.id ? 'Settling...' : 'Settle'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSettledCard = (debt: Debt) => {
    const settledDate = debt.settledAt ? formatDebtDate(debt.settledAt) : null;

    return (
      <div
        key={debt.id}
        className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3.5 opacity-80"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold text-zinc-700 dark:text-zinc-300 truncate">{debt.personName}</p>
            <p className="text-sm text-zinc-400 truncate">{debt.reason}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-zinc-500 dark:text-zinc-400">{formatCurrency(debt.amount)}</p>
            <p className="text-xs text-zinc-400">{settledDate ? `Settled ${settledDate}` : 'Settled'}</p>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
              <CheckCircle2 size={12} />
              Settled
            </span>
            <button
              type="button"
              onClick={() => setPendingDeleteDebt(debt)}
              className="h-8 rounded-lg border border-red-200 dark:border-red-800 px-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-red-500"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <section className="space-y-4">
        {showHeader && (
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-zinc-900 dark:text-white">Debts & Splits</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Keep track of utang between friends.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 text-sm font-semibold text-zinc-700 dark:text-zinc-200"
            >
              + Add
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <article className="rounded-2xl border border-red-200 bg-red-50/70 dark:border-red-900/40 dark:bg-red-900/10 p-4">
            <p className="text-[11px] font-semibold tracking-wide text-red-500 uppercase">You owe</p>
            <p className="mt-1 font-display text-3xl font-bold text-red-600">{formatCurrency(totalOwing)}</p>
            <p className="text-sm text-red-500 mt-0.5">{owingPeopleCount} people</p>
          </article>

          <article className="rounded-2xl border border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-900/10 p-4">
            <p className="text-[11px] font-semibold tracking-wide text-emerald-600 uppercase">Owed to you</p>
            <p className="mt-1 font-display text-3xl font-bold text-emerald-600">{formatCurrency(totalOwed)}</p>
            <p className="text-sm text-emerald-600 mt-0.5">{owedPeopleCount} people</p>
          </article>
        </div>

        <div className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setTab('active')}
              className={tab === 'active'
                ? 'border-b-2 border-[#1D9E75] pb-2 text-sm font-semibold text-zinc-900 dark:text-white'
                : 'border-b-2 border-transparent pb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400'}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setTab('settled')}
              className={tab === 'settled'
                ? 'border-b-2 border-[#1D9E75] pb-2 text-sm font-semibold text-zinc-900 dark:text-white'
                : 'border-b-2 border-transparent pb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400'}
            >
              Settled
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        ) : tab === 'active' ? (
          activeDebts.length === 0 ? (
            <EmptyState
              icon={Users}
              headline="No active debts yet."
              subtext="Track who owes who for shared lunches, rides, and subscriptions."
              cta={{ label: 'Add Debt', action: 'add-transaction' }}
              onAddTransaction={() => setShowAddModal(true)}
            />
          ) : (
            <div className="space-y-5">
              <section>
                <p className="mb-2 text-xs font-semibold tracking-[0.08em] uppercase text-zinc-400">You owe</p>
                <div className="space-y-3">
                  {owedByMe.length === 0 ? (
                    <p className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-500 dark:text-zinc-400">
                      Nothing to settle right now.
                    </p>
                  ) : (
                    owedByMe.map(renderActiveCard)
                  )}
                </div>
              </section>

              <section>
                <p className="mb-2 text-xs font-semibold tracking-[0.08em] uppercase text-zinc-400">Owed to you</p>
                <div className="space-y-3">
                  {owedToMe.length === 0 ? (
                    <p className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-500 dark:text-zinc-400">
                      Nobody owes you right now.
                    </p>
                  ) : (
                    owedToMe.map(renderActiveCard)
                  )}
                </div>
              </section>
            </div>
          )
        ) : settledDebts.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            headline="No settled debts yet."
            subtext="Settled entries will appear here as your debt history."
          />
        ) : (
          <div className="space-y-3">
            {settledDebts.map(renderSettledCard)}
          </div>
        )}
      </section>

      {showAddModal ? (
        <AddDebtModal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSubmitDebt={handleCreateDebt}
        />
      ) : null}

      {editingDebt ? (
        <AddDebtModal
          open={Boolean(editingDebt)}
          onClose={() => setEditingDebt(null)}
          onSubmitDebt={handleEditDebt}
          initialDebt={editingDebt}
        />
      ) : null}

      <ConfirmModal
        open={Boolean(pendingDeleteDebt)}
        title="Delete debt entry?"
        message={pendingDeleteDebt
          ? `This will permanently delete ${pendingDeleteDebt.personName}'s debt entry for ${formatCurrency(pendingDeleteDebt.amount)}.`
          : 'This will permanently delete this debt entry.'}
        confirmLabel={deletingId ? 'Deleting...' : 'Delete'}
        confirmVariant="danger"
        onCancel={() => {
          if (deletingId) return;
          setPendingDeleteDebt(null);
        }}
        onConfirm={() => {
          if (deletingId) return;
          void handleDeleteDebt();
        }}
      />
    </>
  );
}
