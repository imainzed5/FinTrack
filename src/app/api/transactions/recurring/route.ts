import { NextResponse } from 'next/server';
import { processRecurringTransactions } from '@/lib/db';
import { broadcastTransactionEvent } from '@/lib/transaction-ws-server';

export async function POST() {
  const result = await processRecurringTransactions();

  if (result.created > 0) {
    broadcastTransactionEvent('transaction:edit', {
      reason: 'recurring',
      created: result.created,
    });
  }

  return NextResponse.json(result);
}

export async function GET() {
  const result = await processRecurringTransactions();

  if (result.created > 0) {
    broadcastTransactionEvent('transaction:edit', {
      reason: 'recurring',
      created: result.created,
    });
  }

  return NextResponse.json(result);
}
