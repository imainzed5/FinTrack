import { v4 as uuidv4 } from 'uuid';
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  format,
  isAfter,
  parseISO,
  startOfDay,
} from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Transaction,
  Account,
  AccountWithBalance,
  AccountType,
  Budget,
  TimelineEvent,
  RecurringFrequency,
  RecurringConfig,
  TransactionSplit,
  BudgetThresholdAlert,
  SavingsGoal,
  SavingsGoalInput,
  SavingsGoalStatus,
  SavingsDeposit,
  SavingsDepositInput,
  SavingsGoalWithDeposits,
  SavingsGoalMilestone,
  SavingsGoalHealth,
  SavingsGoalsSummary,
} from './types';
import { INCOME_CATEGORIES, RECURRING_FREQUENCIES } from './types';
import {
  computeAccountBalance,
  resolvePreferredDefaultAccount,
} from './accounts-utils';
import { buildDashboardData } from './insights-engine';
import { requireSupabaseUser } from './supabase/server';

const ACCOUNT_TYPE_SET = new Set<AccountType>(['Cash', 'Bank', 'E-Wallet', 'Other']);

interface TransactionSplitRow {
  id: string;
  category: Transaction['category'];
  sub_category: string | null;
  amount: number | string;
  created_at?: string;
}

interface TransactionRow {
  id: string;
  user_id: string;
  amount: number | string;
  type: Transaction['type'] | null;
  category: Transaction['category'];
  sub_category: string | null;
  merchant: string | null;
  description: string;
  transaction_at: string;
  payment_method: Transaction['paymentMethod'];
  notes: string;
  tags: string[] | null;
  attachment_base64: string | null;
  savings_meta: Transaction['savingsMeta'] | null;
  recurring_frequency: RecurringFrequency | null;
  recurring_interval: number | null;
  recurring_next_run_at: string | null;
  recurring_end_at: string | null;
  recurring_origin_id: string | null;
  is_auto_generated: boolean;
  account_id?: string | null;
  transfer_group_id?: string | null;
  synced: boolean;
  created_at: string;
  updated_at: string;
  transaction_splits?: TransactionSplitRow[] | null;
}

interface AccountRow {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  initial_balance: number | string;
  color: string | null;
  icon: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

interface BudgetRow {
  id: string;
  user_id: string;
  budget_month: string;
  category: Budget['category'];
  sub_category: string | null;
  monthly_limit: number | string;
  rollover: boolean;
  alert_thresholds_triggered: number[] | null;
  created_at: string;
  updated_at: string;
}

interface SavingsGoalRow {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  color_accent: string;
  tag: string | null;
  motivation_note: string | null;
  target_amount: number | string;
  current_amount: number | string;
  deadline: string | null;
  is_private: boolean;
  is_pinned: boolean;
  sort_order: number;
  status: SavingsGoalStatus;
  completed_at: string | null;
  what_did_you_buy: string | null;
  created_at: string;
  updated_at: string;
}

interface SavingsDepositRow {
  id: string;
  goal_id: string;
  user_id: string;
  amount: number | string;
  type: SavingsDepositInput['type'];
  note: string | null;
  created_at: string;
}

const TRANSACTION_SELECT = `
  id,
  user_id,
  amount,
  type,
  category,
  sub_category,
  merchant,
  description,
  transaction_at,
  payment_method,
  notes,
  tags,
  attachment_base64,
  savings_meta,
  recurring_frequency,
  recurring_interval,
  recurring_next_run_at,
  recurring_end_at,
  recurring_origin_id,
  is_auto_generated,
  account_id,
  transfer_group_id,
  synced,
  created_at,
  updated_at,
  transaction_splits (
    id,
    category,
    sub_category,
    amount,
    created_at
  )
`;

const LEGACY_TRANSACTION_SELECT = `
  id,
  user_id,
  amount,
  type,
  category,
  sub_category,
  merchant,
  description,
  transaction_at,
  payment_method,
  notes,
  tags,
  attachment_base64,
  savings_meta,
  recurring_frequency,
  recurring_interval,
  recurring_next_run_at,
  recurring_end_at,
  recurring_origin_id,
  is_auto_generated,
  synced,
  created_at,
  updated_at,
  transaction_splits (
    id,
    category,
    sub_category,
    amount,
    created_at
  )
`;

const ACCOUNT_SELECT = `
  id,
  user_id,
  name,
  type,
  initial_balance,
  color,
  icon,
  is_archived,
  created_at,
  updated_at
`;

const BUDGET_SELECT = `
  id,
  user_id,
  budget_month,
  category,
  sub_category,
  monthly_limit,
  rollover,
  alert_thresholds_triggered,
  created_at,
  updated_at
`;

const SAVINGS_GOAL_SELECT = `
  id,
  user_id,
  name,
  emoji,
  color_accent,
  tag,
  motivation_note,
  target_amount,
  current_amount,
  deadline,
  is_private,
  is_pinned,
  sort_order,
  status,
  completed_at,
  what_did_you_buy,
  created_at,
  updated_at
`;

const SAVINGS_DEPOSIT_SELECT = `
  id,
  goal_id,
  user_id,
  amount,
  type,
  note,
  created_at
`;

function safeParseDate(value?: string): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeIsoDate(value: string | undefined, fallback: string): string {
  const parsed = safeParseDate(value);
  if (parsed) return parsed.toISOString();
  const fallbackParsed = safeParseDate(fallback);
  return fallbackParsed ? fallbackParsed.toISOString() : new Date().toISOString();
}

function addRecurringInterval(
  date: Date,
  frequency: RecurringFrequency,
  interval: number
): Date {
  const steps = Math.max(1, Math.floor(interval));
  if (frequency === 'daily') return addDays(date, steps);
  if (frequency === 'weekly') return addWeeks(date, steps);
  if (frequency === 'yearly') return addYears(date, steps);
  return addMonths(date, steps);
}

function monthToDate(month: string): string {
  if (/^\d{4}-\d{2}$/.test(month)) {
    return `${month}-01`;
  }
  return `${format(new Date(), 'yyyy-MM')}-01`;
}

function dateToMonth(value: string): string {
  return value.slice(0, 7);
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') {
    return Number(value.toFixed(2));
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Number(parsed.toFixed(2));
    }
  }
  return 0;
}

