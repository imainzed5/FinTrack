import { NextRequest, NextResponse } from 'next/server';
import { createSavingsGoal, getSavingsGoalsSummary } from '@/lib/db';
import type { SavingsGoalInput } from '@/lib/types';
import { isAuthRequiredError, requireSupabaseUser } from '@/lib/supabase/server';

export async function GET() {
  try {
    await requireSupabaseUser();
    const summary = await getSavingsGoalsSummary();
    return NextResponse.json(summary);
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : 'Failed to load savings goals.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSupabaseUser();
    const body = (await request.json()) as SavingsGoalInput;

    if (!body?.name || !body?.emoji || !body?.colorAccent || typeof body?.targetAmount !== 'number') {
      return NextResponse.json({ error: 'Invalid savings goal input.' }, { status: 400 });
    }

    const goal = await createSavingsGoal(body);
    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : 'Failed to create savings goal.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
