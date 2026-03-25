import { NextRequest, NextResponse } from 'next/server';
import { createDebt, deleteDebt, getDebts, settleDebt, updateDebt } from '@/lib/debts';
import type { DebtDirection } from '@/lib/types';
import { isAuthRequiredError } from '@/lib/supabase/server';

function handleRouteError(error: unknown, fallbackMessage: string): NextResponse {
  if (isAuthRequiredError(error)) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  return NextResponse.json({ error: message }, { status: 500 });
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isDebtDirection(value: unknown): value is DebtDirection {
  return value === 'owed' || value === 'owing';
}

export async function GET() {
  try {
    const debts = await getDebts();
    return NextResponse.json(debts);
  } catch (error) {
    return handleRouteError(error, 'Failed to load debts.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      direction?: unknown;
      personName?: unknown;
      amount?: unknown;
      reason?: unknown;
      date?: unknown;
    };

    if (!isDebtDirection(body.direction)) {
      return NextResponse.json({ error: 'Invalid debt direction.' }, { status: 400 });
    }

    const personName = normalizeText(body.personName);
    if (!personName) {
      return NextResponse.json({ error: 'Person is required.' }, { status: 400 });
    }

    const reason = normalizeText(body.reason);
    if (!reason) {
      return NextResponse.json({ error: 'Reason is required.' }, { status: 400 });
    }

    const amount = typeof body.amount === 'number' ? body.amount : Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero.' }, { status: 400 });
    }

    const date = typeof body.date === 'string' ? body.date : undefined;

    const debt = await createDebt({
      direction: body.direction,
      personName,
      amount: Number(amount.toFixed(2)),
      reason,
      date,
    });

    return NextResponse.json(debt, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'Failed to create debt.');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID required.' }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as {
      action?: unknown;
      personName?: unknown;
      amount?: unknown;
      reason?: unknown;
      date?: unknown;
      direction?: unknown;
    } | null;

    if (!body) {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
    }

    if (body.action === 'settle') {
      const settled = await settleDebt(id);
      if (!settled) {
        return NextResponse.json({ error: 'Debt not found.' }, { status: 404 });
      }

      return NextResponse.json(settled);
    }

    const personName = normalizeText(body.personName);
    const reason = normalizeText(body.reason);
    const amount = typeof body.amount === 'number' ? body.amount : Number(body.amount);
    const date = typeof body.date === 'string' ? body.date : undefined;

    if (!personName || !reason || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid debt update payload.' }, { status: 400 });
    }

    const updated = await updateDebt(id, {
      personName,
      reason,
      amount: Number(amount.toFixed(2)),
      date,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Debt not found.' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    return handleRouteError(error, 'Failed to update debt.');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID required.' }, { status: 400 });
    }

    const deleted = await deleteDebt(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Debt not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'Failed to delete debt.');
  }
}