const INCOME_CATEGORY_SET = new Set<string>(INCOME_CATEGORIES);

function normalizeTransactionType(value: unknown): Transaction['type'] {
  if (value === 'income') return 'income';
  if (value === 'savings') return 'savings';
  return 'expense';
}

function normalizeIncomeCategory(value: unknown): Transaction['incomeCategory'] {
  if (typeof value !== 'string') {
    return undefined;
  }

  return INCOME_CATEGORY_SET.has(value)
    ? (value as NonNullable<Transaction['incomeCategory']>)
    : undefined;
}

function normalizeSavingsTransactionMeta(value: unknown): Transaction['savingsMeta'] {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const meta = value as Record<string, unknown>;
  if (
    typeof meta.goalId !== 'string' ||
    typeof meta.goalName !== 'string' ||
    (meta.depositType !== 'deposit' && meta.depositType !== 'withdrawal')
  ) {
    return undefined;
  }

  return {
    goalId: meta.goalId,
    goalName: meta.goalName,
    depositType: meta.depositType,
  };
}

function normalizeAccountType(value: unknown): AccountType {
  if (typeof value === 'string' && ACCOUNT_TYPE_SET.has(value as AccountType)) {
    return value as AccountType;
  }
  return 'Cash';
}

function toTransactionSplit(row: TransactionSplitRow): TransactionSplit {
  return {
    id: row.id,
    category: row.category,
    subCategory: row.sub_category ?? undefined,
    amount: toNumber(row.amount),
  };
}

function toRecurring(row: TransactionRow): RecurringConfig | undefined {
  if (!row.recurring_frequency || !row.recurring_next_run_at) {
    return undefined;
  }

  return {
    frequency: row.recurring_frequency,
    interval: Math.max(1, Math.floor(row.recurring_interval ?? 1)),
    nextRunDate: normalizeIsoDate(row.recurring_next_run_at, row.transaction_at),
    endDate: row.recurring_end_at
      ? normalizeIsoDate(row.recurring_end_at, row.recurring_end_at)
      : undefined,
  };
}

function toTransaction(row: TransactionRow): Transaction {
  const split = Array.isArray(row.transaction_splits)
    ? row.transaction_splits.map(toTransactionSplit)
    : [];
  const type = normalizeTransactionType(row.type);
  const persistedSubCategory = row.sub_category ?? undefined;
  const incomeCategory =
    type === 'income'
      ? normalizeIncomeCategory(persistedSubCategory) ?? 'Other Income'
      : undefined;
  const savingsMeta =
    type === 'savings'
      ? normalizeSavingsTransactionMeta(row.savings_meta)
      : undefined;

  return {
    id: row.id,
    amount: toNumber(row.amount),
    type,
    incomeCategory,
    category: row.category,
    subCategory: type === 'expense' ? persistedSubCategory : undefined,
    merchant: row.merchant ?? undefined,
    description: row.description,
    date: normalizeIsoDate(row.transaction_at, row.transaction_at),
    paymentMethod: row.payment_method,
    notes: row.notes || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    attachmentBase64: row.attachment_base64 ?? undefined,
    savingsMeta,
    split: split.length > 0 ? split : undefined,
    recurring: toRecurring(row),
    recurringOriginId: row.recurring_origin_id ?? undefined,
    isAutoGenerated: row.is_auto_generated,
    accountId: row.account_id ?? undefined,
    transferGroupId: row.transfer_group_id ?? undefined,
    createdAt: normalizeIsoDate(row.created_at, row.transaction_at),
    updatedAt: normalizeIsoDate(row.updated_at, row.created_at),
    synced: row.synced,
  };
}

function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: normalizeAccountType(row.type),
    initialBalance: toNumber(row.initial_balance),
    color: row.color ?? undefined,
    icon: row.icon ?? undefined,
    isArchived: row.is_archived,
    createdAt: normalizeIsoDate(row.created_at, row.created_at),
    updatedAt: normalizeIsoDate(row.updated_at, row.updated_at),
  };
}

function toBudget(row: BudgetRow): Budget {
  const alertThresholdsTriggered = Array.isArray(row.alert_thresholds_triggered)
    ? row.alert_thresholds_triggered.slice().sort((a, b) => a - b)
    : [];

  return {
    id: row.id,
    category: row.category,
    subCategory: row.sub_category ?? undefined,
    monthlyLimit: toNumber(row.monthly_limit),
    month: dateToMonth(row.budget_month),
    rollover: row.rollover,
    alertThresholdsTriggered,
  };
}

