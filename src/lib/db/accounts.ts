import { v4 as uuidv4 } from 'uuid';

import { computeAccountBalance } from '../accounts-utils';
import type { Account, AccountType, AccountWithBalance, Transaction } from '../types';
import { getAccountsRaw, getDefaultAccountId } from './accounts-core';
import { getAuthedClient } from './client';
import { toAccount } from './mappers';
import { ACCOUNT_TYPE_SET } from './normalizers';
import { ACCOUNT_SELECT } from './selects';
import type { AccountRow } from './rows';
import { isMissingAccountsSchemaError, throwIfError } from './shared';
import { addTransaction, getTransactions } from './transactions';

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

export async function getOrCreateSystemCashWallet(): Promise<Account> {
  const { supabase, userId } = await getAuthedClient();
  const accounts = await getAccountsRaw(supabase, userId, false);
  const existing = accounts.find((account) => account.isSystemCashWallet);
  if (existing) {
    return existing;
  }

  const preferredCashAccount = accounts.find((account) => account.type === 'Cash');
  if (preferredCashAccount) {
    const { data, error } = await supabase
      .from('accounts')
      .update({ is_system_cash_wallet: true })
      .eq('id', preferredCashAccount.id)
      .eq('user_id', userId)
      .select(ACCOUNT_SELECT)
      .single();

    throwIfError('Failed to promote cash wallet', error);
    return toAccount(data as AccountRow);
  }

  const { data, error } = await supabase
    .from('accounts')
    .insert({
      user_id: userId,
      name: 'Cash',
      type: 'Cash',
      initial_balance: 0,
      is_archived: false,
      is_system_cash_wallet: true,
    })
    .select(ACCOUNT_SELECT)
    .single();

  throwIfError('Failed to create system cash wallet', error);
  return toAccount(data as AccountRow);
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
  const accounts = await getAccountsWithBalances();
  const fromAccount = accounts.find((account) => account.id === input.fromAccountId);
  const toAccount = accounts.find((account) => account.id === input.toAccountId);

  if (!fromAccount) {
    throw new Error('From account is invalid.');
  }

  if (!toAccount) {
    throw new Error('To account is invalid.');
  }

  if (fromAccount.computedBalance + 0.005 < input.amount) {
    throw new Error('Insufficient balance.');
  }

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
