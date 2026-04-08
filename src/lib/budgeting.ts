import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import type {
  Budget,
  BudgetCrossPageSignals,
  BudgetMonthSummary,
  BudgetStatus,
  Category,
  Transaction,
} from './types';

export const BUDGET_ALERT_THRESHOLDS = [50, 80, 100] as const;

type Allocation = {
  category: Category;
  subCategory?: string;
  amount: number;
};

type ResolvedBudgetLimit = {
  configuredLimit: number;
  effectiveLimit: number;
  rolloverCarry: number;
};

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

export function parseBudgetMonth(value: string): Date {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

export function getBudgetReferenceDate(month: string): Date {
  const today = new Date();
  const currentMonth = format(today, 'yyyy-MM');

  if (month === currentMonth) {
    return today;
  }

  const parsedMonth = parseBudgetMonth(month);
  return month < currentMonth ? endOfMonth(parsedMonth) : startOfMonth(parsedMonth);
}

export function getBudgetScopeKey(budget: Pick<Budget, 'month' | 'category' | 'subCategory'>): string {
  return `${budget.month}|${budget.category}|${budget.subCategory || ''}`;
}

export function isActiveBudgetRule(budget: Pick<Budget, 'subCategory'>): boolean {
  return !budget.subCategory;
}

export function getBudgetLabel(
  budget: Pick<BudgetStatus | Budget, 'category' | 'subCategory'>
): string {
  return budget.subCategory ? `${budget.category} - ${budget.subCategory}` : budget.category;
}

export function compareBudgetScopes(
  first: Pick<Budget, 'category' | 'subCategory'>,
  second: Pick<Budget, 'category' | 'subCategory'>
): number {
  if (first.category === 'Overall' && second.category !== 'Overall') return -1;
  if (first.category !== 'Overall' && second.category === 'Overall') return 1;

  if (first.category !== second.category) {
    return first.category.localeCompare(second.category);
  }

  const firstHasSubCategory = Boolean(first.subCategory);
  const secondHasSubCategory = Boolean(second.subCategory);

  if (firstHasSubCategory !== secondHasSubCategory) {
    return firstHasSubCategory ? 1 : -1;
  }

  return (first.subCategory || '').localeCompare(second.subCategory || '');
}

function isExpenseTransaction(transaction: Transaction): boolean {
  return transaction.type === 'expense' && !transaction.transferGroupId;
}

export function getTransactionAllocations(transaction: Transaction): Allocation[] {
  if (Array.isArray(transaction.split) && transaction.split.length > 0) {
    return transaction.split.map((line) => ({
      category: line.category,
      subCategory: line.subCategory,
      amount: line.amount,
    }));
  }

  return [
    {
      category: transaction.category,
      subCategory: transaction.subCategory,
      amount: transaction.amount,
    },
  ];
}

function getBudgetSpentForMonth(
  transactions: Transaction[],
  budget: Budget,
  month: string
): number {
  const monthTransactions = transactions.filter(
    (transaction) => transaction.date.startsWith(month) && isExpenseTransaction(transaction)
  );

  if (budget.category === 'Overall') {
    return roundMoney(
      monthTransactions.reduce((sum, transaction) => sum + transaction.amount, 0)
    );
  }

  let spent = 0;
  for (const transaction of monthTransactions) {
    for (const allocation of getTransactionAllocations(transaction)) {
      if (allocation.category !== budget.category) continue;
      if (budget.subCategory && (allocation.subCategory || '') !== budget.subCategory) {
        continue;
      }
      spent += allocation.amount;
    }
  }

  return roundMoney(spent);
}

export function resolveBudgetLimit(
  budget: Budget,
  budgets: Budget[],
  transactions: Transaction[],
  memo: Map<string, ResolvedBudgetLimit> = new Map()
): ResolvedBudgetLimit {
  const key = getBudgetScopeKey(budget);
  const cached = memo.get(key);
  if (cached) {
    return cached;
  }

  const configuredLimit = roundMoney(budget.monthlyLimit);

  if (!budget.rollover) {
    const resolved = {
      configuredLimit,
      effectiveLimit: configuredLimit,
      rolloverCarry: 0,
    };
    memo.set(key, resolved);
    return resolved;
  }

  const previousMonth = format(subMonths(parseBudgetMonth(budget.month), 1), 'yyyy-MM');
  const previousBudget = budgets.find(
    (candidate) =>
      candidate.month === previousMonth &&
      candidate.category === budget.category &&
      (candidate.subCategory || '') === (budget.subCategory || '')
  );

  if (!previousBudget) {
    const resolved = {
      configuredLimit,
      effectiveLimit: configuredLimit,
      rolloverCarry: 0,
    };
    memo.set(key, resolved);
    return resolved;
  }

  const previousResolved = resolveBudgetLimit(previousBudget, budgets, transactions, memo);
  const previousSpent = getBudgetSpentForMonth(transactions, previousBudget, previousMonth);
  const rolloverCarry = roundMoney(
    Math.max(0, previousResolved.effectiveLimit - previousSpent)
  );

  const resolved = {
    configuredLimit,
    effectiveLimit: roundMoney(configuredLimit + rolloverCarry),
    rolloverCarry,
  };
  memo.set(key, resolved);
  return resolved;
}

export function calculateBudgetStatuses(
  transactions: Transaction[],
  budgets: Budget[],
  referenceDate: Date = new Date()
): BudgetStatus[] {
  const month = format(referenceDate, 'yyyy-MM');
  const dayOfMonth = Math.max(1, referenceDate.getDate());
  const daysInMonth = endOfMonth(referenceDate).getDate();
  const rolloverMemo = new Map<string, ResolvedBudgetLimit>();

  return budgets
    .filter((budget) => budget.month === month && isActiveBudgetRule(budget))
    .map((budget) => {
      const spent = getBudgetSpentForMonth(transactions, budget, month);
      const { configuredLimit, effectiveLimit, rolloverCarry } = resolveBudgetLimit(
        budget,
        budgets,
        transactions,
        rolloverMemo
      );
      const remaining = roundMoney(effectiveLimit - spent);
      const percentage = effectiveLimit > 0 ? (spent / effectiveLimit) * 100 : 0;
      const projectedSpent = roundMoney((spent / dayOfMonth) * daysInMonth);
      const projectedOverage = roundMoney(Math.max(0, projectedSpent - effectiveLimit));

      let status: BudgetStatus['status'] = 'safe';
      if (percentage >= 100) status = 'critical';
      else if (percentage >= 80) status = 'warning';

      return {
        budgetId: budget.id,
        category: budget.category,
        subCategory: budget.subCategory,
        configuredLimit,
        effectiveLimit,
        rolloverCarry,
        spent,
        remaining,
        percentage,
        projectedSpent,
        projectedOverage,
        status,
      };
    });
}

export function getOverlappingBudgetIds(budgets: Budget[]): Set<string> {
  void budgets;
  return new Set<string>();
}

function getAdditiveCategoryPlannedTotal(budgets: Budget[]): number {
  const scopedBudgets = budgets.filter(
    (budget): budget is Budget & { category: Category } =>
      budget.category !== 'Overall' && isActiveBudgetRule(budget)
  );
  return roundMoney(scopedBudgets.reduce((sum, budget) => sum + budget.monthlyLimit, 0));
}

export function getUncoveredSpendingByCategory(
  transactions: Transaction[],
  budgets: Budget[],
  month: string
): Array<{ category: Category; amount: number }> {
  const scopedBudgets = budgets.filter(
    (budget): budget is Budget & { category: Category } =>
      budget.month === month && budget.category !== 'Overall' && isActiveBudgetRule(budget)
  );

  const categoryCoverage = new Set<Category>();
  const subCategoryCoverage = new Set<string>();

  for (const budget of scopedBudgets) {
    if (budget.subCategory) {
      subCategoryCoverage.add(`${budget.category}|${budget.subCategory}`);
    } else {
      categoryCoverage.add(budget.category);
    }
  }

  const uncovered = new Map<Category, number>();
  const monthTransactions = transactions.filter(
    (transaction) => transaction.date.startsWith(month) && isExpenseTransaction(transaction)
  );

  for (const transaction of monthTransactions) {
    for (const allocation of getTransactionAllocations(transaction)) {
      const exactKey = `${allocation.category}|${allocation.subCategory || ''}`;
      const covered =
        categoryCoverage.has(allocation.category) || subCategoryCoverage.has(exactKey);

      if (covered) {
        continue;
      }

      uncovered.set(
        allocation.category,
        roundMoney((uncovered.get(allocation.category) || 0) + allocation.amount)
      );
    }
  }

  return Array.from(uncovered.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((left, right) => right.amount - left.amount);
}

export function buildBudgetMonthSummary(
  transactions: Transaction[],
  budgets: Budget[],
  month: string
): BudgetMonthSummary {
  const monthBudgets = budgets
    .filter((budget) => budget.month === month && isActiveBudgetRule(budget))
    .sort(compareBudgetScopes);
  const statuses = calculateBudgetStatuses(transactions, budgets, getBudgetReferenceDate(month));
  const overlappingBudgetIds = getOverlappingBudgetIds(monthBudgets);
  const uncoveredCategories = getUncoveredSpendingByCategory(transactions, budgets, month);
  const overallBudget =
    monthBudgets.find((budget) => budget.category === 'Overall' && !budget.subCategory) ??
    monthBudgets.find((budget) => budget.category === 'Overall');
  const overallStatus = overallBudget
    ? statuses.find((status) => status.budgetId === overallBudget.id)
    : undefined;
  const additiveCategoryPlannedTotal = getAdditiveCategoryPlannedTotal(monthBudgets);
  const overallConfiguredLimit = overallBudget?.monthlyLimit ?? 0;
  const overallEffectiveLimit = overallStatus?.effectiveLimit ?? overallConfiguredLimit;
  const hasPlanningMismatch =
    overallConfiguredLimit > 0 && additiveCategoryPlannedTotal > overallConfiguredLimit;

  return {
    month,
    hasOverallBudget: Boolean(overallBudget),
    overallConfiguredLimit: roundMoney(overallConfiguredLimit),
    overallEffectiveLimit: roundMoney(overallEffectiveLimit),
    additiveCategoryPlannedTotal,
    scopedBudgetCount: monthBudgets.length,
    rolloverEnabledCount: monthBudgets.filter((budget) => budget.rollover).length,
    overlapCount: overlappingBudgetIds.size,
    atRiskCount: statuses.filter((status) => status.status !== 'safe').length,
    criticalCount: statuses.filter((status) => status.status === 'critical').length,
    uncoveredSpendTotal: roundMoney(
      uncoveredCategories.reduce((sum, item) => sum + item.amount, 0)
    ),
    uncoveredCategories,
    topUncoveredCategory: uncoveredCategories[0] ?? null,
    hasPlanningMismatch,
    planningMismatchAmount: hasPlanningMismatch
      ? roundMoney(additiveCategoryPlannedTotal - overallConfiguredLimit)
      : 0,
  };
}

export function buildBudgetCrossPageSignals(
  summary: BudgetMonthSummary,
  statuses: BudgetStatus[]
): BudgetCrossPageSignals {
  const topRiskBudget =
    [...statuses]
      .filter((status) => status.category !== 'Overall')
      .filter((status) => status.status !== 'safe' || status.projectedOverage > 0)
      .sort((left, right) => {
        const leftSeverity = left.status === 'critical' ? 2 : left.status === 'warning' ? 1 : 0;
        const rightSeverity =
          right.status === 'critical' ? 2 : right.status === 'warning' ? 1 : 0;

        if (leftSeverity !== rightSeverity) {
          return rightSeverity - leftSeverity;
        }

        if (left.projectedOverage !== right.projectedOverage) {
          return right.projectedOverage - left.projectedOverage;
        }

        if (left.percentage !== right.percentage) {
          return right.percentage - left.percentage;
        }

        return right.spent - left.spent;
      })[0] ?? null;

  return {
    topRiskBudget,
    topUncoveredCategory: summary.topUncoveredCategory,
    hasPlanningMismatch: summary.hasPlanningMismatch,
    planningMismatchAmount: summary.planningMismatchAmount,
  };
}

export function shouldResetBudgetThresholds(previousBudget: Budget | undefined, nextBudget: Budget): boolean {
  if (!previousBudget) {
    return true;
  }

  const previousScope = getBudgetScopeKey(previousBudget);
  const nextScope = getBudgetScopeKey(nextBudget);

  return (
    previousScope !== nextScope ||
    roundMoney(previousBudget.monthlyLimit) !== roundMoney(nextBudget.monthlyLimit)
  );
}