function toSavingsGoal(row: SavingsGoalRow): SavingsGoal {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    emoji: row.emoji,
    colorAccent: row.color_accent,
    tag: row.tag ?? undefined,
    motivationNote: row.motivation_note ?? undefined,
    targetAmount: toNumber(row.target_amount),
    currentAmount: toNumber(row.current_amount),
    deadline: row.deadline ?? undefined,
    isPrivate: row.is_private,
    isPinned: row.is_pinned,
    sortOrder: row.sort_order,
    status: row.status,
    completedAt: row.completed_at ?? undefined,
    whatDidYouBuy: row.what_did_you_buy ?? undefined,
    createdAt: normalizeIsoDate(row.created_at, row.created_at),
    updatedAt: normalizeIsoDate(row.updated_at, row.created_at),
  };
}

function toSavingsDeposit(row: SavingsDepositRow): SavingsDeposit {
  return {
    id: row.id,
    goalId: row.goal_id,
    userId: row.user_id,
    amount: toNumber(row.amount),
    type: row.type,
    note: row.note ?? undefined,
    createdAt: normalizeIsoDate(row.created_at, row.created_at),
  };
}

function toDateOnly(value: Date): string {
  return format(value, 'yyyy-MM-dd');
}

function getSavingsGoalHealth(goal: SavingsGoal): SavingsGoalHealth {
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

function getProjectedCompletionDate(goal: SavingsGoal, deposits: SavingsDeposit[]): string | undefined {
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

function getRequiredMonthlyAmount(goal: SavingsGoal): number | undefined {
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

function getGoalMilestones(goal: SavingsGoal, deposits: SavingsDeposit[]): SavingsGoalMilestone[] {
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

function buildSavingsGoalWithDeposits(
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

function toTransactionInsertPayload(tx: Transaction, userId: string) {
  const type = normalizeTransactionType(tx.type);
  const incomeCategory =
    type === 'income'
      ? normalizeIncomeCategory(tx.incomeCategory) ?? normalizeIncomeCategory(tx.subCategory) ?? 'Other Income'
      : undefined;
  const persistedSubCategory = type === 'income' ? incomeCategory : tx.subCategory ?? null;
  const fallbackDescription =
    tx.description || tx.notes || (type === 'income' ? incomeCategory || tx.category : tx.category);

  return {
    id: tx.id,
    user_id: userId,
    amount: Number(tx.amount.toFixed(2)),
    type,
    category: tx.category,
    sub_category: persistedSubCategory,
    merchant: tx.merchant ?? null,
    description: fallbackDescription,
    transaction_at: normalizeIsoDate(tx.date, new Date().toISOString()),
    payment_method: tx.paymentMethod,
    notes: tx.notes || '',
    tags: Array.isArray(tx.tags) ? tx.tags : [],
    attachment_base64: tx.attachmentBase64 ?? null,
    savings_meta: tx.savingsMeta ?? null,
    recurring_frequency: tx.recurring?.frequency ?? null,
    recurring_interval: tx.recurring ? Math.max(1, Math.floor(tx.recurring.interval || 1)) : null,
    recurring_next_run_at: tx.recurring?.nextRunDate ?? null,
    recurring_end_at: tx.recurring?.endDate ?? null,
    recurring_origin_id: tx.recurringOriginId ?? null,
    is_auto_generated: Boolean(tx.isAutoGenerated),
    account_id: tx.accountId ?? null,
    transfer_group_id: tx.transferGroupId ?? null,
    synced: typeof tx.synced === 'boolean' ? tx.synced : true,
    created_at: normalizeIsoDate(tx.createdAt, new Date().toISOString()),
    updated_at: normalizeIsoDate(tx.updatedAt, tx.createdAt || new Date().toISOString()),
  };
}

function toRecurringUpdatePayload(recurring: RecurringConfig | undefined) {
  if (!recurring) {
    return {
      recurring_frequency: null,
      recurring_interval: null,
      recurring_next_run_at: null,
      recurring_end_at: null,
    };
  }

  return {
    recurring_frequency: recurring.frequency,
    recurring_interval: Math.max(1, Math.floor(recurring.interval || 1)),
    recurring_next_run_at: normalizeIsoDate(recurring.nextRunDate, new Date().toISOString()),
    recurring_end_at: recurring.endDate
      ? normalizeIsoDate(recurring.endDate, recurring.endDate)
      : null,
  };
}

async function getAuthedClient(): Promise<{ supabase: SupabaseClient; userId: string }> {
  const { supabase, user } = await requireSupabaseUser();
  return {
    supabase,
    userId: user.id,
  };
}

function throwIfError(context: string, error: { message: string } | null) {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

function isMissingAccountsSchemaError(error: { message?: string } | null | undefined): boolean {
  const message = (error?.message || '').toLowerCase();
  return (
    message.includes('column transactions.account_id does not exist') ||
    message.includes('column transactions.transfer_group_id does not exist') ||
    message.includes('relation "accounts" does not exist') ||
    message.includes('could not find the table') && message.includes('accounts')
  );
}

async function getDefaultAccountId(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('accounts')
    .select('id,name,type,is_archived,created_at')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('created_at', { ascending: true });

  throwIfError('Failed to resolve default account', error);

  const rows = Array.isArray(data) ? data : [];
  if (rows.length > 0) {
    const mapped = rows.map((row) => ({
      id: row.id as string,
      userId,
      name: row.name as string,
      type: normalizeAccountType(row.type),
      initialBalance: 0,
      isArchived: Boolean(row.is_archived),
      createdAt: row.created_at as string,
      updatedAt: row.created_at as string,
    }));
    const preferred = resolvePreferredDefaultAccount(mapped);
    return preferred?.id ?? (rows[0].id as string);
  }

  const { data: created, error: createError } = await supabase
    .from('accounts')
    .insert({
      user_id: userId,
      name: 'Cash',
      type: 'Cash',
      initial_balance: 0,
      is_archived: false,
    })
    .select('id')
    .single();

  throwIfError('Failed to create default account', createError);

  if (!created?.id) {
    throw new Error('Failed to create default account.');
  }

  return created.id as string;
}

async function resolveAccountIdForWrite(
  supabase: SupabaseClient,
  userId: string,
  accountId: string | undefined,
  options: { allowArchived?: boolean } = {}
): Promise<string> {
  if (!accountId) {
    return getDefaultAccountId(supabase, userId);
  }

  const query = supabase
    .from('accounts')
    .select('id,is_archived')
    .eq('id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  const { data, error } = await query;
  throwIfError('Failed to validate account', error);

  if (!data) {
    throw new Error('Account not found.');
  }

  if (!options.allowArchived && data.is_archived) {
    throw new Error('Cannot use an archived account for new transactions.');
  }

  return data.id as string;
}

async function getAccountsRaw(
  supabase: SupabaseClient,
  userId: string,
  includeArchived: boolean
): Promise<Account[]> {
  let query = supabase
    .from('accounts')
    .select(ACCOUNT_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (!includeArchived) {
    query = query.eq('is_archived', false);
  }

  const { data, error } = await query;
  if (error && isMissingAccountsSchemaError(error)) {
    return [];
  }
  throwIfError('Failed to load accounts', error);

  return (data ?? []).map((row) => toAccount(row as AccountRow));
}

async function getTransactionById(
  supabase: SupabaseClient,
  id: string
): Promise<Transaction | null> {
  let { data, error } = await supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error && isMissingAccountsSchemaError(error)) {
    const fallback = await supabase
      .from('transactions')
      .select(LEGACY_TRANSACTION_SELECT)
      .eq('id', id)
      .maybeSingle();
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  throwIfError('Failed to fetch transaction', error);

  if (!data) {
    return null;
  }

  return toTransaction(data as TransactionRow);
}

async function replaceTransactionSplits(
  supabase: SupabaseClient,
  transactionId: string,
  split: TransactionSplit[] | undefined
): Promise<void> {
  const payload = Array.isArray(split)
    ? split.map((line) => ({
        id: line.id,
        category: line.category,
        subCategory: line.subCategory ?? null,
        amount: Number(line.amount.toFixed(2)),
      }))
    : [];

  const { error } = await supabase.rpc('replace_transaction_splits', {
    p_transaction_id: transactionId,
    p_splits: payload,
  });

  throwIfError('Failed to write transaction splits', error);
}

export function getNextRecurringRunDate(
  fromDate: string,
  frequency: RecurringFrequency,
  interval = 1
): string {
  const baseDate = safeParseDate(fromDate) || new Date();
  return addRecurringInterval(baseDate, frequency, interval).toISOString();
}

export function buildRecurringConfig(
  fromDate: string,
  frequency: RecurringFrequency,
  interval = 1,
  endDate?: string
): RecurringConfig {
  const normalizedInterval = Math.max(1, Math.floor(interval));
  return {
    frequency,
    interval: normalizedInterval,
    nextRunDate: getNextRecurringRunDate(fromDate, frequency, normalizedInterval),
    endDate: endDate ? normalizeIsoDate(endDate, endDate) : undefined,
  };
}

// Transactions
export async function getTransactions(): Promise<Transaction[]> {
  const { supabase } = await getAuthedClient();
  let { data, error } = await supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .order('transaction_at', { ascending: false });

  if (error && isMissingAccountsSchemaError(error)) {
    const fallback = await supabase
      .from('transactions')
      .select(LEGACY_TRANSACTION_SELECT)
      .order('transaction_at', { ascending: false });
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  throwIfError('Failed to load transactions', error);

  return (data ?? []).map((row) => toTransaction(row as TransactionRow));
}

/**
 * Returns all root recurring transactions (the origin transaction) that are
 * still active — i.e. recurring_frequency is set and recurring_end_at is
 * either null (runs forever) or in the future.
 */
export async function getActiveRecurringTransactions(): Promise<Transaction[]> {
  const { supabase } = await getAuthedClient();
  const today = new Date().toISOString().split('T')[0];

  let { data, error } = await supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .not('recurring_frequency', 'is', null)
    .is('recurring_origin_id', null) // only origin (root) recurring transactions
    .or(`recurring_end_at.is.null,recurring_end_at.gte.${today}`)
    .order('recurring_next_run_at', { ascending: true });

  if (error && isMissingAccountsSchemaError(error)) {
    const fallback = await supabase
      .from('transactions')
      .select(LEGACY_TRANSACTION_SELECT)
      .not('recurring_frequency', 'is', null)
      .is('recurring_origin_id', null)
      .or(`recurring_end_at.is.null,recurring_end_at.gte.${today}`)
      .order('recurring_next_run_at', { ascending: true });
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  throwIfError('Failed to load recurring transactions', error);

  return (data ?? []).map((row) => toTransaction(row as TransactionRow));
}

export async function saveTransactions(transactions: Transaction[]): Promise<void> {
  const { supabase, userId } = await getAuthedClient();

  for (const tx of transactions) {
    const resolvedAccountId = await resolveAccountIdForWrite(
      supabase,
      userId,
      tx.accountId,
      { allowArchived: true }
    );
    const payload = toTransactionInsertPayload({ ...tx, accountId: resolvedAccountId }, userId);
    const { error } = await supabase.from('transactions').upsert(payload, {
      onConflict: 'id',
    });
    throwIfError('Failed to save transaction', error);

    if (Object.prototype.hasOwnProperty.call(tx, 'split')) {
      await replaceTransactionSplits(supabase, tx.id, tx.split);
    }
  }
}

export async function addTransaction(tx: Transaction): Promise<Transaction> {
  const { supabase, userId } = await getAuthedClient();
  const resolvedAccountId = await resolveAccountIdForWrite(supabase, userId, tx.accountId);
  const payload = toTransactionInsertPayload({ ...tx, accountId: resolvedAccountId }, userId);

  const { data, error } = await supabase
    .from('transactions')
    .insert(payload)
    .select(TRANSACTION_SELECT)
    .single();

  throwIfError('Failed to add transaction', error);

  if (!data) {
    throw new Error('Failed to create transaction.');
  }

  if (tx.split) {
    try {
      await replaceTransactionSplits(supabase, tx.id, tx.split);
    } catch (splitError) {
      await supabase.from('transactions').delete().eq('id', tx.id);
      throw splitError;
    }
  }

  const created = await getTransactionById(supabase, data.id);
  if (!created) {
    throw new Error('Failed to load created transaction.');
  }

  return created;
}

export async function upsertTransaction(tx: Transaction): Promise<Transaction> {
  const { supabase } = await getAuthedClient();
  const existing = await getTransactionById(supabase, tx.id);

  const saved = existing
    ? await updateTransaction(tx.id, tx)
    : await addTransaction(tx);

  if (!saved) {
    throw new Error('Failed to upsert transaction.');
  }

  // Income never participates in threshold alerts at write-time.
  if (saved.type === 'income') {
    return saved;
  }

  // Savings transactions never participate in threshold alerts.
  if (saved.type === 'savings') {
    return saved;
  }

  return saved;
}

export async function updateTransaction(
  id: string,
  updates: Partial<Transaction>
): Promise<Transaction | null> {
  const { supabase, userId } = await getAuthedClient();
  const payload: Record<string, unknown> = {};
  const hasIncomeCategory = Object.prototype.hasOwnProperty.call(updates, 'incomeCategory');
  let nextType: Transaction['type'] | undefined;

  if (typeof updates.amount === 'number') {
    payload.amount = Number(updates.amount.toFixed(2));
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'type')) {
    nextType = normalizeTransactionType(updates.type);
    payload.type = nextType;
  }
  if (hasIncomeCategory) {
    const normalizedIncomeCategory = normalizeIncomeCategory(updates.incomeCategory);
    payload.sub_category = normalizedIncomeCategory ?? null;
    if (!nextType) {
      nextType = 'income';
      payload.type = nextType;
    }
  }
  if (updates.category) {
    payload.category = updates.category;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'subCategory') && !hasIncomeCategory) {
    payload.sub_category = updates.subCategory ?? null;
  }
  if (
    nextType === 'expense' &&
    !hasIncomeCategory &&
    !Object.prototype.hasOwnProperty.call(updates, 'subCategory')
  ) {
    payload.sub_category = null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'merchant')) {
    payload.merchant = updates.merchant ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'description')) {
    payload.description = updates.description ?? '';
  }
  if (updates.date) {
    payload.transaction_at = normalizeIsoDate(updates.date, updates.date);
  }
  if (updates.paymentMethod) {
    payload.payment_method = updates.paymentMethod;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'notes')) {
    payload.notes = updates.notes ?? '';
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'tags')) {
    payload.tags = Array.isArray(updates.tags) ? updates.tags : [];
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'attachmentBase64')) {
    payload.attachment_base64 = updates.attachmentBase64 ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'savingsMeta')) {
    payload.savings_meta = updates.savingsMeta ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'recurring')) {
    Object.assign(payload, toRecurringUpdatePayload(updates.recurring));
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'recurringOriginId')) {
    payload.recurring_origin_id = updates.recurringOriginId ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'isAutoGenerated')) {
    payload.is_auto_generated = Boolean(updates.isAutoGenerated);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'synced')) {
    payload.synced = Boolean(updates.synced);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'accountId')) {
    const resolvedAccountId = updates.accountId
      ? await resolveAccountIdForWrite(supabase, userId, updates.accountId, { allowArchived: true })
      : await getDefaultAccountId(supabase, userId);
    payload.account_id = resolvedAccountId;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'transferGroupId')) {
    payload.transfer_group_id = updates.transferGroupId ?? null;
  }

  if (Object.keys(payload).length > 0) {
    const { data, error } = await supabase
      .from('transactions')
      .update(payload)
      .eq('id', id)
      .select('id')
      .maybeSingle();

    throwIfError('Failed to update transaction', error);

    if (!data) {
      return null;
    }
  } else {
    const existing = await getTransactionById(supabase, id);
    if (!existing) {
      return null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'split')) {
    await replaceTransactionSplits(supabase, id, updates.split);
  }

  return getTransactionById(supabase, id);
}

