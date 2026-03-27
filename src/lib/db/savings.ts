import { addDays, differenceInCalendarDays } from 'date-fns';

import { buildDashboardData } from '../insights-engine';
import type {
  SavingsDeposit,
  SavingsDepositInput,
  SavingsGoal,
  SavingsGoalHealth,
  SavingsGoalInput,
  SavingsGoalMilestone,
  SavingsGoalsSummary,
  SavingsGoalStatus,
  SavingsGoalWithDeposits,
  Transaction,
} from '../types';
import { getAuthedClient } from './client';
import { toSavingsDeposit, toSavingsGoal } from './mappers';
import { SAVINGS_DEPOSIT_SELECT, SAVINGS_GOAL_SELECT } from './selects';
import type { SavingsDepositRow, SavingsGoalRow } from './rows';
import { safeParseDate, throwIfError, toDateOnly } from './shared';
import { getBudgets } from './budgets';
import { getTransactions, upsertTransaction } from './transactions';

export function getSavingsGoalHealth(goal: SavingsGoal): SavingsGoalHealth {
  if (!goal.deadline) {
    return 'no_deadline';
  }

  const created = safeParseDate(goal.createdAt);
  const deadline = safeParseDate(goal.deadline);

  if (!created || !deadline) {
    return 'no_deadline';
  }

  const totalDays = Math.max(1, differenceInCalendarDays(deadline, created));
  const elapsedDays = Math.max(0, Math.min(totalDays, differenceInCalendarDays(new Date(), created)));
  const expectedPercent = Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100));
  const progressPercent = goal.targetAmount > 0
    ? Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100)
    : 0;

  if (progressPercent >= expectedPercent - 5) {
    return 'on_track';
  }
  if (progressPercent >= expectedPercent - 20) {
    return 'falling_behind';
  }
  return 'at_risk';
}

export function getProjectedCompletionDate(
  goal: SavingsGoal,
  deposits: SavingsDeposit[]
): string | undefined {
  const depositOnly = deposits
    .filter((entry) => entry.type === 'deposit')
    .sort((a, b) => safeParseDate(a.createdAt)!.getTime() - safeParseDate(b.createdAt)!.getTime());

  if (depositOnly.length === 0) {
    return undefined;
  }

  const firstDepositDate = safeParseDate(depositOnly[0].createdAt);
  if (!firstDepositDate) {
    return undefined;
  }

  const depositTotal = depositOnly.reduce((sum, entry) => sum + entry.amount, 0);
  const daysSinceFirstDeposit = Math.max(1, differenceInCalendarDays(new Date(), firstDepositDate) + 1);
  const avgDailyDeposit = depositTotal / daysSinceFirstDeposit;
  if (avgDailyDeposit <= 0) {
    return undefined;
  }

  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  if (remaining <= 0) {
    return toDateOnly(new Date());
  }

  const projectedDays = Math.ceil(remaining / avgDailyDeposit);
  const projectedDate = addDays(new Date(), projectedDays);
  return toDateOnly(projectedDate);
}

export function getRequiredMonthlyAmount(goal: SavingsGoal): number | undefined {
  if (!goal.deadline) {
    return undefined;
  }

  const deadline = safeParseDate(goal.deadline);
  if (!deadline) {
    return undefined;
  }

  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  if (remaining <= 0) {
    return 0;
  }

  const daysUntilDeadline = differenceInCalendarDays(deadline, new Date());
  if (daysUntilDeadline <= 0) {
    return undefined;
  }

  const monthsUntilDeadline = Math.max(1, Math.ceil(daysUntilDeadline / 30));
  return Number((remaining / monthsUntilDeadline).toFixed(2));
}

export function getGoalMilestones(
  goal: SavingsGoal,
  deposits: SavingsDeposit[]
): SavingsGoalMilestone[] {
  const thresholds: Array<25 | 50 | 75 | 100> = [25, 50, 75, 100];
  const sorted = [...deposits].sort((a, b) => {
    const aDate = safeParseDate(a.createdAt)?.getTime() ?? 0;
    const bDate = safeParseDate(b.createdAt)?.getTime() ?? 0;
    return aDate - bDate;
  });

  let cumulative = 0;
  const hitMap = new Map<number, string>();

  for (const entry of sorted) {
    if (entry.type !== 'deposit') {
      continue;
    }

    cumulative += entry.amount;
    const progress = goal.targetAmount > 0 ? (cumulative / goal.targetAmount) * 100 : 0;

    for (const threshold of thresholds) {
      if (!hitMap.has(threshold) && progress >= threshold) {
        hitMap.set(threshold, entry.createdAt);
      }
    }
  }

  return thresholds.map((threshold) => ({
    percent: threshold,
    hitAt: hitMap.get(threshold),
  }));
}

