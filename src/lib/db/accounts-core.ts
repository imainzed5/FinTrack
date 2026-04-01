import type { SupabaseClient } from '@supabase/supabase-js';

import type { Account } from '../types';
import { resolvePreferredDefaultAccount } from '../accounts-utils';
import { toAccount } from './mappers';
import { normalizeAccountType } from './normalizers';
import { ACCOUNT_SELECT, LEGACY_ACCOUNT_SELECT } from './selects';
import type { AccountRow } from './rows';
import { isMissingAccountsSchemaError, throwIfError } from './shared';

export async function getDefaultAccountId(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  let { data, error } = await supabase
    .from('accounts')
    .select('id,name,type,is_archived,created_at,is_system_cash_wallet')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('created_at', { ascending: true });

  if (error && isMissingAccountsSchemaError(error)) {
    const fallback = await supabase
      .from('accounts')
      .select('id,name,type,is_archived,created_at')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('created_at', { ascending: true });
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  throwIfError('Failed to resolve default account', error);

  const rows = Array.isArray(data) ? data : [];
  if (rows.length > 0) {
    const mapped = rows.map((row) => ({
      id: row.id as string,
      userId,
      name: row.name as string,
      type: normalizeAccountType(row.type),
      initialBalance: 0,
      isSystemCashWallet: Boolean((row as { is_system_cash_wallet?: boolean | null }).is_system_cash_wallet),
      isArchived: Boolean(row.is_archived),
      createdAt: row.created_at as string,
      updatedAt: row.created_at as string,
    }));
    const preferred = resolvePreferredDefaultAccount(mapped);
    return preferred?.id ?? (rows[0].id as string);
  }

  let { data: created, error: createError } = await supabase
    .from('accounts')
    .insert({
      user_id: userId,
      name: 'Cash',
      type: 'Cash',
      expense_payment_method: 'Cash',
      initial_balance: 0,
      is_system_cash_wallet: true,
      is_archived: false,
    })
    .select('id')
    .single();

  if (createError && isMissingAccountsSchemaError(createError)) {
    const fallback = await supabase
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
    created = fallback.data as typeof created;
    createError = fallback.error;
  }

  throwIfError('Failed to create default account', createError);

  if (!created?.id) {
    throw new Error('Failed to create default account.');
  }

  return created.id as string;
}

export async function resolveAccountIdForWrite(
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

export async function getAccountsRaw(
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

  let { data, error } = await query;
  if (error && isMissingAccountsSchemaError(error)) {
    let fallbackQuery = supabase
      .from('accounts')
      .select(LEGACY_ACCOUNT_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (!includeArchived) {
      fallbackQuery = fallbackQuery.eq('is_archived', false);
    }

    const fallback = await fallbackQuery;
    data = fallback.data as typeof data;
    error = fallback.error;
  }
  throwIfError('Failed to load accounts', error);

  return (data ?? []).map((row) => toAccount(row as AccountRow));
}
