'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns';
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  PiggyBank,
  Plus,
  ShieldCheck,
  Target,
  Trash2,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { calculateBudgetStatuses } from '@/lib/insights-engine';
import { deleteBudget, getBudgets, getTransactions, setBudget } from '@/lib/local-store';
import {
  isSyncStateRealtimeUpdate,
  subscribeAppUpdates,
  subscribeBudgetUpdates,
} from '@/lib/transaction-ws';
import type { Budget, BudgetStatus, Category, Transaction } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

type EditorMode = 'create-overall' | 'edit-overall' | 'create-category' | 'edit-category';

interface BudgetEditorState {
  mode: EditorMode;
  budgetId?: string;
  category: Category | 'Overall';
  subCategory: string;
  monthlyLimit: string;
  rollover: boolean;
  alertThresholdsTriggered: number[];
}

interface BudgetWorkspaceData {
  budgets: Budget[];
  transactions: Transaction[];
}

const EMPTY_WORKSPACE_DATA: BudgetWorkspaceData = {
  budgets: [],
  transactions: [],
};

function parseMonthValue(value: string): Date {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

function formatMonthLabel(value: string): string {
  return format(parseMonthValue(value), 'MMMM yyyy');
}

function buildMonthOptions(
  months: string[],
  selectedMonth: string
): Array<{ value: string; label: string }> {
  const currentMonth = startOfMonth(new Date());
  const deduped = new Set<string>(months);
  deduped.add(selectedMonth);

  for (let index = -4; index <= 4; index += 1) {
    deduped.add(format(addMonths(currentMonth, index), 'yyyy-MM'));
  }

  return Array.from(deduped)
    .sort((left, right) => right.localeCompare(left))
    .map((value) => ({
      value,
      label: formatMonthLabel(value),
    }));
}

function getReferenceDateForMonth(month: string): Date {
  const today = new Date();
  const currentMonth = format(today, 'yyyy-MM');

  if (month === currentMonth) {
    return today;
  }

  const parsedMonth = parseMonthValue(month);
  return month < currentMonth ? endOfMonth(parsedMonth) : startOfMonth(parsedMonth);
}

function loadBudgetWorkspace(): Promise<BudgetWorkspaceData> {
  return Promise.all([
    getBudgets(),
    getTransactions({ includeRecurringProcessing: false }),
  ]).then(([budgets, transactions]) => ({ budgets, transactions }));
}

function getBudgetStatusLabel(status: BudgetStatus | undefined): string {
  if (!status) {
    return 'No spend tracked yet';
  }

  if (status.status === 'critical') {
    return `Over by ${formatCurrency(Math.abs(status.remaining))}`;
  }

  if (status.status === 'warning') {
    return `${Math.round(status.percentage)}% of limit used`;
  }

  return `${formatCurrency(status.remaining)} left`;
}

function getBudgetStatusTone(status: BudgetStatus | undefined): string {
  if (!status) {
    return 'bg-zinc-100 text-zinc-600';
  }

  if (status.status === 'critical') {
    return 'bg-rose-100 text-rose-700';
  }

  if (status.status === 'warning') {
    return 'bg-amber-100 text-amber-700';
  }

  return 'bg-emerald-100 text-emerald-700';
}

function sortBudgetsForMonth(first: Budget, second: Budget): number {
  if (first.category === 'Overall' && second.category !== 'Overall') return -1;
  if (first.category !== 'Overall' && second.category === 'Overall') return 1;

  return `${first.category}:${first.subCategory || ''}`.localeCompare(
    `${second.category}:${second.subCategory || ''}`
  );
}

function buildEditorState(
  mode: EditorMode,
  budget?: Budget
): BudgetEditorState {
  if (budget) {
    return {
      mode,
      budgetId: budget.id,
      category: budget.category,
      subCategory: budget.subCategory || '',
      monthlyLimit: String(budget.monthlyLimit),
      rollover: Boolean(budget.rollover),
      alertThresholdsTriggered: budget.alertThresholdsTriggered ?? [],
    };
  }

  return {
    mode,
    budgetId: undefined,
    category: mode === 'create-overall' ? 'Overall' : CATEGORIES[0],
    subCategory: '',
    monthlyLimit: '',
    rollover: false,
    alertThresholdsTriggered: [],
  };
}

function BudgetEditor({
  month,
  state,
  onCancel,
  onSave,
  saving,
}: {
  month: string;
  state: BudgetEditorState;
  onCancel: () => void;
  onSave: (nextState: BudgetEditorState) => Promise<void>;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<BudgetEditorState>(state);
  const [error, setError] = useState<string | null>(null);

  const isEditing = state.mode === 'edit-overall' || state.mode === 'edit-category';
  const isOverall = draft.category === 'Overall';

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!draft.monthlyLimit || Number.parseFloat(draft.monthlyLimit) <= 0) {
      setError('Add a monthly limit greater than zero.');
      return;
    }

    setError(null);
    await onSave(draft);
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-[28px] border border-[#e3dbc9] bg-[#fbf8f1] p-4 shadow-[0_16px_36px_rgba(42,42,28,0.05)] sm:p-5"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            {isOverall ? 'Overall budget' : 'Category budget'}
          </p>
          <h3 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-zinc-900">
            {isEditing ? 'Update this budget rule' : 'Create a budget rule'}
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Saving for {formatMonthLabel(month)} keeps the current budget model intact: one rule per
            month, category, and optional subcategory.
          </p>
        </div>

        <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-600">
          {formatMonthLabel(month)}
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            Category
          </label>
          <select
            value={draft.category}
            disabled={isEditing}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                category: event.target.value as Category | 'Overall',
                subCategory: event.target.value === 'Overall' ? '' : current.subCategory,
              }))
            }
            className="mt-2 min-h-11 w-full rounded-2xl border border-[#ddd6c8] bg-white px-4 text-sm text-zinc-700 outline-none transition focus:border-[#1D9E75] disabled:cursor-not-allowed disabled:bg-[#f4efe4]"
          >
            <option value="Overall">Overall</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          {isEditing ? (
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              Category stays locked during edit so an existing budget rule does not accidentally merge
              into another one.
            </p>
          ) : null}
        </div>

        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            Subcategory
          </label>
          <input
            value={draft.subCategory}
            disabled={isOverall || isEditing}
            onChange={(event) =>
              setDraft((current) => ({ ...current, subCategory: event.target.value }))
            }
            placeholder={isOverall ? 'Not used for Overall budgets' : 'Optional detail, like groceries'}
            className="mt-2 min-h-11 w-full rounded-2xl border border-[#ddd6c8] bg-white px-4 text-sm text-zinc-700 outline-none transition focus:border-[#1D9E75] disabled:cursor-not-allowed disabled:bg-[#f4efe4]"
          />
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            Leave this empty if the full category should share one budget cap.
          </p>
        </div>

        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            Monthly limit
          </label>
          <input
            type="number"
            step="0.01"
            value={draft.monthlyLimit}
            onChange={(event) =>
              setDraft((current) => ({ ...current, monthlyLimit: event.target.value }))
            }
            placeholder="0.00"
            className="mt-2 min-h-11 w-full rounded-2xl border border-[#ddd6c8] bg-white px-4 text-sm text-zinc-700 outline-none transition focus:border-[#1D9E75]"
          />
        </div>

        <label className="flex items-start gap-3 rounded-[24px] border border-[#e8dfd0] bg-white px-4 py-4">
          <input
            type="checkbox"
            checked={draft.rollover}
            onChange={(event) =>
              setDraft((current) => ({ ...current, rollover: event.target.checked }))
            }
            className="mt-1 h-4 w-4 rounded border-[#cfc6b8] text-[#1D9E75] focus:ring-[#1D9E75]"
          />
          <span>
            <span className="block text-sm font-medium text-zinc-900">
              Carry unused room into the next month
            </span>
            <span className="mt-1 block text-xs leading-5 text-zinc-500">
              Rollover uses unused room from the same budget scope last month. Alerts still track at
              50%, 80%, and 100% of the limit.
            </span>
          </span>
        </label>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#ddd6c8] px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-white"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-[#1D9E75] px-5 text-sm font-medium text-white transition-colors hover:bg-[#187f5d] disabled:cursor-not-allowed disabled:bg-[#7bc2ac]"
        >
          <Plus size={14} />
          {saving ? 'Saving…' : 'Save budget'}
        </button>
      </div>
    </form>
  );
}

