'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { addMonths, format, startOfMonth } from 'date-fns';
import ConfirmModal from '@/components/ConfirmModal';
import {
  AlertTriangle,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Copy,
  PiggyBank,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Target,
  Trash2,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import {
  buildBudgetMonthSummary,
  calculateBudgetStatuses,
  compareBudgetScopes,
  getBudgetLabel,
  getBudgetReferenceDate,
  getBudgetScopeKey,
  getOverlappingBudgetIds,
  isActiveBudgetRule,
  parseBudgetMonth,
  shouldResetBudgetThresholds,
} from '@/lib/budgeting';
import {
  deleteBudget,
  getBudgets,
  getSavedSubcategoryRegistry,
  getTransactions,
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

interface NoticeState {
  title: string;
  message: string;
}

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

function buildEditorState(mode: EditorMode, budget?: Budget): BudgetEditorState {
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
            {isEditing
              ? 'Amount and rollover edits stay simple. Subcategory rules now live inside each category page so the main workspace stays focused.'
              : `Saving for ${formatMonthLabel(month)} keeps one category-wide rule per month.`}
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
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                category: event.target.value as Category | 'Overall',
                subCategory: event.target.value === 'Overall' ? '' : current.subCategory,
              }))
            }
            className="mt-2 min-h-11 w-full rounded-2xl border border-[#ddd6c8] bg-white px-4 text-sm text-zinc-700 outline-none transition focus:border-[#1D9E75]"
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
              Category edits are allowed, but changing the scope will ask before replacing the old
              rule.
            </p>
          ) : null}
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
              Rollover keeps the same scope and brings unused room forward. Threshold alerts still
              watch the 50%, 80%, and 100% lines.
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
          {saving ? 'Saving...' : isEditing ? 'Save changes' : 'Save budget'}
        </button>
      </div>
    </form>
  );
}

