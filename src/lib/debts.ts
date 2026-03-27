import { v4 as uuidv4 } from 'uuid';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Debt, DebtDirection, DebtInput, DebtStatus } from './types';
import { requireSupabaseUser } from './supabase/server';

interface DebtRow {
  id: string;
  user_id: string;
  direction: DebtDirection;
  person_name: string;
  amount: number | string;
  reason: string;
  debt_date: string;
  status: DebtStatus;
  settled_at: string | null;
  created_at: string;
  updated_at: string;
}

const DEBT_SELECT = `
  id,
  user_id,
  direction,
  person_name,
  amount,
  reason,
  debt_date,
  status,
  settled_at,
  created_at,
  updated_at
`;

function toNumber(value: number | string): number {
  if (typeof value === 'number') {
    return Number(value.toFixed(2));
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Number(parsed.toFixed(2));
}

function normalizeDateOnly(value: string | undefined): string {
  if (!value) {
    return new Date().toISOString().split('T')[0];
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().split('T')[0];
  }

  return parsed.toISOString().split('T')[0];
}

function normalizeIso(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

function toDebt(row: DebtRow): Debt {
  return {
    id: row.id,
    userId: row.user_id,
    direction: row.direction,
    personName: row.person_name,
    amount: toNumber(row.amount),
    reason: row.reason,
    date: normalizeDateOnly(row.debt_date),
    status: row.status,
    settledAt: normalizeIso(row.settled_at),
    createdAt: normalizeIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: normalizeIso(row.updated_at) ?? new Date().toISOString(),
  };
}

function throwIfError(context: string, error: { message: string } | null): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

async function getAuthedClient(): Promise<{ supabase: SupabaseClient; userId: string }> {
  const { supabase, user } = await requireSupabaseUser();
  return { supabase, userId: user.id };
}

export async function getDebts(status?: DebtStatus): Promise<Debt[]> {
  const { supabase } = await getAuthedClient();

  let query = supabase
    .from('debts')
    .select(DEBT_SELECT)
    .order('status', { ascending: true })
    .order('debt_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  throwIfError('Failed to load debts', error);

  return (data ?? []).map((row) => toDebt(row as DebtRow));
}

export async function createDebt(input: DebtInput): Promise<Debt> {
  const { supabase, userId } = await getAuthedClient();

  const now = new Date().toISOString();
  const payload = {
    id: uuidv4(),
    user_id: userId,
    direction: input.direction,
    person_name: input.personName,
    amount: Number(input.amount.toFixed(2)),
    reason: input.reason,
    debt_date: normalizeDateOnly(input.date),
    status: 'active' as const,
    settled_at: null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('debts')
    .insert(payload)
    .select(DEBT_SELECT)
    .single();

  throwIfError('Failed to create debt', error);

  if (!data) {
    throw new Error('Failed to create debt.');
  }

  return toDebt(data as DebtRow);
}

interface UpdateDebtInput {
  status?: DebtStatus;
  personName?: string;
  reason?: string;
  amount?: number;
  date?: string;
}

export async function updateDebt(id: string, updates: UpdateDebtInput): Promise<Debt | null> {
  const { supabase } = await getAuthedClient();
  const payload: Record<string, unknown> = {};

  if (typeof updates.personName === 'string') {
    payload.person_name = updates.personName;
  }
  if (typeof updates.reason === 'string') {
    payload.reason = updates.reason;
  }
  if (typeof updates.amount === 'number' && Number.isFinite(updates.amount)) {
    payload.amount = Number(updates.amount.toFixed(2));
  }
  if (typeof updates.date === 'string') {
    payload.debt_date = normalizeDateOnly(updates.date);
  }
  if (updates.status === 'active' || updates.status === 'settled') {
    payload.status = updates.status;
    payload.settled_at = updates.status === 'settled' ? new Date().toISOString() : null;
  }

  if (Object.keys(payload).length === 0) {
    return null;
  }

  const { data, error } = await supabase
    .from('debts')
    .update(payload)
    .eq('id', id)
    .select(DEBT_SELECT)
    .maybeSingle();

  throwIfError('Failed to update debt', error);

  if (!data) {
    return null;
  }

  return toDebt(data as DebtRow);
}

export async function settleDebt(id: string): Promise<Debt | null> {
  return updateDebt(id, { status: 'settled' });
}

export async function deleteDebt(id: string): Promise<boolean> {
  const { supabase } = await getAuthedClient();

  const { data, error } = await supabase
    .from('debts')
    .delete()
    .eq('id', id)
    .select('id');

  throwIfError('Failed to delete debt', error);

  return Array.isArray(data) && data.length > 0;
}
