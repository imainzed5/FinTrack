import { NextResponse } from 'next/server';
import { getTransactions, getBudgets, processRecurringTransactions } from '@/lib/db';
import { computeMonthlySavingsHistory } from '@/lib/insights-engine';
import { isAuthRequiredError } from '@/lib/supabase/server';

export async function GET() {
  try {
    await processRecurringTransactions();
    const [transactions, budgets] = await Promise.all([getTransactions(), getBudgets()]);
    const savings = computeMonthlySavingsHistory(transactions, budgets);
    return NextResponse.json(savings);
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : 'Failed to load savings.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
