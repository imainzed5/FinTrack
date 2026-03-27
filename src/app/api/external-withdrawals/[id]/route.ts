import { NextRequest, NextResponse } from 'next/server';
import { updateExternalWithdrawalRequestStatus } from '@/lib/db';
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const action = normalizeText(body.action);

    if (action !== 'complete' && action !== 'fail') {
      return NextResponse.json({ error: 'Action must be complete or fail.' }, { status: 400 });
    }

    const updated = await updateExternalWithdrawalRequestStatus({
      id,
      action,
      providerRef: normalizeText(body.providerRef),
      failureReason: normalizeText(body.failureReason),
      metadata: normalizeMetadata(body.metadata),
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleRouteError(error, 'Failed to update external withdrawal request.');
  }
}
