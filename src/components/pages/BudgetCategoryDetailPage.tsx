'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { addMonths, format, startOfMonth } from 'date-fns';
import ConfirmModal from '@/components/ConfirmModal';
import {
  ArrowLeft,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  PiggyBank,
  Plus,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import {
  calculateBudgetStatuses,
  compareBudgetScopes,
  getBudgetLabel,
  getBudgetReferenceDate,
  getTransactionAllocations,
  isActiveBudgetRule,
  parseBudgetMonth,
  shouldResetBudgetThresholds,
} from '@/lib/budgeting';
import {
  deleteBudget,
  deleteSavedSubcategory,
  getBudgets,
  getSavedSubcategoryRegistry,
  getTransactions,
  renameSavedSubcategory,
  saveSavedSubcategory,
  setBudget,
} from '@/lib/local-store';
import {
  isSyncStateRealtimeUpdate,
  subscribeAppUpdates,
  subscribeBudgetUpdates,
} from '@/lib/transaction-ws';
import type {
  Budget,
  BudgetStatus,
  Category,
  SavedSubcategoryRegistry,
  Transaction,
} from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

interface BudgetWorkspaceData {
  budgets: Budget[];
  savedSubcategories: SavedSubcategoryRegistry;
  transactions: Transaction[];
}

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: 'danger' | 'warning';
  onConfirm: () => void | Promise<void>;
}

type CategoryEditorState = {
  budgetId?: string;
  monthlyLimit: string;
  rollover: boolean;
  alertThresholdsTriggered: number[];
};

type SubcategoryEditorState = {
  previousLabel?: string;
  label: string;
};

const EMPTY_WORKSPACE_DATA: BudgetWorkspaceData = {
  budgets: [],
  savedSubcategories: {
    Food: [],
    Transportation: [],
    Subscriptions: [],
    Utilities: [],
    Shopping: [],
    Entertainment: [],
    Health: [],
    Education: [],
    Miscellaneous: [],
  },
  transactions: [],
};

function isMonthValue(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}$/.test(value));
}

function formatMonthLabel(value: string): string {
  return format(parseBudgetMonth(value), 'MMMM yyyy');
}

function buildMonthOptions(
  months: string[],
  selectedMonth: string
): Array<{ value: string; label: string }> {
  const currentMonth = startOfMonth(new Date());
  const deduped = new Set<string>(months);
  deduped.add(selectedMonth);

  for (let index = -6; index <= 6; index += 1) {
    deduped.add(format(addMonths(currentMonth, index), 'yyyy-MM'));
  }

  return Array.from(deduped)
    .sort((left, right) => right.localeCompare(left))
    .map((value) => ({
      value,
      label: formatMonthLabel(value),
    }));
}

function loadBudgetWorkspace(): Promise<BudgetWorkspaceData> {
  return Promise.all([
    getBudgets(),
    getSavedSubcategoryRegistry(),
    getTransactions({ includeRecurringProcessing: false }),
  ]).then(([budgets, savedSubcategories, transactions]) => ({
    budgets,
    savedSubcategories,
    transactions,
  }));
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

function buildCategoryEditorState(budget?: Budget): CategoryEditorState {
  return {
    budgetId: budget?.id,
    monthlyLimit: budget ? String(budget.monthlyLimit) : '',
    rollover: Boolean(budget?.rollover),
    alertThresholdsTriggered: budget?.alertThresholdsTriggered ?? [],
  };
}

function buildSubcategoryEditorState(label?: string): SubcategoryEditorState {
  return {
    previousLabel: label,
    label: label ?? '',
  };
}

function CategoryBudgetEditor({
  category,
  month,
  state,
  saving,
  onCancel,
  onSave,
}: {
  category: Category;
  month: string;
  state: CategoryEditorState;
  saving: boolean;
  onCancel: () => void;
  onSave: (nextState: CategoryEditorState) => Promise<void>;
}) {
  const [draft, setDraft] = useState(state);
  const [error, setError] = useState<string | null>(null);

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
            Category cap
          </p>
          <h3 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-zinc-900">
            {state.budgetId ? `Update ${category}` : `Create ${category} cap`}
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Keep the main cap here, then maintain the saved subcategories below only when this
            category needs more detail in expense entry.
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
          <div className="mt-2 min-h-11 rounded-2xl border border-[#ddd6c8] bg-white px-4 text-sm leading-[44px] text-zinc-700">
            {category}
          </div>
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

        <label className="md:col-span-2 flex items-start gap-3 rounded-[24px] border border-[#e8dfd0] bg-white px-4 py-4">
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
              Rollover keeps the same scope and brings unused room forward.
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
          {saving ? 'Saving...' : state.budgetId ? 'Save changes' : 'Save category cap'}
        </button>
      </div>
    </form>
  );
}

