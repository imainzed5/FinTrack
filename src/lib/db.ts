import { v4 as uuidv4 } from 'uuid';
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  format,
  isAfter,
  parseISO,
  startOfDay,
} from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Transaction,
  Budget,
  TimelineEvent,
  RecurringFrequency,
  RecurringConfig,
  TransactionSplit,
  BudgetThresholdAlert,
} from './types';
import { INCOME_CATEGORIES, RECURRING_FREQUENCIES } from './types';
import { requireSupabaseUser } from './supabase/server';

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
  recurring_frequency: RecurringFrequency | null;
  recurring_interval: number | null;
  recurring_next_run_at: string | null;
  recurring_end_at: string | null;
  recurring_origin_id: string | null;
  is_auto_generated: boolean;
  synced: boolean;
  created_at: string;
  updated_at: string;
  transaction_splits?: TransactionSplitRow[] | null;
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
  return value === 'income' ? 'income' : 'expense';
}

function normalizeIncomeCategory(value: unknown): Transaction['incomeCategory'] {
  if (typeof value !== 'string') {
    return undefined;
  }

  return INCOME_CATEGORY_SET.has(value)
    ? (value as NonNullable<Transaction['incomeCategory']>)
    : undefined;
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
    split: split.length > 0 ? split : undefined,
    recurring: toRecurring(row),
    recurringOriginId: row.recurring_origin_id ?? undefined,
    isAutoGenerated: row.is_auto_generated,
    createdAt: normalizeIsoDate(row.created_at, row.transaction_at),
    updatedAt: normalizeIsoDate(row.updated_at, row.created_at),
    synced: row.synced,
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
    recurring_frequency: tx.recurring?.frequency ?? null,
    recurring_interval: tx.recurring ? Math.max(1, Math.floor(tx.recurring.interval || 1)) : null,
    recurring_next_run_at: tx.recurring?.nextRunDate ?? null,
    recurring_end_at: tx.recurring?.endDate ?? null,
    recurring_origin_id: tx.recurringOriginId ?? null,
    is_auto_generated: Boolean(tx.isAutoGenerated),
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

async function getTransactionById(
  supabase: SupabaseClient,
  id: string
): Promise<Transaction | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .eq('id', id)
    .maybeSingle();

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
  const { data, error } = await supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .order('transaction_at', { ascending: false });

  throwIfError('Failed to load transactions', error);

  return (data ?? []).map((row) => toTransaction(row as TransactionRow));
}

export async function saveTransactions(transactions: Transaction[]): Promise<void> {
  const { supabase, userId } = await getAuthedClient();

  for (const tx of transactions) {
    const payload = toTransactionInsertPayload(tx, userId);
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
  const payload = toTransactionInsertPayload(tx, userId);

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

  return saved;
}

export async function updateTransaction(
  id: string,
  updates: Partial<Transaction>
): Promise<Transaction | null> {
  const { supabase } = await getAuthedClient();
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

  const { data: templates, error } = await supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .not('recurring_frequency', 'is', null)
    .eq('is_auto_generated', false);

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

        const { error: insertError } = await supabase.from('transactions').insert({
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
          recurring_frequency: null,
          recurring_interval: null,
          recurring_next_run_at: null,
          recurring_end_at: null,
          recurring_origin_id: template.id,
          is_auto_generated: true,
          synced: true,
          created_at: timestamp,
          updated_at: timestamp,
        });

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
