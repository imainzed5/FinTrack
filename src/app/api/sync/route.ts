import { NextRequest, NextResponse } from 'next/server';
import { addTransaction } from '@/lib/db';
import type { Transaction } from '@/lib/types';
import { broadcastTransactionEvent } from '@/lib/transaction-ws-server';

export async function POST(request: NextRequest) {
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
}
