import { NextRequest, NextResponse } from 'next/server';
import {
  addAccountBalanceAdjustment,
  createAccount,
  getAccountsWithBalances,
  setAccountArchived,
  updateAccount,
} from '@/lib/db';
import type { AccountType, PaymentMethod } from '@/lib/types';
import { ACCOUNT_TYPES, PAYMENT_METHODS } from '@/lib/types';
import { isAuthRequiredError } from '@/lib/supabase/server';

function handleRouteError(error: unknown, fallbackMessage: string): NextResponse {
  if (isAuthRequiredError(error)) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  return NextResponse.json({ error: message }, { status: 500 });
}

function parseBooleanFlag(value: string | null): boolean {
  if (!value) return false;
  return value.toLowerCase() === 'true' || value === '1';
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeAccountType(value: unknown): AccountType | undefined {
  if (typeof value !== 'string') return undefined;
  if (!ACCOUNT_TYPES.includes(value as AccountType)) return undefined;
  return value as AccountType;
}

function normalizePaymentMethod(value: unknown): PaymentMethod | undefined {
  if (typeof value !== 'string') return undefined;
  if (!PAYMENT_METHODS.includes(value as PaymentMethod)) return undefined;
  return value as PaymentMethod;
}

export function normalizeAccountAction(value: unknown): 'archive' | 'restore' | undefined {
  const normalized = normalizeText(value);
  if (normalized === 'archive' || normalized === 'restore') {
    return normalized;
  }
  return undefined;
}

export async function GET(request: NextRequest) {
  try {
    const includeArchived = parseBooleanFlag(request.nextUrl.searchParams.get('includeArchived'));
    const accounts = await getAccountsWithBalances({ includeArchived });
    return NextResponse.json(accounts);
  } catch (error) {
    return handleRouteError(error, 'Failed to load accounts.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = normalizeText(body.name);
    const type = normalizeAccountType(body.type);
    const initialBalance =
      typeof body.initialBalance === 'number' && Number.isFinite(body.initialBalance)
        ? body.initialBalance
        : 0;
    const expensePaymentMethod = Object.prototype.hasOwnProperty.call(body, 'expensePaymentMethod')
      ? normalizePaymentMethod(body.expensePaymentMethod)
      : undefined;

    if (!name) {
      return NextResponse.json({ error: 'Account name is required.' }, { status: 400 });
    }

    if (!type) {
      return NextResponse.json({ error: 'Invalid account type.' }, { status: 400 });
    }

    if (Object.prototype.hasOwnProperty.call(body, 'expensePaymentMethod') && !expensePaymentMethod) {
      return NextResponse.json({ error: 'Invalid expense payment method.' }, { status: 400 });
    }

    const account = await createAccount({
      name,
      type,
      expensePaymentMethod,
      initialBalance,
      color: normalizeText(body.color),
      icon: normalizeText(body.icon),
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'Failed to create account.');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const id = normalizeText(body.id);
    if (!id) {
      return NextResponse.json({ error: 'Account id is required.' }, { status: 400 });
    }

    const action = normalizeAccountAction(body.action);
    if (normalizeText(body.action) === 'delete') {
      const account = await setAccountArchived(id, true);
      return NextResponse.json(account);
    }

    if (normalizeText(body.action) === 'adjust-balance') {
      const amount =
        typeof body.amount === 'number' && Number.isFinite(body.amount)
          ? Number(body.amount.toFixed(2))
          : NaN;

      if (!Number.isFinite(amount) || amount === 0) {
        return NextResponse.json({ error: 'Adjustment amount must be non-zero.' }, { status: 400 });
      }

      const created = await addAccountBalanceAdjustment({
        accountId: id,
        amount,
        note: normalizeText(body.note),
        date: normalizeText(body.date),
      });

      return NextResponse.json({
        success: true,
        transactionId: created.id,
      });
    }

    if (action === 'archive') {
      const account = await setAccountArchived(id, true);
      return NextResponse.json(account);
    }

    if (action === 'restore') {
      const account = await setAccountArchived(id, false);
      return NextResponse.json(account);
    }

    const nextType = Object.prototype.hasOwnProperty.call(body, 'type')
      ? normalizeAccountType(body.type)
      : undefined;
    const nextExpensePaymentMethod = Object.prototype.hasOwnProperty.call(body, 'expensePaymentMethod')
      ? normalizePaymentMethod(body.expensePaymentMethod)
      : undefined;

    if (Object.prototype.hasOwnProperty.call(body, 'type') && !nextType) {
      return NextResponse.json({ error: 'Invalid account type.' }, { status: 400 });
    }

    if (Object.prototype.hasOwnProperty.call(body, 'expensePaymentMethod') && !nextExpensePaymentMethod) {
      return NextResponse.json({ error: 'Invalid expense payment method.' }, { status: 400 });
    }

    const account = await updateAccount(id, {
      name: Object.prototype.hasOwnProperty.call(body, 'name') ? normalizeText(body.name) : undefined,
      type: nextType,
      expensePaymentMethod: nextExpensePaymentMethod,
      color: Object.prototype.hasOwnProperty.call(body, 'color') ? normalizeText(body.color) ?? null : undefined,
      icon: Object.prototype.hasOwnProperty.call(body, 'icon') ? normalizeText(body.icon) ?? null : undefined,
      initialBalance: Object.prototype.hasOwnProperty.call(body, 'initialBalance')
        ? (typeof body.initialBalance === 'number' && Number.isFinite(body.initialBalance)
          ? body.initialBalance
          : 0)
        : undefined,
    });

    return NextResponse.json(account);
  } catch (error) {
    return handleRouteError(error, 'Failed to update account.');
  }
}
