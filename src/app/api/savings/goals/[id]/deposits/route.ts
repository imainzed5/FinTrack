import { NextRequest, NextResponse } from 'next/server';
import { addSavingsDeposit } from '@/lib/db';
import type { SavingsDepositInput } from '@/lib/types';
import { isAuthRequiredError, requireSupabaseUser } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

async function ensureOwnedGoal(id: string): Promise<boolean> {
  const { supabase, user } = await requireSupabaseUser();

  const { data, error } = await supabase
    .from('savings_goals')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate savings goal ownership: ${error.message}`);
  }

  return Boolean(data);
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const { supabase, user } = await requireSupabaseUser();

    const owned = await ensureOwnedGoal(id);
    if (!owned) {
      return NextResponse.json({ error: 'Savings goal not found.' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('savings_deposits')
      .select('id, goal_id, user_id, amount, type, note, created_at')
      .eq('goal_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load savings deposits: ${error.message}`);
    }

    const deposits = (data ?? []).map((row) => ({
      id: row.id,
      goalId: row.goal_id,
      userId: row.user_id,
      amount: Number(row.amount),
      type: row.type,
      note: row.note ?? undefined,
      createdAt: row.created_at,
    }));

    return NextResponse.json(deposits);
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : 'Failed to load deposits.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const owned = await ensureOwnedGoal(id);
    if (!owned) {
      return NextResponse.json({ error: 'Savings goal not found.' }, { status: 404 });
    }

    const body = (await request.json()) as SavingsDepositInput;
    if (!body || typeof body.amount !== 'number' || (body.type !== 'deposit' && body.type !== 'withdrawal')) {
      return NextResponse.json({ error: 'Invalid deposit payload.' }, { status: 400 });
    }

    const deposit = await addSavingsDeposit({
      goalId: id,
      amount: body.amount,
      type: body.type,
      note: body.note,
    });

    return NextResponse.json(deposit, { status: 201 });
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : 'Failed to add deposit.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