function BudgetRuleCard({
  budget,
  status,
  onEdit,
  onDelete,
  deleting,
}: {
  budget: Budget;
  status: BudgetStatus | undefined;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const percentage = status ? Math.min(status.percentage, 100) : 0;

  return (
    <div className="rounded-[28px] border border-[#e8dfd0] bg-white p-4 shadow-[0_16px_34px_rgba(42,42,28,0.04)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-zinc-900">
              {budget.category}
            </h3>
            {budget.subCategory ? (
              <span className="inline-flex rounded-full bg-[#fbf8f1] px-2.5 py-1 text-xs font-medium text-zinc-600">
                {budget.subCategory}
              </span>
            ) : null}
            {budget.rollover ? (
              <span className="inline-flex rounded-full bg-[#eef7f0] px-2.5 py-1 text-xs font-medium text-[#1D9E75]">
                Rollover on
              </span>
            ) : null}
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getBudgetStatusTone(status)}`}
            >
              {getBudgetStatusLabel(status)}
            </span>
          </div>

          <div className="mt-3 grid gap-3 text-sm text-zinc-500 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                Limit
              </p>
              <p className="mt-1 text-base font-semibold text-zinc-900">
                {formatCurrency(status?.baseLimit ?? budget.monthlyLimit)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                Spent
              </p>
              <p className="mt-1 text-base font-semibold text-zinc-900">
                {formatCurrency(status?.spent ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                Remaining
              </p>
              <p
                className={`mt-1 text-base font-semibold ${
                  status && status.remaining < 0 ? 'text-rose-600' : 'text-zinc-900'
                }`}
              >
                {formatCurrency(status?.remaining ?? budget.monthlyLimit)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#ddd6c8] px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-[#fbf8f1]"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-rose-200 px-4 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </div>

      <div className="mt-4">
        <div className="h-2.5 overflow-hidden rounded-full bg-[#efe9db]">
          <div
            className={`h-full rounded-full transition-all ${
              status?.status === 'critical'
                ? 'bg-rose-500'
                : status?.status === 'warning'
                  ? 'bg-amber-500'
                  : 'bg-[#1D9E75]'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {status?.rolloverCarry ? (
          <p className="mt-2 text-xs leading-5 text-emerald-700">
            Includes {formatCurrency(status.rolloverCarry)} rolled forward from last month.
          </p>
        ) : null}
        {!status ? (
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            This month has no tracked spend inside this budget yet.
          </p>
        ) : status.projectedOverage > 0 && status.status !== 'critical' ? (
          <p className="mt-2 text-xs leading-5 text-amber-700">
            At this pace, month-end spend lands around {formatCurrency(status.projectedSpent)}.
          </p>
        ) : (
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            Alerts are based on actual usage against the configured limit for this month.
          </p>
        )}
      </div>
    </div>
  );
}

export default function BudgetsClientPage() {
  const [workspace, setWorkspace] = useState<BudgetWorkspaceData>(EMPTY_WORKSPACE_DATA);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [editorState, setEditorState] = useState<BudgetEditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingBudgetId, setDeletingBudgetId] = useState<string | null>(null);

  const refreshWorkspace = useCallback(async () => {
    try {
      const nextWorkspace = await loadBudgetWorkspace();
      setWorkspace(nextWorkspace);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshWorkspace();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [refreshWorkspace]);

  useEffect(() => {
    const unsubscribeBudgetUpdates = subscribeBudgetUpdates(() => {
      void refreshWorkspace();
    });

    const unsubscribeApp = subscribeAppUpdates((message) => {
      if (isSyncStateRealtimeUpdate(message)) {
        return;
      }

      void refreshWorkspace();
    });

    return () => {
      unsubscribeBudgetUpdates();
      unsubscribeApp();
    };
  }, [refreshWorkspace]);

  const monthOptions = useMemo(
    () => buildMonthOptions(workspace.budgets.map((budget) => budget.month), selectedMonth),
    [selectedMonth, workspace.budgets]
  );

  const selectedMonthBudgets = useMemo(
    () =>
      workspace.budgets
        .filter((budget) => budget.month === selectedMonth)
        .sort(sortBudgetsForMonth),
    [selectedMonth, workspace.budgets]
  );

  const referenceDate = useMemo(() => getReferenceDateForMonth(selectedMonth), [selectedMonth]);

  const selectedMonthStatuses = useMemo(
    () =>
      calculateBudgetStatuses(workspace.transactions, workspace.budgets, referenceDate).sort(
        (first, second) => {
          if (first.category === 'Overall' && second.category !== 'Overall') return -1;
          if (first.category !== 'Overall' && second.category === 'Overall') return 1;
          return `${first.category}:${first.subCategory || ''}`.localeCompare(
            `${second.category}:${second.subCategory || ''}`
          );
        }
      ),
    [referenceDate, workspace.budgets, workspace.transactions]
  );

  const statusByBudgetId = useMemo(() => {
    const pairs = selectedMonthStatuses.map((status) => [status.budgetId, status] as const);
    return new Map<string, BudgetStatus>(pairs);
  }, [selectedMonthStatuses]);

  const overallBudget = selectedMonthBudgets.find(
    (budget) => budget.category === 'Overall' && !budget.subCategory
  );
  const overallStatus = overallBudget ? statusByBudgetId.get(overallBudget.id) : undefined;
  const categoryBudgets = selectedMonthBudgets.filter((budget) => budget.category !== 'Overall');
  const hasConfiguredBudgets = workspace.budgets.length > 0;
  const rolloverCount = selectedMonthBudgets.filter((budget) => budget.rollover).length;
  const atRiskCount = selectedMonthStatuses.filter((status) => status.status !== 'safe').length;
  const criticalCount = selectedMonthStatuses.filter((status) => status.status === 'critical').length;

  const openOverallEditor = () => {
    setEditorState(
      overallBudget
        ? buildEditorState('edit-overall', overallBudget)
        : buildEditorState('create-overall')
    );
  };

  const openCategoryCreate = () => {
    setEditorState(buildEditorState('create-category'));
  };

  const openCategoryEdit = (budget: Budget) => {
    setEditorState(buildEditorState('edit-category', budget));
  };

  const handleSaveBudget = async (nextState: BudgetEditorState) => {
    setSaving(true);

    try {
      await setBudget({
        id: nextState.budgetId ?? uuidv4(),
        category: nextState.category,
        subCategory:
          nextState.category === 'Overall' ? undefined : nextState.subCategory.trim() || undefined,
        monthlyLimit: Number.parseFloat(nextState.monthlyLimit),
        month: selectedMonth,
        rollover: nextState.rollover,
        alertThresholdsTriggered: nextState.alertThresholdsTriggered,
      });

      setEditorState(null);
      await refreshWorkspace();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBudget = async (budget: Budget) => {
    const confirmed = window.confirm(
      `Delete the ${budget.category}${budget.subCategory ? ` / ${budget.subCategory}` : ''} budget for ${formatMonthLabel(selectedMonth)}?`
    );
    if (!confirmed) {
      return;
    }

    setDeletingBudgetId(budget.id);

    try {
      await deleteBudget(budget.id);
      if (editorState?.budgetId === budget.id) {
        setEditorState(null);
      }
      await refreshWorkspace();
    } finally {
      setDeletingBudgetId(null);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-7 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[2.15rem] font-semibold tracking-[-0.04em] text-zinc-900">
            Budgets
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Review one month at a time, starting with the overall cap.
          </p>
        </div>

        <div className="w-full rounded-[28px] border border-[#e3dbc9] bg-[#fbf8f1] p-4 shadow-[0_16px_32px_rgba(42,42,28,0.04)] sm:max-w-[26rem]">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#1D9E75]">
              <CalendarRange size={20} />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Month planner
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Switch months to review old setups or plan ahead.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() =>
                setSelectedMonth(format(addMonths(parseMonthValue(selectedMonth), -1), 'yyyy-MM'))
              }
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#ddd6c8] bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-[#f6f1e7]"
            >
              <ChevronLeft size={16} />
            </button>

            <select
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="min-h-11 flex-1 rounded-full border border-[#ddd6c8] bg-white px-4 text-sm text-zinc-700 outline-none transition focus:border-[#1D9E75]"
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() =>
                setSelectedMonth(format(addMonths(parseMonthValue(selectedMonth), 1), 'yyyy-MM'))
              }
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#ddd6c8] bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-[#f6f1e7]"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[26px] border border-[#e3dbc9] bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Configured</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-zinc-900">
            {loading ? '…' : selectedMonthBudgets.length}
          </p>
          <p className="mt-1 text-sm text-zinc-500">Rules active for {formatMonthLabel(selectedMonth)}</p>
        </div>

        <div className="rounded-[26px] border border-[#e3dbc9] bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Overall cap</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-zinc-900">
            {loading ? '…' : overallBudget ? formatCurrency(overallBudget.monthlyLimit) : 'Missing'}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {overallStatus ? getBudgetStatusLabel(overallStatus) : 'Set this first to anchor the month'}
          </p>
        </div>

        <div className="rounded-[26px] border border-[#e3dbc9] bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Rollover</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-zinc-900">
            {loading ? '…' : rolloverCount}
          </p>
          <p className="mt-1 text-sm text-zinc-500">Budgets carrying leftover room from the prior month</p>
        </div>

        <div className="rounded-[26px] border border-[#e3dbc9] bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Watchlist</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-zinc-900">
            {loading ? '…' : atRiskCount}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {criticalCount > 0 ? `${criticalCount} already over limit` : 'No category is over the line right now'}
          </p>
        </div>
      </section>

      {!loading && !hasConfiguredBudgets ? (
        <section className="mt-6 rounded-[28px] border border-[#e3dbc9] bg-[#fbf8f1] p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1D9E75]">
              <Target size={20} />
            </span>
            <div className="max-w-3xl">
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-zinc-900">
                Start with the overall budget
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Give the month one clear ceiling first. Category budgets can come later if a specific
                spending lane needs tighter guardrails.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="mt-6 rounded-[30px] border border-[#e3dbc9] bg-white p-5 shadow-[0_20px_44px_rgba(42,42,28,0.05)] sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1D9E75]">
              Overall budget
            </p>
            <h2 className="mt-2 text-[1.55rem] font-semibold tracking-[-0.03em] text-zinc-900">
              {formatMonthLabel(selectedMonth)}
            </h2>
          </div>

          <button
            type="button"
            onClick={openOverallEditor}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-[#1D9E75] px-5 text-sm font-medium text-white transition-colors hover:bg-[#187f5d]"
          >
            {overallBudget ? 'Edit overall budget' : 'Set overall budget'}
          </button>
        </div>

        <div className="mt-5">
          {editorState &&
          (editorState.mode === 'create-overall' || editorState.mode === 'edit-overall') ? (
            <BudgetEditor
              key={`${editorState.mode}-${editorState.budgetId ?? 'new'}-${selectedMonth}`}
              month={selectedMonth}
              state={editorState}
              onCancel={() => setEditorState(null)}
              onSave={handleSaveBudget}
              saving={saving}
            />
          ) : overallBudget ? (
            <BudgetRuleCard
              budget={overallBudget}
              status={overallStatus}
              onEdit={openOverallEditor}
              onDelete={() => void handleDeleteBudget(overallBudget)}
              deleting={deletingBudgetId === overallBudget.id}
            />
          ) : (
            <div className="rounded-[28px] border border-dashed border-[#d9d1c2] bg-[#fbf8f1] p-5">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1D9E75]">
                  <PiggyBank size={20} />
                </span>
                <div>
                  <p className="text-base font-semibold text-zinc-900">
                    No Overall budget yet for {formatMonthLabel(selectedMonth)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    Start here so the month has a clear ceiling. Category budgets still work without it,
                    but people usually understand the plan faster when this cap exists first.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-[30px] border border-[#e3dbc9] bg-white p-5 shadow-[0_20px_44px_rgba(42,42,28,0.05)] sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1D9E75]">
              Category budgets
            </p>
            <h2 className="mt-2 text-[1.55rem] font-semibold tracking-[-0.03em] text-zinc-900">
              By category
            </h2>
          </div>

          <button
            type="button"
            onClick={openCategoryCreate}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-[#d8ceb8] bg-[#fbf8f1] px-5 text-sm font-medium text-zinc-800 transition-colors hover:bg-[#f4efe4]"
          >
            <Plus size={14} />
            Add category budget
          </button>
        </div>

        <div className="mt-5">
          {editorState &&
          (editorState.mode === 'create-category' || editorState.mode === 'edit-category') ? (
            <div className="mb-4">
              <BudgetEditor
                key={`${editorState.mode}-${editorState.budgetId ?? 'new'}-${selectedMonth}`}
                month={selectedMonth}
                state={editorState}
                onCancel={() => setEditorState(null)}
                onSave={handleSaveBudget}
                saving={saving}
              />
            </div>
          ) : null}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-36 animate-pulse rounded-[28px] border border-[#ebe3d5] bg-[#fbf8f1]"
                />
              ))}
            </div>
          ) : categoryBudgets.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-[#d9d1c2] bg-[#fbf8f1] p-5">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1D9E75]">
                  <ShieldCheck size={20} />
                </span>
                <div>
                  <p className="text-base font-semibold text-zinc-900">No category budgets yet</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    That is okay. A single Overall budget is enough for a clean first setup. Add category
                    rules only when a specific spending lane needs extra protection.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {categoryBudgets.map((budget) => (
                <BudgetRuleCard
                  key={budget.id}
                  budget={budget}
                  status={statusByBudgetId.get(budget.id)}
                  onEdit={() => openCategoryEdit(budget)}
                  onDelete={() => void handleDeleteBudget(budget)}
                  deleting={deletingBudgetId === budget.id}
                />
              ))}
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
