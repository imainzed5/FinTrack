import { NextRequest, NextResponse } from 'next/server';
import { addTransaction } from '@/lib/db';
import type { Transaction } from '@/lib/types';
import { broadcastTransactionEvent } from '@/lib/transaction-ws-server';
import { isAuthRequiredError } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body: { transactions: Transaction[] } = await request.json();

    if (!Array.isArray(body.transactions)) {
      return NextResponse.json({ error: 'Transactions array required' }, { status: 400 });
    }

    const synced: string[] = [];
    for (const tx of body.transactions) {
      const saved = await addTransaction({ ...tx, synced: true });
      synced.push(saved.id);
      broadcastTransactionEvent('transaction:add', saved);
    }

    return NextResponse.json({ synced });
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : 'Failed to sync transactions.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