function SummaryTile({
  label,
  value,
  helper,
  accent = false,
}: {
  label: string;
  value: string;
  helper: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[24px] border p-3.5 sm:rounded-[26px] sm:p-4 ${
        accent ? 'border-emerald-200 bg-emerald-50/80' : 'border-[#e3dbc9] bg-white'
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p className="mt-2 text-[1.65rem] font-semibold tracking-[-0.04em] text-zinc-900 sm:text-2xl">
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-zinc-500 sm:text-sm">{helper}</p>
    </div>
  );
}

function BudgetRuleCard({
  budget,
  status,
  onEdit,
  onDelete,
  deleting,
  overlapping,
}: {
  budget: Budget;
  status: BudgetStatus | undefined;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
  overlapping?: boolean;
}) {
  const percentage = status ? Math.min(status.percentage, 100) : 0;
  const isScoped = budget.category !== 'Overall';
  const scopeKind =
    budget.category === 'Overall' ? 'Month anchor' : budget.subCategory ? 'Subcategory' : 'Category-wide';

  return (
    <div className="rounded-[26px] border border-[#e8dfd0] bg-white p-3.5 shadow-[0_16px_34px_rgba(42,42,28,0.04)] sm:rounded-[28px] sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-zinc-900">
              {getBudgetLabel(budget)}
            </h3>
            <span className="inline-flex rounded-full bg-[#fbf8f1] px-2.5 py-1 text-xs font-medium text-zinc-600">
              {scopeKind}
            </span>
            {budget.rollover ? (
              <span className="inline-flex rounded-full bg-[#eef7f0] px-2.5 py-1 text-xs font-medium text-[#1D9E75]">
                Rollover on
              </span>
            ) : null}
            {overlapping ? (
              <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                Overlap warning
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
        <div className="mt-2 space-y-1">
          {status?.rolloverCarry ? (
            <p className="text-xs leading-5 text-emerald-700">
              Includes {formatCurrency(status.rolloverCarry)} rolled forward from last month.
            </p>
          ) : null}
          {overlapping && isScoped ? (
            <p className="text-xs leading-5 text-amber-700">
              This overlaps with another rule in the same category. Planning totals only count the
              category-wide cap when both parent and child rules exist.
            </p>
          ) : null}
          {status && status.projectedOverage > 0 && status.status !== 'critical' ? (
            <p className="text-xs leading-5 text-amber-700">
              At this pace, month-end spend lands around {formatCurrency(status.projectedSpent)}.
            </p>
          ) : !overlapping ? (
            <p className="text-xs leading-5 text-zinc-500">
              Alerts are based on actual usage against the effective limit for this month.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface CategoryBudgetGroup {
  category: Category;
  categoryBudget?: Budget;
  savedSubcategoryCount: number;
  totalTrackedSpend: number;
  hasOverlap: boolean;
}

function CategoryBudgetCard({
  month,
  group,
  status,
  onEditCategoryBudget,
  onDeleteCategoryBudget,
  deleting,
}: {
  month: string;
  group: CategoryBudgetGroup;
  status: BudgetStatus | undefined;
  onEditCategoryBudget: () => void;
  onDeleteCategoryBudget: () => void;
  deleting: boolean;
}) {
  const detailHref = `/budgets/${encodeURIComponent(group.category)}?month=${month}`;

  return (
    <div className="rounded-[26px] border border-[#e8dfd0] bg-white p-4 shadow-[0_16px_34px_rgba(42,42,28,0.04)] sm:rounded-[28px] sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-zinc-900">
              {group.category}
            </h3>
            {group.categoryBudget ? (
              <span className="inline-flex rounded-full bg-[#fbf8f1] px-2.5 py-1 text-xs font-medium text-zinc-600">
                Category-wide cap
              </span>
            ) : null}
            {group.hasOverlap ? (
              <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                Overlap warning
              </span>
            ) : null}
            {status ? (
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getBudgetStatusTone(status)}`}
              >
                {getBudgetStatusLabel(status)}
              </span>
            ) : null}
          </div>

          <p className="mt-3 text-sm leading-6 text-zinc-500">
            Keep the main category cap here, then open the detail page to manage saved
            subcategories inside it.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-[#eee5d6] bg-[#fbf8f1] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                Category cap
              </p>
              <p className="mt-1 text-base font-semibold text-zinc-900">
                {group.categoryBudget && status
                  ? formatCurrency(status.configuredLimit)
                  : group.categoryBudget
                    ? formatCurrency(group.categoryBudget.monthlyLimit)
                    : 'Not set'}
              </p>
            </div>
            <div className="rounded-2xl border border-[#eee5d6] bg-[#fbf8f1] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                Tracked spend
              </p>
              <p className="mt-1 text-base font-semibold text-zinc-900">
                {formatCurrency(group.totalTrackedSpend)}
              </p>
            </div>
            <div className="rounded-2xl border border-[#eee5d6] bg-[#fbf8f1] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                Saved subcategories
              </p>
              <p className="mt-1 text-base font-semibold text-zinc-900">{group.savedSubcategoryCount}</p>
            </div>
            <div className="rounded-2xl border border-[#eee5d6] bg-[#fbf8f1] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                Effective room
              </p>
              <p className="mt-1 text-base font-semibold text-zinc-900">
                {group.categoryBudget && status
                  ? formatCurrency(status.effectiveLimit)
                  : group.categoryBudget
                    ? formatCurrency(group.categoryBudget.monthlyLimit)
                    : 'Open detail'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 self-start">
          <Link
            href={detailHref}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-[#ddd6c8] px-4 text-sm font-medium text-zinc-800 transition-colors hover:bg-[#fbf8f1]"
          >
            View details
            <ChevronRight size={15} />
          </Link>
          <button
            type="button"
            onClick={onEditCategoryBudget}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#ddd6c8] px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-[#fbf8f1]"
          >
            Edit cap
          </button>
          <button
            type="button"
            onClick={onDeleteCategoryBudget}
            disabled={deleting}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-rose-200 px-4 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BudgetsClientPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const initialMonth = isMonthValue(searchParams.get('month'))
    ? (searchParams.get('month') as string)
    : format(new Date(), 'yyyy-MM');

  const [workspace, setWorkspace] = useState<BudgetWorkspaceData>(EMPTY_WORKSPACE_DATA);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [editorState, setEditorState] = useState<BudgetEditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [deletingBudgetId, setDeletingBudgetId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [noticeState, setNoticeState] = useState<NoticeState | null>(null);

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

  const selectedMonthBudgets = useMemo(
    () =>
      workspace.budgets
        .filter((budget) => budget.month === selectedMonth && isActiveBudgetRule(budget))
        .sort(compareBudgetScopes),
    [selectedMonth, workspace.budgets]
  );

  const selectedMonthStatuses = useMemo(
    () =>
      calculateBudgetStatuses(
        workspace.transactions,
        workspace.budgets,
        getBudgetReferenceDate(selectedMonth)
      ).sort((first, second) =>
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
    [selectedMonth, workspace.budgets, workspace.transactions]
  );

  const statusByBudgetId = useMemo(
    () =>
      new Map<string, BudgetStatus>(
        selectedMonthStatuses.map((status) => [status.budgetId, status] as const)
      ),
    [selectedMonthStatuses]
  );

  const summary = useMemo(
    () => buildBudgetMonthSummary(workspace.transactions, workspace.budgets, selectedMonth),
    [selectedMonth, workspace.budgets, workspace.transactions]
  );

  const overlappingBudgetIds = useMemo(
    () => getOverlappingBudgetIds(selectedMonthBudgets),
    [selectedMonthBudgets]
  );

  const overallBudget =
    selectedMonthBudgets.find((budget) => budget.category === 'Overall' && !budget.subCategory) ??
    selectedMonthBudgets.find((budget) => budget.category === 'Overall');
  const overallStatus = overallBudget ? statusByBudgetId.get(overallBudget.id) : undefined;
  const categoryGroups = useMemo(() => {
    const groups = new Map<Category, CategoryBudgetGroup>();

    for (const budget of selectedMonthBudgets) {
      if (budget.category === 'Overall') {
        continue;
      }

      const existing =
        groups.get(budget.category) ??
        ({
          category: budget.category,
          savedSubcategoryCount: workspace.savedSubcategories[budget.category]?.length ?? 0,
          totalTrackedSpend: 0,
          hasOverlap: false,
        } satisfies CategoryBudgetGroup);

      existing.categoryBudget = budget;

      const status = statusByBudgetId.get(budget.id);
      existing.totalTrackedSpend += status?.spent ?? 0;
      existing.hasOverlap = existing.hasOverlap || overlappingBudgetIds.has(budget.id);
      groups.set(budget.category, existing);
    }

    return Array.from(groups.values()).sort((left, right) =>
      left.category.localeCompare(right.category)
    );
  }, [overlappingBudgetIds, selectedMonthBudgets, statusByBudgetId, workspace.savedSubcategories]);
  const hasAnyBudgets = workspace.budgets.length > 0;

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

  const handleSaveBudget = async (nextState: BudgetEditorState, confirmedScopeMove = false) => {
    const previousBudget = nextState.budgetId
      ? workspace.budgets.find((budget) => budget.id === nextState.budgetId)
      : undefined;
    const normalizedSubCategory =
      nextState.category === 'Overall' ? undefined : nextState.subCategory.trim() || undefined;

    const nextBudget: Budget = {
      id: nextState.budgetId ?? uuidv4(),
      category: nextState.category,
      subCategory: normalizedSubCategory,
      monthlyLimit: Number.parseFloat(nextState.monthlyLimit),
      month: selectedMonth,
      rollover: nextState.rollover,
      alertThresholdsTriggered: nextState.alertThresholdsTriggered,
    };

    const scopeChanged =
      previousBudget && getBudgetScopeKey(previousBudget) !== getBudgetScopeKey(nextBudget);
    const conflictingBudget = workspace.budgets.find(
      (budget) =>
        budget.id !== nextBudget.id &&
        budget.month === nextBudget.month &&
        budget.category === nextBudget.category &&
        (budget.subCategory || '') === (nextBudget.subCategory || '')
    );

    if (scopeChanged && !confirmedScopeMove) {
      setConfirmState({
        title: 'Move budget rule?',
        message: `Move this rule to ${getBudgetLabel(nextBudget)} for ${formatMonthLabel(selectedMonth)}? ${
          conflictingBudget
            ? 'The existing rule in that scope will be replaced.'
            : 'The old scope will be replaced by this new one.'
        }`,
        confirmLabel: 'Move rule',
        confirmVariant: 'warning',
        onConfirm: () => {
          setConfirmState(null);
          void handleSaveBudget(nextState, true);
        },
      });
      return;
    }

    setSaving(true);

    try {
      if (conflictingBudget) {
        await deleteBudget(conflictingBudget.id);
      }

      await setBudget({
        ...nextBudget,
        alertThresholdsTriggered: shouldResetBudgetThresholds(previousBudget, nextBudget)
          ? []
          : previousBudget?.alertThresholdsTriggered ?? nextState.alertThresholdsTriggered,
      });

      setEditorState(null);
      await refreshWorkspace();
    } finally {
      setSaving(false);
    }
  };

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
      if (editorState?.budgetId === budget.id) {
        setEditorState(null);
      }
      await refreshWorkspace();
    } finally {
      setDeletingBudgetId(null);
    }
  };

  const handleCopyPreviousMonth = async (confirmedReplace = false) => {
    const previousMonth = format(addMonths(parseBudgetMonth(selectedMonth), -1), 'yyyy-MM');
    const sourceBudgets = workspace.budgets.filter(
      (budget) => budget.month === previousMonth && isActiveBudgetRule(budget)
    );
    const targetMonthBudgets = workspace.budgets.filter((budget) => budget.month === selectedMonth);

    if (sourceBudgets.length === 0) {
      setNoticeState({
        title: 'Nothing to copy yet',
        message: `No budgets found for ${formatMonthLabel(previousMonth)} yet.`,
      });
      return;
    }

    if (targetMonthBudgets.length > 0 && !confirmedReplace) {
      setConfirmState({
        title: 'Replace month setup?',
        message: `Replace all ${targetMonthBudgets.length} budget rule${
          targetMonthBudgets.length === 1 ? '' : 's'
        } in ${formatMonthLabel(selectedMonth)} with the setup from ${formatMonthLabel(previousMonth)}?`,
        confirmLabel: 'Replace month',
        confirmVariant: 'warning',
        onConfirm: () => {
          setConfirmState(null);
          void handleCopyPreviousMonth(true);
        },
      });
      return;
    }

    setCopying(true);

    try {
      await Promise.all(targetMonthBudgets.map((budget) => deleteBudget(budget.id)));

      for (const sourceBudget of sourceBudgets) {
        await setBudget({
          ...sourceBudget,
          id: uuidv4(),
          month: selectedMonth,
          alertThresholdsTriggered: [],
        });
      }

      setEditorState(null);
      await refreshWorkspace();
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 pb-10 pt-4 sm:px-6 sm:pb-12 sm:pt-5">
      <header className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-[2.15rem] font-semibold tracking-[-0.04em] text-zinc-900">
            Budgets
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Review one month at a time, keep Overall as the anchor, and add category guardrails only
            where they help.
          </p>
        </div>

        <div className="w-full rounded-[28px] border border-[#e3dbc9] bg-[#fbf8f1] p-3.5 shadow-[0_16px_32px_rgba(42,42,28,0.04)] sm:max-w-[32rem] sm:p-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#1D9E75]">
              <CalendarRange size={20} />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Month planner
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Move month by month, or copy the last setup forward before you fine-tune it.
              </p>
            </div>
          </div>

          <div className="mt-3.5 grid gap-2 sm:mt-4 sm:grid-cols-[48px_minmax(0,1fr)_48px_auto]">
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

            <button
              type="button"
              onClick={() => void handleCopyPreviousMonth()}
              disabled={copying}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-[#d8ceb8] bg-white px-4 text-sm font-medium text-zinc-800 transition-colors hover:bg-[#f6f1e7] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Copy size={14} />
              {copying ? 'Copying...' : 'Copy previous month'}
            </button>
          </div>
        </div>
      </header>

      <section className="mt-5 grid grid-cols-2 gap-3 sm:mt-6 xl:grid-cols-5">
        <SummaryTile
          label="Configured"
          value={loading ? '...' : String(summary.scopedBudgetCount)}
          helper={`Rules active for ${formatMonthLabel(selectedMonth)}`}
        />
        <SummaryTile
          label="Overall cap"
          value={
            loading
              ? '...'
              : summary.hasOverallBudget
                ? formatCurrency(summary.overallConfiguredLimit)
                : 'Missing'
          }
          helper={
            summary.hasOverallBudget
              ? `${formatCurrency(summary.overallEffectiveLimit)} effective this month`
              : 'Add this first to anchor the month'
          }
          accent={summary.hasOverallBudget}
        />
        <SummaryTile
          label="Category plan"
          value={loading ? '...' : formatCurrency(summary.additiveCategoryPlannedTotal)}
          helper={
            summary.hasPlanningMismatch
              ? `${formatCurrency(summary.planningMismatchAmount)} above the Overall plan`
              : 'Additive total after overlap rules'
          }
          accent={summary.hasPlanningMismatch}
        />
        <SummaryTile
          label="Watchlist"
          value={loading ? '...' : String(summary.atRiskCount)}
          helper={
            summary.criticalCount > 0
              ? `${summary.criticalCount} already over limit`
              : 'No rule is over the line right now'
          }
        />
        <SummaryTile
          label="Coverage"
          value={loading ? '...' : formatCurrency(summary.uncoveredSpendTotal)}
          helper={
            summary.topUncoveredCategory
              ? `${summary.topUncoveredCategory.category} needs a guardrail`
              : 'Tracked category spend is covered'
          }
          accent={summary.uncoveredSpendTotal > 0}
        />
      </section>

      {summary.hasPlanningMismatch ? (
        <section className="mt-5 rounded-[26px] border border-amber-200 bg-amber-50/90 p-4 sm:mt-6">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-600">
              <AlertTriangle size={20} />
            </span>
            <div>
              <p className="text-base font-semibold text-zinc-900">Category plans are above the Overall cap</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                The category plan totals {formatCurrency(summary.additiveCategoryPlannedTotal)}, which
                is {formatCurrency(summary.planningMismatchAmount)} over your Overall budget. We keep
                it as a warning so you can choose whether the month needs a looser top cap or tighter
                category rules.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {summary.overlapCount > 0 ? (
        <section className="mt-5 rounded-[26px] border border-amber-200 bg-white p-4 sm:mt-6">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <ShieldAlert size={20} />
            </span>
            <div>
              <p className="text-base font-semibold text-zinc-900">Some category rules overlap</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                When a category-wide rule and a subcategory rule exist together, planning totals count
                only the category-wide cap to avoid double-counting coverage.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {!loading && !hasAnyBudgets ? (
        <section className="mt-5 rounded-[28px] border border-[#e3dbc9] bg-[#fbf8f1] p-4 sm:mt-6 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1D9E75]">
              <Target size={20} />
            </span>
            <div className="max-w-3xl">
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-zinc-900">
                Start with the Overall budget
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Give the month one clear ceiling first. Category budgets can stay optional until a
                specific spending lane needs tighter protection.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="mt-5 rounded-[30px] border border-[#e3dbc9] bg-white p-4 shadow-[0_20px_44px_rgba(42,42,28,0.05)] sm:mt-6 sm:p-6">
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

        <div className="mt-4 sm:mt-5">
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
            <div className="rounded-[28px] border border-dashed border-[#d9d1c2] bg-[#fbf8f1] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1D9E75]">
                  <PiggyBank size={20} />
                </span>
                <div>
                  <p className="text-base font-semibold text-zinc-900">
                    No Overall budget yet for {formatMonthLabel(selectedMonth)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    Category budgets can still work without it, but the month is easier to understand
                    once one clear top cap exists first.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {summary.uncoveredSpendTotal > 0 ? (
          <div className="mt-4 rounded-[24px] border border-[#e8dfd0] bg-[#fbf8f1] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Coverage hint
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              {formatCurrency(summary.uncoveredSpendTotal)} of this month&apos;s spending is outside your
              category rules. That does not hurt the Overall budget, but it means some lanes are still
              running without a dedicated guardrail.
            </p>
          </div>
        ) : null}
      </section>

      <section className="mt-5 rounded-[30px] border border-[#e3dbc9] bg-white p-4 shadow-[0_20px_44px_rgba(42,42,28,0.05)] sm:mt-6 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1D9E75]">
              Category budgets
            </p>
            <h2 className="mt-2 text-[1.55rem] font-semibold tracking-[-0.03em] text-zinc-900">
              By category
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Keep this page focused on main category caps. Open a category to manage its saved
              subcategories and uncovered spending.
            </p>
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

        {summary.uncoveredCategories.length > 0 ? (
          <div className="mt-5 rounded-[26px] border border-[#e8dfd0] bg-[#fbf8f1] p-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-600">
                <ShieldAlert size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-zinc-900">Uncovered spending</p>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  These categories have spending this month but no category budget coverage yet.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {summary.uncoveredCategories.slice(0, 4).map((item) => (
                    <div
                      key={item.category}
                      className="rounded-2xl border border-[#e4dbc9] bg-white px-4 py-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-zinc-900">{item.category}</span>
                        <span className="text-zinc-600">{formatCurrency(item.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

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
                  className="h-32 animate-pulse rounded-[28px] border border-[#ebe3d5] bg-[#fbf8f1]"
                />
              ))}
            </div>
          ) : categoryGroups.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-[#d9d1c2] bg-[#fbf8f1] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1D9E75]">
                  <ShieldCheck size={20} />
                </span>
                <div>
                  <p className="text-base font-semibold text-zinc-900">No category budgets yet</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    That is still a valid setup. One Overall budget is enough for a clean start, and
                    category rules can be added only where you want extra guardrails.
                  </p>
                  {!summary.hasOverallBudget ? (
                    <p className="mt-3 text-sm leading-6 text-amber-700">
                      If you keep category-only budgets, add an Overall cap when you want one clean
                      month anchor for the rest of the app.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {categoryGroups.map((group) => (
                <CategoryBudgetCard
                  key={group.category}
                  month={selectedMonth}
                  group={group}
                  status={group.categoryBudget ? statusByBudgetId.get(group.categoryBudget.id) : undefined}
                  onEditCategoryBudget={() =>
                    group.categoryBudget ? openCategoryEdit(group.categoryBudget) : undefined
                  }
                  onDeleteCategoryBudget={() =>
                    group.categoryBudget ? void handleDeleteBudget(group.categoryBudget) : undefined
                  }
                  deleting={group.categoryBudget ? deletingBudgetId === group.categoryBudget.id : false}
                />
              ))}
            </div>
          )}
        </div>

        {!summary.hasOverallBudget && categoryGroups.length > 0 ? (
          <div className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50/80 p-4">
            <p className="text-sm font-semibold text-zinc-900">Category rules exist without an Overall cap</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              This is allowed, but the dashboard, savings history, and coaching are clearer once the
              month also has one Overall budget.
            </p>
          </div>
        ) : null}
      </section>

      <div className="mt-6 text-sm text-zinc-500">
        Need deeper setup help? You can still review payday and account context in{' '}
        <Link href="/settings?section=payday" className="font-medium text-[#1D9E75] hover:underline">
          Settings
        </Link>
        .
      </div>

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

      <ConfirmModal
        open={Boolean(noticeState)}
        title={noticeState?.title ?? ''}
        message={noticeState?.message ?? ''}
        confirmLabel="OK"
        confirmVariant="warning"
        onCancel={() => setNoticeState(null)}
        onConfirm={() => setNoticeState(null)}
      />
    </div>
  );
}
