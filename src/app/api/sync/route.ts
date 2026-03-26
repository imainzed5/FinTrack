import { NextRequest, NextResponse } from 'next/server';
import { addTransaction, resolveDefaultAccountId } from '@/lib/db';
import type { Transaction } from '@/lib/types';
import { isAuthRequiredError } from '@/lib/supabase/server';

async function resolveDefaultAccountIdWithRetry(maxAttempts = 3): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await resolveDefaultAccountId();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to resolve default account.');
}

export async function POST(request: NextRequest) {
  try {
    const body: { transactions: Transaction[] } = await request.json();

    if (!Array.isArray(body.transactions)) {
      return NextResponse.json({ error: 'Transactions array required' }, { status: 400 });
    }

    const synced: string[] = [];
    let defaultAccountId: string | null = null;

    for (const tx of body.transactions) {
      try {
        let accountId = tx.accountId;
        if (!accountId) {
          if (!defaultAccountId) {
            defaultAccountId = await resolveDefaultAccountIdWithRetry();
          }
          accountId = defaultAccountId;
        }

        const saved = await addTransaction({ ...tx, accountId, synced: true });
        synced.push(saved.id);
      } catch {
        // Keep unsynced transaction in queue; next sync pass can retry safely.
      }
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
