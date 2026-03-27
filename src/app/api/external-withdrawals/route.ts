import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  createExternalWithdrawalRequest,
  getExternalWithdrawalRequests,
} from '@/lib/db';
import { isAuthRequiredError } from '@/lib/supabase/server';

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeMetadata(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function handleRouteError(error: unknown, fallbackMessage: string): NextResponse {
  if (isAuthRequiredError(error)) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  return NextResponse.json({ error: message }, { status: 500 });
}

export function validateExternalWithdrawalBody(body: unknown):
  | {
      ok: true;
      data: {
        fromAccountId: string;
        amount: number;
        feeAmount: number;
        destinationSummary: string;
        etaAt?: string;
        idempotencyKey: string;
        metadata?: Record<string, unknown>;
      };
    }
  | { ok: false; error: string } {
  const payload = (body ?? {}) as Record<string, unknown>;
  const fromAccountId = normalizeText(payload.fromAccountId);
  const destinationSummary = normalizeText(payload.destinationSummary);
  const amount = typeof payload.amount === 'number' && Number.isFinite(payload.amount)
    ? Number(payload.amount.toFixed(2))
    : NaN;
  const feeAmount = typeof payload.feeAmount === 'number' && Number.isFinite(payload.feeAmount)
    ? Number(payload.feeAmount.toFixed(2))
    : 0;

  if (!fromAccountId) {
    return { ok: false, error: 'fromAccountId is required.' };
  }

  if (!destinationSummary) {
    return { ok: false, error: 'destinationSummary is required.' };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Amount must be greater than zero.' };
  }

  if (!Number.isFinite(feeAmount) || feeAmount < 0) {
    return { ok: false, error: 'Fee amount must be zero or greater.' };
  }

  if (feeAmount >= amount) {
    return { ok: false, error: 'Fee amount must be lower than the payout amount.' };
  }

  return {
    ok: true,
    data: {
      fromAccountId,
      amount,
      feeAmount,
      destinationSummary,
      etaAt: normalizeText(payload.etaAt),
      idempotencyKey: normalizeText(payload.idempotencyKey) ?? randomUUID(),
      metadata: normalizeMetadata(payload.metadata),
    },
  };
}

export async function GET() {
  try {
    const requests = await getExternalWithdrawalRequests();
    return NextResponse.json(requests);
  } catch (error) {
    return handleRouteError(error, 'Failed to load external withdrawal requests.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = validateExternalWithdrawalBody(body);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const created = await createExternalWithdrawalRequest(validated.data);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'Failed to create external withdrawal request.');
  }
}