export async function deleteTransaction(id: string): Promise<boolean> {
  const { supabase } = await getAuthedClient();
  const { data, error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .select('id');

  throwIfError('Failed to delete transaction', error);

  return Array.isArray(data) && data.length > 0;
}

export async function processRecurringTransactions(
  now: Date = new Date()
): Promise<{ created: number }> {
  const { supabase } = await getAuthedClient();
  const today = startOfDay(now);
  let created = 0;
  let supportsAccountColumns = true;

  let { data: templates, error } = await supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .not('recurring_frequency', 'is', null)
    .eq('is_auto_generated', false);

  if (error && isMissingAccountsSchemaError(error)) {
    supportsAccountColumns = false;
    const fallback = await supabase
      .from('transactions')
      .select(LEGACY_TRANSACTION_SELECT)
      .not('recurring_frequency', 'is', null)
      .eq('is_auto_generated', false);
    templates = fallback.data as typeof templates;
    error = fallback.error;
  }

  throwIfError('Failed to load recurring templates', error);

  for (const row of templates ?? []) {
    const templateRow = row as TransactionRow;
    const template = toTransaction(templateRow);
    if (!template.recurring || !RECURRING_FREQUENCIES.includes(template.recurring.frequency)) {
      continue;
    }

    const interval = Math.max(1, Math.floor(template.recurring.interval || 1));
    let nextRunDate =
      safeParseDate(template.recurring.nextRunDate) ||
      addRecurringInterval(
        safeParseDate(template.date) || now,
        template.recurring.frequency,
        interval
      );

    const endDate = safeParseDate(template.recurring.endDate);

    while (!isAfter(startOfDay(nextRunDate), today)) {
      if (endDate && isAfter(startOfDay(nextRunDate), startOfDay(endDate))) {
        break;
      }

      const runDay = format(nextRunDate, 'yyyy-MM-dd');
      const dayStart = `${runDay}T00:00:00.000Z`;
      const nextDay = addDays(nextRunDate, 1);
      const dayEnd = `${format(nextDay, 'yyyy-MM-dd')}T00:00:00.000Z`;

      const { data: existingRun, error: existingError } = await supabase
        .from('transactions')
        .select('id')
        .eq('recurring_origin_id', template.id)
        .gte('transaction_at', dayStart)
        .lt('transaction_at', dayEnd)
        .limit(1);

      throwIfError('Failed to validate recurring run duplication', existingError);

      if (!existingRun || existingRun.length === 0) {
        const timestamp = new Date().toISOString();
        const autoId = uuidv4();

        const insertPayload: Record<string, unknown> = {
          id: autoId,
          user_id: templateRow.user_id,
          amount: template.amount,
          type: template.type,
          category: template.category,
          sub_category:
            template.type === 'income'
              ? normalizeIncomeCategory(template.incomeCategory) ?? 'Other Income'
              : template.subCategory ?? null,
          merchant: template.merchant ?? null,
          description:
            template.description ||
            template.notes ||
            (template.type === 'income'
              ? template.incomeCategory || template.category
              : template.category),
          transaction_at: nextRunDate.toISOString(),
          payment_method: template.paymentMethod,
          notes: template.notes || '',
          tags: Array.isArray(template.tags) ? template.tags : [],
          attachment_base64: template.attachmentBase64 ?? null,
          savings_meta: template.savingsMeta ?? null,
          recurring_frequency: null,
          recurring_interval: null,
          recurring_next_run_at: null,
          recurring_end_at: null,
          recurring_origin_id: template.id,
          is_auto_generated: true,
          synced: true,
          created_at: timestamp,
          updated_at: timestamp,
        };

        if (supportsAccountColumns) {
          insertPayload.account_id = template.accountId ?? null;
          insertPayload.transfer_group_id = null;
        }

        const { error: insertError } = await supabase.from('transactions').insert(insertPayload);

        throwIfError('Failed to create recurring transaction', insertError);

        if (template.split) {
          await replaceTransactionSplits(supabase, autoId, template.split);
        }

        created += 1;
      }

      nextRunDate = addRecurringInterval(nextRunDate, template.recurring.frequency, interval);
    }

    const nextRunIso = nextRunDate.toISOString();
    if (template.recurring.nextRunDate !== nextRunIso) {
      const { error: updateTemplateError } = await supabase
        .from('transactions')
        .update({
          recurring_interval: interval,
          recurring_next_run_at: nextRunIso,
        })
        .eq('id', template.id);

      throwIfError('Failed to update recurring template', updateTemplateError);
    }
  }

  return { created };
}

// Accounts
export async function getAccounts(options: { includeArchived?: boolean } = {}): Promise<Account[]> {
  const { supabase, userId } = await getAuthedClient();
  return getAccountsRaw(supabase, userId, Boolean(options.includeArchived));
}

export async function getAccountsWithBalances(
  options: { includeArchived?: boolean } = {}
): Promise<AccountWithBalance[]> {
  const includeArchived = Boolean(options.includeArchived);
  const [accounts, transactions] = await Promise.all([
    getAccounts({ includeArchived }),
    getTransactions(),
  ]);

  const transactionsByAccount = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (!tx.accountId) continue;
    const list = transactionsByAccount.get(tx.accountId) ?? [];
    list.push(tx);
    transactionsByAccount.set(tx.accountId, list);
  }

  return accounts.map((account) => ({
    ...account,
    computedBalance: computeAccountBalance(
      account.initialBalance,
      transactionsByAccount.get(account.id) ?? []
    ),
  }));
}