function SubcategoryBudgetEditor({
  category,
  month,
  state,
  saving,
  onCancel,
  onSave,
}: {
  category: Category;
  month: string;
  state: SubcategoryEditorState;
  saving: boolean;
  onCancel: () => void;
  onSave: (nextState: SubcategoryEditorState) => Promise<void>;
}) {
  const [draft, setDraft] = useState(state);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!draft.label.trim()) {
      setError('Give this subcategory a name.');
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
            Saved subcategory
          </p>
          <h3 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-zinc-900">
            {state.previousLabel ? 'Rename subcategory' : `Add a subcategory under ${category}`}
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Saved subcategories become reusable choices in the expense modal for {category}.
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
          <div className="mt-2 min-h-11 rounded-2xl border border-[#ddd6c8] bg-white px-4 text-sm leading-[44px] text-zinc-700">
            {category}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            Subcategory
          </label>
          <input
            value={draft.label}
            onChange={(event) =>
              setDraft((current) => ({ ...current, label: event.target.value }))
            }
            placeholder="Example: groceries"
            className="mt-2 min-h-11 w-full rounded-2xl border border-[#ddd6c8] bg-white px-4 text-sm text-zinc-700 outline-none transition focus:border-[#1D9E75]"
          />
        </div>
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
          {saving ? 'Saving...' : state.previousLabel ? 'Save changes' : 'Save subcategory'}
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
    <div className="rounded-[26px] border border-[#e8dfd0] bg-white p-3.5 shadow-[0_16px_34px_rgba(42,42,28,0.04)] sm:rounded-[28px] sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-zinc-900">
              {getBudgetLabel(budget)}
            </h3>
            <span className="inline-flex rounded-full bg-[#fbf8f1] px-2.5 py-1 text-xs font-medium text-zinc-600">
              {budget.subCategory ? 'Subcategory' : 'Category-wide'}
            </span>
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

          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm text-zinc-500 xl:grid-cols-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                Configured
              </p>
              <p className="mt-1 text-base font-semibold text-zinc-900">
                {formatCurrency(status?.configuredLimit ?? budget.monthlyLimit)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                Effective
              </p>
              <p className="mt-1 text-base font-semibold text-zinc-900">
                {formatCurrency(status?.effectiveLimit ?? budget.monthlyLimit)}
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

        <div className="flex gap-2 self-start">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex min-h-9 items-center justify-center rounded-full border border-[#ddd6c8] px-3.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-[#fbf8f1] sm:min-h-10 sm:px-4"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-rose-200 px-3.5 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-10 sm:px-4"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </div>

      <div className="mt-3.5 sm:mt-4">
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
      </div>
    </div>
  );
}

export default function BudgetCategoryDetailPage({ category }: { category: Category }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const initialMonth = isMonthValue(searchParams.get('month'))
    ? (searchParams.get('month') as string)
    : format(new Date(), 'yyyy-MM');

  const [workspace, setWorkspace] = useState<BudgetWorkspaceData>(EMPTY_WORKSPACE_DATA);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [categoryEditorState, setCategoryEditorState] = useState<CategoryEditorState | null>(null);
  const [subcategoryEditorState, setSubcategoryEditorState] = useState<SubcategoryEditorState | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [deletingBudgetId, setDeletingBudgetId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const refreshWorkspace = useCallback(async () => {
    try {
      const nextWorkspace = await loadBudgetWorkspace();
      setWorkspace(nextWorkspace);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshWorkspace();
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

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get('month') === selectedMonth) {
      return;
    }

    params.set('month', selectedMonth);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams, selectedMonth]);

  const monthOptions = useMemo(
    () => buildMonthOptions(workspace.budgets.map((budget) => budget.month), selectedMonth),
    [selectedMonth, workspace.budgets]
  );

  const categoryBudgets = useMemo(
    () =>
      workspace.budgets
        .filter(
          (budget) =>
            budget.month === selectedMonth &&
            budget.category === category &&
            isActiveBudgetRule(budget)
        )
        .sort(compareBudgetScopes),
    [category, selectedMonth, workspace.budgets]
  );

  const categoryStatuses = useMemo(
    () =>
      calculateBudgetStatuses(
        workspace.transactions,
        workspace.budgets,
        getBudgetReferenceDate(selectedMonth)
      )
        .filter((status) => status.category === category)
        .sort((first, second) =>
          compareBudgetScopes(
            {
              category: first.category,
              subCategory: first.subCategory,
            },
            {
              category: second.category,
              subCategory: second.subCategory,
            }
          )
        ),
    [category, selectedMonth, workspace.budgets, workspace.transactions]
  );

  const statusByBudgetId = useMemo(
    () => new Map(categoryStatuses.map((status) => [status.budgetId, status] as const)),
    [categoryStatuses]
  );

  const categoryBudget = categoryBudgets.find((budget) => !budget.subCategory);
  const categoryStatus = categoryBudget ? statusByBudgetId.get(categoryBudget.id) : undefined;
  const savedSubcategories = useMemo(
    () => workspace.savedSubcategories[category] ?? [],
    [category, workspace.savedSubcategories]
  );
  const categoryTrackedSpend = useMemo(
    () =>
      workspace.transactions.reduce((total, transaction) => {
        if (!transaction.date.startsWith(selectedMonth)) {
          return total;
        }
        const allocationTotal = getTransactionAllocations(transaction)
          .filter((allocation) => allocation.category === category)
          .reduce((sum, allocation) => sum + allocation.amount, 0);
        return total + allocationTotal;
      }, 0),
    [category, selectedMonth, workspace.transactions]
  );
  const coveredSubcategorySpend = useMemo(
    () =>
      workspace.transactions.reduce((total, transaction) => {
        if (!transaction.date.startsWith(selectedMonth)) {
          return total;
        }
        const allocationTotal = getTransactionAllocations(transaction)
          .filter(
            (allocation) =>
              allocation.category === category &&
              Boolean(allocation.subCategory) &&
              savedSubcategories.includes(allocation.subCategory as string)
          )
          .reduce((sum, allocation) => sum + allocation.amount, 0);
        return total + allocationTotal;
      }, 0),
    [category, savedSubcategories, selectedMonth, workspace.transactions]
  );
  const uncoveredSpend = Math.max(0, categoryTrackedSpend - coveredSubcategorySpend);

  const handleDeleteBudget = async (budget: Budget, confirmed = false) => {
    if (!confirmed) {
      setConfirmState({
        title: 'Delete budget?',
        message: `Delete the ${getBudgetLabel(budget)} budget for ${formatMonthLabel(selectedMonth)}?`,
        confirmLabel: 'Delete',
        confirmVariant: 'danger',
        onConfirm: () => {
          setConfirmState(null);
          void handleDeleteBudget(budget, true);
        },
      });
      return;
    }

    setDeletingBudgetId(budget.id);

    try {
      await deleteBudget(budget.id);
      if (categoryEditorState?.budgetId === budget.id) {
        setCategoryEditorState(null);
      }
      await refreshWorkspace();
    } finally {
      setDeletingBudgetId(null);
    }
  };

  const handleSaveCategoryBudget = async (nextState: CategoryEditorState) => {
    const previousBudget = nextState.budgetId
      ? workspace.budgets.find((budget) => budget.id === nextState.budgetId)
      : undefined;

    const nextBudget: Budget = {
      id: nextState.budgetId ?? uuidv4(),
      category,
      subCategory: undefined,
      monthlyLimit: Number.parseFloat(nextState.monthlyLimit),
      month: selectedMonth,
      rollover: nextState.rollover,
      alertThresholdsTriggered: nextState.alertThresholdsTriggered,
    };

    setSaving(true);

    try {
      await setBudget({
        ...nextBudget,
        alertThresholdsTriggered: shouldResetBudgetThresholds(previousBudget, nextBudget)
          ? []
          : previousBudget?.alertThresholdsTriggered ?? nextState.alertThresholdsTriggered,
      });
      setCategoryEditorState(null);
      await refreshWorkspace();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSubcategory = async (nextState: SubcategoryEditorState) => {
    setSaving(true);

    try {
      if (nextState.previousLabel && nextState.previousLabel !== nextState.label.trim()) {
        await renameSavedSubcategory(category, nextState.previousLabel, nextState.label);
      } else {
        await saveSavedSubcategory(category, nextState.label);
      }
      setSubcategoryEditorState(null);
      await refreshWorkspace();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSavedSubcategory = async (label: string, confirmed = false) => {
    if (!confirmed) {
      setConfirmState({
        title: 'Delete saved subcategory?',
        message: `Delete the saved subcategory "${label}" from ${category}?`,
        confirmLabel: 'Delete',
        confirmVariant: 'danger',
        onConfirm: () => {
          setConfirmState(null);
          void handleDeleteSavedSubcategory(label, true);
        },
      });
      return;
    }

    setSaving(true);

    try {
      await deleteSavedSubcategory(category, label);
      if (subcategoryEditorState?.previousLabel === label) {
        setSubcategoryEditorState(null);
      }
      await refreshWorkspace();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 pb-10 pt-4 sm:px-6 sm:pb-12 sm:pt-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href={`/budgets?month=${selectedMonth}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
          >
            <ArrowLeft size={15} />
            Back to budgets
          </Link>
          <h1 className="mt-3 font-display text-[2.15rem] font-semibold tracking-[-0.04em] text-zinc-900">
            {category}
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Keep the main category cap here, then manage the saved subcategories people can reuse
            inside this category.
          </p>
        </div>

        <div className="w-full rounded-[28px] border border-[#e3dbc9] bg-[#fbf8f1] p-3.5 shadow-[0_16px_32px_rgba(42,42,28,0.04)] sm:max-w-[28rem] sm:p-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#1D9E75]">
              <CalendarRange size={20} />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Month planner
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Review this category one month at a time.
              </p>
            </div>
          </div>

          <div className="mt-3.5 grid gap-2 sm:mt-4 sm:grid-cols-[48px_minmax(0,1fr)_48px]">
            <button
              type="button"
              onClick={() =>
                setSelectedMonth(format(addMonths(parseBudgetMonth(selectedMonth), -1), 'yyyy-MM'))
              }
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#ddd6c8] bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-[#f6f1e7]"
            >
              <ChevronLeft size={16} />
            </button>
            <select
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="min-h-11 w-full min-w-0 rounded-full border border-[#ddd6c8] bg-white px-4 text-sm text-zinc-700 outline-none transition focus:border-[#1D9E75]"
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
                setSelectedMonth(format(addMonths(parseBudgetMonth(selectedMonth), 1), 'yyyy-MM'))
              }
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#ddd6c8] bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-[#f6f1e7]"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <section className="mt-5 grid grid-cols-2 gap-3 sm:mt-6 xl:grid-cols-4">
        <div className="rounded-[24px] border border-[#e3dbc9] bg-white p-3.5 sm:rounded-[26px] sm:p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            Category cap
          </p>
          <p className="mt-2 text-[1.65rem] font-semibold tracking-[-0.04em] text-zinc-900 sm:text-2xl">
            {categoryBudget && categoryStatus ? formatCurrency(categoryStatus.configuredLimit) : 'Missing'}
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-500 sm:text-sm">
            {categoryBudget ? 'Main cap for the whole category' : 'Optional, but helpful as a parent cap'}
          </p>
        </div>
        <div className="rounded-[24px] border border-[#e3dbc9] bg-white p-3.5 sm:rounded-[26px] sm:p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            Saved subcategories
          </p>
          <p className="mt-2 text-[1.65rem] font-semibold tracking-[-0.04em] text-zinc-900 sm:text-2xl">
            {loading ? '...' : String(savedSubcategories.length)}
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-500 sm:text-sm">
            Reusable labels inside {category}
          </p>
        </div>
        <div className="rounded-[24px] border border-[#e3dbc9] bg-white p-3.5 sm:rounded-[26px] sm:p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            Tracked spend
          </p>
          <p className="mt-2 text-[1.65rem] font-semibold tracking-[-0.04em] text-zinc-900 sm:text-2xl">
            {formatCurrency(categoryTrackedSpend)}
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-500 sm:text-sm">
            Expense activity in this category this month
          </p>
        </div>
        <div className="rounded-[24px] border border-[#e3dbc9] bg-white p-3.5 sm:rounded-[26px] sm:p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            Uncovered spend
          </p>
          <p className="mt-2 text-[1.65rem] font-semibold tracking-[-0.04em] text-zinc-900 sm:text-2xl">
            {formatCurrency(uncoveredSpend)}
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-500 sm:text-sm">
            Spend not matched by a saved subcategory
          </p>
        </div>
      </section>

      <section className="mt-5 rounded-[30px] border border-[#e3dbc9] bg-white p-4 shadow-[0_20px_44px_rgba(42,42,28,0.05)] sm:mt-6 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1D9E75]">
              Category budget
            </p>
            <h2 className="mt-2 text-[1.55rem] font-semibold tracking-[-0.03em] text-zinc-900">
              {formatMonthLabel(selectedMonth)}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setCategoryEditorState(buildCategoryEditorState(categoryBudget))}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-[#1D9E75] px-5 text-sm font-medium text-white transition-colors hover:bg-[#187f5d]"
          >
            {categoryBudget ? 'Edit category cap' : 'Set category cap'}
          </button>
        </div>

        <div className="mt-4 sm:mt-5">
          {categoryEditorState ? (
            <CategoryBudgetEditor
              category={category}
              month={selectedMonth}
              state={categoryEditorState}
              onCancel={() => setCategoryEditorState(null)}
              onSave={handleSaveCategoryBudget}
              saving={saving}
            />
          ) : categoryBudget ? (
            <BudgetRuleCard
              budget={categoryBudget}
              status={categoryStatus}
              onEdit={() => setCategoryEditorState(buildCategoryEditorState(categoryBudget))}
              onDelete={() => void handleDeleteBudget(categoryBudget)}
              deleting={deletingBudgetId === categoryBudget.id}
            />
          ) : (
            <div className="rounded-[28px] border border-dashed border-[#d9d1c2] bg-[#fbf8f1] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1D9E75]">
                  <PiggyBank size={20} />
                </span>
                <div>
                  <p className="text-base font-semibold text-zinc-900">No category-wide cap yet</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    That is okay. Saved subcategories can still live here, and you can add a parent
                    cap later if this category needs one top line.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {uncoveredSpend > 0 ? (
          <div className="mt-4 rounded-[24px] border border-[#e8dfd0] bg-[#fbf8f1] p-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-600">
                <ShieldAlert size={20} />
              </span>
              <div>
                <p className="text-base font-semibold text-zinc-900">Some spend is still uncovered</p>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {formatCurrency(uncoveredSpend)} in {category} is not matched by a saved
                  subcategory yet. Add the labels you actually use so expense entry becomes faster and
                  your uncovered-spend warnings get clearer.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="mt-5 rounded-[30px] border border-[#e3dbc9] bg-white p-4 shadow-[0_20px_44px_rgba(42,42,28,0.05)] sm:mt-6 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1D9E75]">
              Saved subcategories
            </p>
            <h2 className="mt-2 text-[1.55rem] font-semibold tracking-[-0.03em] text-zinc-900">
              Inside {category}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              These labels feed the expense modal so people can choose an existing subcategory or add
              a new one without creating extra budget rules.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSubcategoryEditorState(buildSubcategoryEditorState())}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-[#d8ceb8] bg-[#fbf8f1] px-5 text-sm font-medium text-zinc-800 transition-colors hover:bg-[#f4efe4]"
          >
            <Plus size={14} />
            Add subcategory
          </button>
        </div>

        <div className="mt-5">
          {subcategoryEditorState ? (
            <div className="mb-4">
              <SubcategoryBudgetEditor
                category={category}
                month={selectedMonth}
                state={subcategoryEditorState}
                onCancel={() => setSubcategoryEditorState(null)}
                onSave={handleSaveSubcategory}
                saving={saving}
              />
            </div>
          ) : null}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className="h-32 animate-pulse rounded-[28px] border border-[#ebe3d5] bg-[#fbf8f1]"
                />
              ))}
            </div>
          ) : savedSubcategories.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-[#d9d1c2] bg-[#fbf8f1] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1D9E75]">
                  <PiggyBank size={20} />
                </span>
                <div>
                  <p className="text-base font-semibold text-zinc-900">No saved subcategories yet</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    Add the labels you actually use in expenses. Keeping this empty is still a clean
                    setup.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {savedSubcategories.map((label) => (
                <div
                  key={label}
                  className="flex flex-col gap-3 rounded-[26px] border border-[#e8dfd0] bg-white p-4 shadow-[0_16px_34px_rgba(42,42,28,0.04)] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-base font-semibold text-zinc-900">{label}</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-500">
                      Available in add expense, edit expense, and split rows for {category}.
                    </p>
                  </div>
                  <div className="flex gap-2 self-start">
                    <button
                      type="button"
                      onClick={() => setSubcategoryEditorState(buildSubcategoryEditorState(label))}
                      className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#ddd6c8] px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-[#fbf8f1]"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteSavedSubcategory(label)}
                      disabled={saving}
                      className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-rose-200 px-4 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <ConfirmModal
        open={Boolean(confirmState)}
        title={confirmState?.title ?? ''}
        message={confirmState?.message ?? ''}
        confirmLabel={confirmState?.confirmLabel ?? 'Confirm'}
        confirmVariant={confirmState?.confirmVariant}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          if (!confirmState) {
            return;
          }
          void confirmState.onConfirm();
        }}
      />
    </div>
  );
}
