import { NextRequest, NextResponse } from 'next/server';
import { deleteSavingsGoal, getSavingsGoalWithDeposits, updateSavingsGoal } from '@/lib/db';
import type { SavingsGoalInput, SavingsGoalStatus } from '@/lib/types';
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
    await requireSupabaseUser();
    const goal = await getSavingsGoalWithDeposits(id);
    return NextResponse.json(goal);
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : 'Failed to load savings goal.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const owned = await ensureOwnedGoal(id);
    if (!owned) {
      return NextResponse.json({ error: 'Savings goal not found.' }, { status: 404 });
    }

    const body = (await request.json()) as Partial<SavingsGoalInput> & {
      status?: SavingsGoalStatus;
      completedAt?: string;
      whatDidYouBuy?: string;
      sortOrder?: number;
      isPinned?: boolean;
      isPrivate?: boolean;
    };

    const updated = await updateSavingsGoal(id, body);
    return NextResponse.json(updated);
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : 'Failed to update savings goal.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const owned = await ensureOwnedGoal(id);
    if (!owned) {
      return NextResponse.json({ error: 'Savings goal not found.' }, { status: 404 });
    }

    await deleteSavingsGoal(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : 'Failed to delete savings goal.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
