import { NextRequest, NextResponse } from 'next/server';
import { createTransfer } from '@/lib/db';
import { isAuthRequiredError } from '@/lib/supabase/server';

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function validateTransferBody(body: unknown):
  | {
      ok: true;
      data: {
        fromAccountId: string;
        toAccountId: string;
        amount: number;
        date?: string;
        notes?: string;
        metadata?: Record<string, unknown>;
      };
    }
  | { ok: false; error: string } {
  const payload = (body ?? {}) as Record<string, unknown>;
  const fromAccountId = normalizeText(payload.fromAccountId);
  const toAccountId = normalizeText(payload.toAccountId);
  const amount =
    typeof payload.amount === 'number' && Number.isFinite(payload.amount)
      ? Number(payload.amount.toFixed(2))
      : NaN;

  if (!fromAccountId || !toAccountId) {
    return { ok: false, error: 'fromAccountId and toAccountId are required.' };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Amount must be greater than zero.' };
  }

  if (fromAccountId === toAccountId) {
    return { ok: false, error: 'Cannot transfer to the same account.' };
  }

  return {
    ok: true,
    data: {
      fromAccountId,
      toAccountId,
      amount,
      date: normalizeText(payload.date),
      notes: normalizeText(payload.notes),
      metadata: typeof payload.metadata === 'object' && payload.metadata
        ? (payload.metadata as Record<string, unknown>)
        : undefined,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = validateTransferBody(body);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const receipt = await createTransfer({
      fromAccountId: validated.data.fromAccountId,
      toAccountId: validated.data.toAccountId,
      amount: validated.data.amount,
      date: validated.data.date,
      notes: validated.data.notes,
      metadata: validated.data.metadata,
    });

    return NextResponse.json(receipt, { status: 201 });
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : 'Failed to create transfer.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