export async function getTotalBalance(): Promise<number> {
  try {
    const accounts = await getAccountsWithBalances();
    return Number(accounts.reduce((sum, account) => sum + account.computedBalance, 0).toFixed(2));
  } catch (error) {
    if (error instanceof Error && isMissingAccountsSchemaError({ message: error.message })) {
      return 0;
    }
    throw error;
  }
}

export async function resolveDefaultAccountId(): Promise<string> {
  const { supabase, userId } = await getAuthedClient();
  return getDefaultAccountId(supabase, userId);
}

export async function createAccount(input: {
  name: string;
  type: AccountType;
  initialBalance?: number;
  color?: string;
  icon?: string;
}): Promise<Account> {
  const { supabase, userId } = await getAuthedClient();
  const name = input.name.trim();
  if (!name) {
    throw new Error('Account name is required.');
  }
  if (!ACCOUNT_TYPE_SET.has(input.type)) {
    throw new Error('Invalid account type.');
  }

  const { data, error } = await supabase
    .from('accounts')
    .insert({
      user_id: userId,
      name,
      type: input.type,
      initial_balance: Number((input.initialBalance ?? 0).toFixed(2)),
      color: input.color ?? null,
      icon: input.icon ?? null,
      is_archived: false,
    })
    .select(ACCOUNT_SELECT)
    .single();

  throwIfError('Failed to create account', error);
  return toAccount(data as AccountRow);
}

