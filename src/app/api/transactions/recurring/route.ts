import { NextResponse } from 'next/server';
import { processRecurringTransactions } from '@/lib/db';
import { broadcastTransactionEvent } from '@/lib/transaction-ws-server';
import { isAuthRequiredError } from '@/lib/supabase/server';

function handleRouteError(error: unknown): NextResponse {
  if (isAuthRequiredError(error)) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const message = error instanceof Error ? error.message : 'Failed to process recurring transactions.';
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST() {
  try {
    const result = await processRecurringTransactions();

    if (result.created > 0) {
      broadcastTransactionEvent('transaction:edit', {
        reason: 'recurring',
        created: result.created,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET() {
  try {
    const result = await processRecurringTransactions();

    if (result.created > 0) {
      broadcastTransactionEvent('transaction:edit', {
        reason: 'recurring',
        created: result.created,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