export function buildSavingsGoalWithDeposits(
  goal: SavingsGoal,
  deposits: SavingsDeposit[]
): SavingsGoalWithDeposits {
  const progressPercent = goal.targetAmount > 0
    ? Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100)
    : 0;

  return {
    ...goal,
    deposits,
    progressPercent,
    health: getSavingsGoalHealth(goal),
    projectedCompletionDate: getProjectedCompletionDate(goal, deposits),
    requiredMonthlyAmount: getRequiredMonthlyAmount(goal),
    milestones: getGoalMilestones(goal, deposits),
  };
}

export async function getSavingsGoals(): Promise<SavingsGoal[]> {
  const { supabase } = await getAuthedClient();
  const { data, error } = await supabase
    .from('savings_goals')
    .select(SAVINGS_GOAL_SELECT)
    .order('is_pinned', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  throwIfError('Failed to load savings goals', error);
  return (data ?? []).map((row) => toSavingsGoal(row as SavingsGoalRow));
}

export async function getSavingsGoalWithDeposits(goalId: string): Promise<SavingsGoalWithDeposits> {
  const { supabase } = await getAuthedClient();

  const { data: goalData, error: goalError } = await supabase
    .from('savings_goals')
    .select(SAVINGS_GOAL_SELECT)
    .eq('id', goalId)
    .maybeSingle();

  throwIfError('Failed to load savings goal', goalError);

  if (!goalData) {
    throw new Error('Savings goal not found.');
  }

  const { data: depositData, error: depositError } = await supabase
    .from('savings_deposits')
    .select(SAVINGS_DEPOSIT_SELECT)
    .eq('goal_id', goalId)
    .order('created_at', { ascending: true });

  throwIfError('Failed to load savings deposits', depositError);

  const goal = toSavingsGoal(goalData as SavingsGoalRow);
  const deposits = (depositData ?? []).map((row) => toSavingsDeposit(row as SavingsDepositRow));

  return buildSavingsGoalWithDeposits(goal, deposits);
}

export async function createSavingsGoal(input: SavingsGoalInput): Promise<SavingsGoal> {
  const { supabase, userId } = await getAuthedClient();

  const payload = {
    user_id: userId,
    name: input.name,
    emoji: input.emoji,
    color_accent: input.colorAccent,
    tag: input.tag ?? null,
    motivation_note: input.motivationNote ?? null,
    target_amount: Number(input.targetAmount.toFixed(2)),
    current_amount: 0,
    deadline: input.deadline ?? null,
    is_private: Boolean(input.isPrivate),
    is_pinned: Boolean(input.isPinned),
  };

  const { data, error } = await supabase
    .from('savings_goals')
    .insert(payload)
    .select(SAVINGS_GOAL_SELECT)
    .single();

  throwIfError('Failed to create savings goal', error);
  return toSavingsGoal(data as SavingsGoalRow);
}

export async function updateSavingsGoal(
  goalId: string,
  updates: Partial<SavingsGoalInput> & {
    status?: SavingsGoalStatus;
    completedAt?: string;
    whatDidYouBuy?: string;
    sortOrder?: number;
    isPinned?: boolean;
    isPrivate?: boolean;
  }
): Promise<SavingsGoal> {
  const { supabase } = await getAuthedClient();
  const payload: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(updates, 'name')) payload.name = updates.name;
  if (Object.prototype.hasOwnProperty.call(updates, 'emoji')) payload.emoji = updates.emoji;
  if (Object.prototype.hasOwnProperty.call(updates, 'colorAccent')) payload.color_accent = updates.colorAccent;
  if (Object.prototype.hasOwnProperty.call(updates, 'tag')) payload.tag = updates.tag ?? null;
  if (Object.prototype.hasOwnProperty.call(updates, 'motivationNote')) payload.motivation_note = updates.motivationNote ?? null;
  if (Object.prototype.hasOwnProperty.call(updates, 'targetAmount') && typeof updates.targetAmount === 'number') {
    payload.target_amount = Number(updates.targetAmount.toFixed(2));
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'deadline')) payload.deadline = updates.deadline ?? null;
  if (Object.prototype.hasOwnProperty.call(updates, 'status')) payload.status = updates.status;
  if (Object.prototype.hasOwnProperty.call(updates, 'completedAt')) payload.completed_at = updates.completedAt ?? null;
  if (Object.prototype.hasOwnProperty.call(updates, 'whatDidYouBuy')) payload.what_did_you_buy = updates.whatDidYouBuy ?? null;
  if (Object.prototype.hasOwnProperty.call(updates, 'sortOrder')) payload.sort_order = updates.sortOrder;
  if (Object.prototype.hasOwnProperty.call(updates, 'isPinned')) payload.is_pinned = updates.isPinned;
  if (Object.prototype.hasOwnProperty.call(updates, 'isPrivate')) payload.is_private = updates.isPrivate;

  const { data, error } = await supabase
    .from('savings_goals')
    .update(payload)
    .eq('id', goalId)
    .select(SAVINGS_GOAL_SELECT)
    .maybeSingle();

  throwIfError('Failed to update savings goal', error);

  if (!data) {
    throw new Error('Savings goal not found.');
  }

  return toSavingsGoal(data as SavingsGoalRow);
}