export async function updateAccount(
  id: string,
  updates: {
    name?: string;
    type?: AccountType;
    color?: string | null;
    icon?: string | null;
    initialBalance?: number;
  }
): Promise<Account> {
  const { supabase, userId } = await getAuthedClient();
  const payload: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(updates, 'name')) {
    const trimmedName = updates.name?.trim() ?? '';
    if (!trimmedName) {
      throw new Error('Account name is required.');
    }
    payload.name = trimmedName;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'type')) {
    if (!updates.type || !ACCOUNT_TYPE_SET.has(updates.type)) {
      throw new Error('Invalid account type.');
    }
    payload.type = updates.type;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'color')) {
    payload.color = updates.color ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'icon')) {
    payload.icon = updates.icon ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'initialBalance')) {
    if (typeof updates.initialBalance !== 'number' || !Number.isFinite(updates.initialBalance)) {
      throw new Error('Invalid initial balance.');
    }
    payload.initial_balance = Number(updates.initialBalance.toFixed(2));
  }

  if (Object.keys(payload).length === 0) {
    throw new Error('No account changes provided.');
  }

  const { data, error } = await supabase
    .from('accounts')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select(ACCOUNT_SELECT)
    .maybeSingle();

  throwIfError('Failed to update account', error);

  if (!data) {
    throw new Error('Account not found.');
  }

  return toAccount(data as AccountRow);
}

