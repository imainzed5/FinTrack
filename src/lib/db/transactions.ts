import type { RecurringConfig, RecurringFrequency, Transaction } from '../types';

import { getDefaultAccountId, resolveAccountIdForWrite } from './accounts-core';
import { getAuthedClient } from './client';
import { toTransaction } from './mappers';
import { normalizeIncomeCategory, normalizeTransactionType } from './normalizers';
import { LEGACY_TRANSACTION_SELECT, TRANSACTION_SELECT } from './selects';
import type { TransactionRow } from './rows';
import {
  addRecurringInterval,
  isMissingAccountsSchemaError,
  normalizeIsoDate,
  safeParseDate,
  throwIfError,
} from './shared';
import {
  getTransactionById,
  replaceTransactionSplits,
  toRecurringUpdatePayload,
  toTransactionInsertPayload,
} from './transaction-helpers';

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

export async function getActiveRecurringTransactions(): Promise<Transaction[]> {
  const { supabase } = await getAuthedClient();
  const today = new Date().toISOString().split('T')[0];

  let { data, error } = await supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .not('recurring_frequency', 'is', null)
    .is('recurring_origin_id', null)
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

export async function addTransaction(
  tx: Transaction,
  options: { allowArchivedAccount?: boolean } = {}
): Promise<Transaction> {
  const { supabase, userId } = await getAuthedClient();
  const resolvedAccountId = await resolveAccountIdForWrite(
    supabase,
    userId,
    tx.accountId,
    { allowArchived: Boolean(options.allowArchivedAccount) }
  );
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

  if (saved.type === 'income') {
    return saved;
  }

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
  if (Object.prototype.hasOwnProperty.call(updates, 'linkedTransferGroupId')) {
    payload.linked_transfer_group_id = updates.linkedTransferGroupId ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'metadata')) {
    payload.metadata = updates.metadata ?? {};
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