export async function deleteSavingsGoal(goalId: string): Promise<void> {
  const { supabase } = await getAuthedClient();
  const { error } = await supabase.from('savings_goals').delete().eq('id', goalId);
  throwIfError('Failed to delete savings goal', error);
}

export async function addSavingsDeposit(input: SavingsDepositInput): Promise<SavingsDeposit> {
  const { supabase, userId } = await getAuthedClient();

  const { data: goalData, error: goalError } = await supabase
    .from('savings_goals')
    .select(SAVINGS_GOAL_SELECT)
    .eq('id', input.goalId)
    .maybeSingle();

  throwIfError('Failed to load target savings goal', goalError);

  if (!goalData) {
    throw new Error('Savings goal not found.');
  }

  const goal = toSavingsGoal(goalData as SavingsGoalRow);

  const { data, error } = await supabase
    .from('savings_deposits')
    .insert({
      goal_id: input.goalId,
      user_id: userId,
      amount: Number(input.amount.toFixed(2)),
      type: input.type,
      note: input.note ?? null,
    })
    .select(SAVINGS_DEPOSIT_SELECT)
    .single();

  throwIfError('Failed to add savings deposit', error);

  const nextAmount = input.type === 'withdrawal'
    ? Math.max(0, goal.currentAmount - input.amount)
    : goal.currentAmount + input.amount;

  const status: SavingsGoalStatus = nextAmount >= goal.targetAmount ? 'completed' : goal.status;
  const completedAt = nextAmount >= goal.targetAmount
    ? new Date().toISOString()
    : goal.completedAt ?? null;

  const { error: updateError } = await supabase
    .from('savings_goals')
    .update({
      current_amount: Number(nextAmount.toFixed(2)),
      status,
      completed_at: completedAt,
    })
    .eq('id', input.goalId);

  throwIfError('Failed to update savings goal amount', updateError);

  const now = new Date().toISOString();
  const savingsTransaction: Transaction = {
    id: crypto.randomUUID(),
    amount: Number(input.amount.toFixed(2)),
    type: 'savings',
    category: 'Miscellaneous',
    merchant: goal.name,
    description: input.type === 'deposit' ? `Saved to ${goal.name}` : `Withdrew from ${goal.name}`,
    date: now,
    paymentMethod: 'Other',
    notes: input.note ?? undefined,
    savingsMeta: {
      goalId: input.goalId,
      goalName: goal.name,
      depositType: input.type,
    },
    createdAt: now,
    updatedAt: now,
  };

  await upsertTransaction(savingsTransaction);

  return toSavingsDeposit(data as SavingsDepositRow);
}

export async function getSavingsGoalsSummary(): Promise<SavingsGoalsSummary> {
  const [goals, transactions, budgets] = await Promise.all([
    getSavingsGoals(),
    getTransactions(),
    getBudgets(),
  ]);

  const goalDetails = await Promise.all(goals.map((goal) => getSavingsGoalWithDeposits(goal.id)));
  const activeGoals = goalDetails.filter((goal) => goal.status === 'active');

  const totalSaved = Number(activeGoals.reduce((sum, goal) => sum + goal.currentAmount, 0).toFixed(2));
  const activeGoalCount = activeGoals.length;

  const closestGoal = [...activeGoals].sort((a, b) => b.progressPercent - a.progressPercent)[0];

  const nearestDeadlineGoal = [...activeGoals]
    .filter((goal) => Boolean(goal.deadline))
    .sort((a, b) => {
      const aDate = safeParseDate(a.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDate = safeParseDate(b.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aDate - bDate;
    })[0];

  const dashboard = buildDashboardData(transactions, budgets);

  return {
    goals: goalDetails,
    totalSaved,
    activeGoalCount,
    closestGoal,
    nearestDeadlineGoal,
    savingsRate: dashboard.savingsRate,
  };
}