export async function addAccountBalanceAdjustment(input: {
  accountId: string;
  amount: number;
  note?: string;
  date?: string;
}): Promise<Transaction> {
  if (!Number.isFinite(input.amount) || input.amount === 0) {
    throw new Error('Adjustment amount must be non-zero.');
  }

  const now = input.date ? new Date(input.date).toISOString() : new Date().toISOString();
  const absoluteAmount = Math.abs(input.amount);
  const type: Transaction['type'] = input.amount > 0 ? 'income' : 'expense';
  const note = (input.note || '').trim();

  const transaction: Transaction = {
    id: uuidv4(),
    amount: Number(absoluteAmount.toFixed(2)),
    type,
    incomeCategory: type === 'income' ? 'Other Income' : undefined,
    category: 'Miscellaneous',
    subCategory: 'Account Adjustment',
    description: note || 'Account balance adjustment',
    date: now,
    paymentMethod: 'Bank Transfer',
    notes: note,
    accountId: input.accountId,
    createdAt: now,
    updatedAt: now,
    synced: true,
  };

  return addTransaction(transaction);
}

export async function setAccountArchived(id: string, isArchived: boolean): Promise<Account> {
  const { supabase, userId } = await getAuthedClient();

  if (isArchived) {
    const { count, error: countError } = await supabase
      .from('accounts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_archived', false);

    throwIfError('Failed to validate active account count', countError);

    if ((count ?? 0) <= 1) {
      throw new Error('You must keep at least one active account.');
    }
  }

  const { data, error } = await supabase
    .from('accounts')
    .update({ is_archived: isArchived })
    .eq('id', id)
    .eq('user_id', userId)
    .select(ACCOUNT_SELECT)
    .maybeSingle();

  throwIfError(isArchived ? 'Failed to archive account' : 'Failed to restore account', error);

  if (!data) {
    throw new Error('Account not found.');
  }

  return toAccount(data as AccountRow);
}

