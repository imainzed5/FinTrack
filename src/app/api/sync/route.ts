import { NextRequest, NextResponse } from 'next/server';
import { addTransaction } from '@/lib/db';
import type { Transaction } from '@/lib/types';

export async function POST(request: NextRequest) {
  const body: { transactions: Transaction[] } = await request.json();

  if (!Array.isArray(body.transactions)) {
    return NextResponse.json({ error: 'Transactions array required' }, { status: 400 });
  }

  const synced: string[] = [];
  for (const tx of body.transactions) {
    await addTransaction({ ...tx, synced: true });
    synced.push(tx.id);
  }

  return NextResponse.json({ synced });
}
