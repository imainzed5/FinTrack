import { NextResponse } from 'next/server';
import { processRecurringTransactions, getActiveRecurringTransactions } from '@/lib/db';
import { isAuthRequiredError } from '@/lib/supabase/server';

function handleRouteError(error: unknown): NextResponse {
  if (isAuthRequiredError(error)) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const message = error instanceof Error ? error.message : 'Failed to process recurring transactions.';
  return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * GET /api/transactions/recurring
 * Returns all active recurring origin transactions for the management UI.
 */
export async function GET() {
  try {
    const transactions = await getActiveRecurringTransactions();
    return NextResponse.json(transactions);
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * POST /api/transactions/recurring
 * Triggers the recurring transaction processor (creates due instances).
 */
export async function POST() {
  try {
    const result = await processRecurringTransactions();
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