export async function createTransfer(input: {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ transferGroupId: string; debitTransactionId: string; creditTransactionId: string }> {
  const { supabase } = await getAuthedClient();

  const { data, error } = await supabase.rpc('create_transfer', {
    p_from_account_id: input.fromAccountId,
    p_to_account_id: input.toAccountId,
    p_amount: Number(input.amount.toFixed(2)),
    p_date: input.date ? new Date(input.date).toISOString() : new Date().toISOString(),
    p_notes: input.notes ?? '',
    p_metadata: input.metadata ?? null,
  });

  throwIfError('Failed to create transfer', error);

  const first = Array.isArray(data) ? data[0] : null;
  if (!first?.transfer_group_id || !first?.debit_transaction_id || !first?.credit_transaction_id) {
    throw new Error('Transfer did not return a valid receipt.');
  }

  return {
    transferGroupId: first.transfer_group_id,
    debitTransactionId: first.debit_transaction_id,
    creditTransactionId: first.credit_transaction_id,
  };
}

// Budgets
export async function getBudgets(): Promise<Budget[]> {
  const { supabase } = await getAuthedClient();
  const { data, error } = await supabase
    .from('budgets')
    .select(BUDGET_SELECT)
    .order('budget_month', { ascending: false });

  throwIfError('Failed to load budgets', error);

  return (data ?? []).map((row) => toBudget(row as BudgetRow));
}

export async function saveBudgets(budgets: Budget[]): Promise<void> {
  for (const budget of budgets) {
    await setBudget(budget);
  }
}

export async function setBudget(budget: Budget): Promise<Budget> {
  const { supabase, userId } = await getAuthedClient();
  const budgetMonth = monthToDate(budget.month);
  const normalizedSubCategory = budget.category === 'Overall' ? null : budget.subCategory ?? null;
  const payload = {
    id: budget.id,
    user_id: userId,
    budget_month: budgetMonth,
    category: budget.category,
    sub_category: normalizedSubCategory,
    monthly_limit: Number(budget.monthlyLimit.toFixed(2)),
    rollover: Boolean(budget.rollover),
    alert_thresholds_triggered: Array.isArray(budget.alertThresholdsTriggered)
      ? Array.from(new Set(budget.alertThresholdsTriggered)).sort((a, b) => a - b)
      : [],
  };

  const { data: existingById, error: existingByIdError } = await supabase
    .from('budgets')
    .select(BUDGET_SELECT)
    .eq('id', budget.id)
    .maybeSingle();
  throwIfError('Failed to validate budget identity', existingByIdError);

  let targetId = existingById?.id ?? null;

  if (!targetId) {
    let scopeQuery = supabase
      .from('budgets')
      .select(BUDGET_SELECT)
      .eq('budget_month', budgetMonth)
      .eq('category', budget.category)
      .limit(1);

    if (normalizedSubCategory === null) {
      scopeQuery = scopeQuery.is('sub_category', null);
    } else {
      scopeQuery = scopeQuery.eq('sub_category', normalizedSubCategory);
    }

    const { data: existingScoped, error: existingScopeError } = await scopeQuery.maybeSingle();
    throwIfError('Failed to validate budget scope', existingScopeError);
    targetId = existingScoped?.id ?? null;
  }

  if (targetId) {
    const { data, error } = await supabase
      .from('budgets')
      .update({
        category: payload.category,
        sub_category: payload.sub_category,
        monthly_limit: payload.monthly_limit,
        budget_month: payload.budget_month,
        rollover: payload.rollover,
        alert_thresholds_triggered: payload.alert_thresholds_triggered,
      })
      .eq('id', targetId)
      .select(BUDGET_SELECT)
      .single();

    throwIfError('Failed to update budget', error);
    return toBudget(data as BudgetRow);
  }

  const { data, error } = await supabase
    .from('budgets')
    .insert(payload)
    .select(BUDGET_SELECT)
    .single();

  throwIfError('Failed to create budget', error);
  return toBudget(data as BudgetRow);
}

export async function deleteBudget(id: string): Promise<boolean> {
  const { supabase } = await getAuthedClient();
  const { data, error } = await supabase
    .from('budgets')
    .delete()
    .eq('id', id)
    .select('id');

  throwIfError('Failed to delete budget', error);

  return Array.isArray(data) && data.length > 0;
}

export async function saveBudgetThresholdAlerts(
  alerts: BudgetThresholdAlert[]
): Promise<void> {
  if (alerts.length === 0) {
    return;
  }

  const { supabase, userId } = await getAuthedClient();

  const payload = alerts.map((alert) => ({
    user_id: userId,
    budget_id: alert.budgetId,
    budget_month: monthToDate(alert.month),
    threshold: alert.threshold,
    spent: Number(alert.spent.toFixed(2)),
    effective_limit: Number(alert.limit.toFixed(2)),
    percentage: Number(alert.percentage.toFixed(4)),
    message: alert.message,
  }));

  const { error } = await supabase
    .from('budget_threshold_alerts')
    .upsert(payload, { onConflict: 'budget_id,budget_month,threshold' });

  throwIfError('Failed to save budget threshold alerts', error);
}

// Timeline Events (reserved for future persistence table)
export async function getTimelineEvents(): Promise<TimelineEvent[]> {
  return [];
}

export async function addTimelineEvent(event: TimelineEvent): Promise<TimelineEvent> {
  return event;
}

// --- Savings Goals ---

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

  // Auto-create a linked savings transaction.
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
