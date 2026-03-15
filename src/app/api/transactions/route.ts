import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  getTransactions,
  addTransaction,
  deleteTransaction,
  updateTransaction,
  processRecurringTransactions,
  buildRecurringConfig,
} from '@/lib/db';
import { broadcastTransactionEvent } from '@/lib/transaction-ws-server';
import type { Category, Transaction, TransactionInput, TransactionSplit } from '@/lib/types';
import { CATEGORIES, PAYMENT_METHODS, RECURRING_FREQUENCIES } from '@/lib/types';
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

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  );
}

function parseSplit(splitInput: unknown):
  | { split: TransactionSplit[]; total: number }
  | { error: string } {
  if (!Array.isArray(splitInput)) {
    return { error: 'Split payload must be an array.' };
  }

  if (splitInput.length < 2) {
    return { error: 'Split transactions require at least 2 category lines.' };
  }

  const split: TransactionSplit[] = [];
  let total = 0;

  for (const line of splitInput) {
    if (!line || typeof line !== 'object') {
      return { error: 'Each split line must be an object.' };
    }

    const candidate = line as Partial<TransactionSplit>;
    if (!candidate.category || !CATEGORIES.includes(candidate.category)) {
      return { error: 'Each split line must use a valid category.' };
    }
    if (
      typeof candidate.amount !== 'number' ||
      !Number.isFinite(candidate.amount) ||
      candidate.amount <= 0
    ) {
      return { error: 'Each split line amount must be positive.' };
    }

    const subCategory = normalizeText(candidate.subCategory);

    split.push({
      id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : uuidv4(),
      category: candidate.category,
      subCategory,
      amount: Number(candidate.amount.toFixed(2)),
    });
    total += candidate.amount;
  }

  return { split, total: Number(total.toFixed(2)) };
}

function parseCategoryFilters(searchParams: URLSearchParams): Category[] {
  const categoryParams = searchParams
    .getAll('categories')
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
  const legacyCategory = searchParams.get('category');

  if (legacyCategory && legacyCategory.trim()) {
    categoryParams.push(legacyCategory.trim());
  }

  const uniqueValues = Array.from(new Set(categoryParams));
  return uniqueValues.filter((value): value is Category => CATEGORIES.includes(value as Category));
}

export async function GET(request: NextRequest) {
  try {
    await processRecurringTransactions();
    const transactions = await getTransactions();
    const { searchParams } = request.nextUrl;

    let filtered = transactions;

    const month = searchParams.get('month');
    if (month) {
      filtered = filtered.filter((t) => t.date.startsWith(month));
    }

    const categoryFilters = parseCategoryFilters(searchParams);
    if (categoryFilters.length > 0) {
      const selectedCategories = new Set(categoryFilters);
      filtered = filtered.filter(
        (t) =>
          selectedCategories.has(t.category) ||
          (Array.isArray(t.split) && t.split.some((line) => selectedCategories.has(line.category)))
      );
    }

    filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return NextResponse.json(filtered);
  } catch (error) {
    return handleRouteError(error, 'Failed to load transactions.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: TransactionInput = await request.json();

    if (!body.amount || body.amount <= 0) {
      return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 });
    }
    if (!body.category || !CATEGORIES.includes(body.category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }
    if (body.paymentMethod && !PAYMENT_METHODS.includes(body.paymentMethod)) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }

    let normalizedSplit: TransactionSplit[] | undefined;
    let splitTotal = 0;
    if (body.split) {
      const parsedSplit = parseSplit(body.split);
      if ('error' in parsedSplit) {
        return NextResponse.json({ error: parsedSplit.error }, { status: 400 });
      }
      normalizedSplit = parsedSplit.split;
      splitTotal = parsedSplit.total;
      if (Math.abs(splitTotal - body.amount) > 0.01) {
        return NextResponse.json(
          { error: 'Split amounts must add up to the transaction total.' },
          { status: 400 }
        );
      }
    }

    if (body.recurring && !RECURRING_FREQUENCIES.includes(body.recurring.frequency)) {
      return NextResponse.json({ error: 'Invalid recurring frequency' }, { status: 400 });
    }

    const normalizedDate = body.date ? new Date(body.date).toISOString() : new Date().toISOString();
    const merchant = normalizeText(body.merchant);
    const description = normalizeText(body.description) || normalizeText(body.notes) || body.category;
    const notes = normalizeText(body.notes) || '';
    const tags = normalizeTags(body.tags);
    const attachmentBase64 = normalizeText(body.attachmentBase64);

    const recurring = body.recurring
      ? buildRecurringConfig(
          normalizedDate,
          body.recurring.frequency,
          body.recurring.interval,
          body.recurring.endDate
        )
      : undefined;

    const now = new Date().toISOString();
    const transaction: Transaction = {
      id: uuidv4(),
      amount: normalizedSplit ? splitTotal : Number(body.amount.toFixed(2)),
      category: normalizedSplit?.[0]?.category || body.category,
      subCategory: normalizedSplit?.[0]?.subCategory || normalizeText(body.subCategory),
      merchant,
      description,
      date: normalizedDate,
      paymentMethod: body.paymentMethod || 'Cash',
      notes,
      tags,
      attachmentBase64,
      split: normalizedSplit,
      recurring,
      createdAt: now,
      updatedAt: now,
      synced: true,
    };

    const created = await addTransaction(transaction);
    broadcastTransactionEvent('transaction:add', created);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'Failed to add transaction.');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }
    const deleted = await deleteTransaction(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    broadcastTransactionEvent('transaction:delete', { id });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'Failed to delete transaction.');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const transactions = await getTransactions();
    const existing = transactions.find((tx) => tx.id === id);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (updates.category && !CATEGORIES.includes(updates.category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    if (updates.paymentMethod && !PAYMENT_METHODS.includes(updates.paymentMethod)) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }

    let normalizedSplit: TransactionSplit[] | undefined;
    if (Object.prototype.hasOwnProperty.call(updates, 'split')) {
      if (updates.split) {
        const parsedSplit = parseSplit(updates.split);
        if ('error' in parsedSplit) {
          return NextResponse.json({ error: parsedSplit.error }, { status: 400 });
        }
        normalizedSplit = parsedSplit.split;
        const targetAmount =
          typeof updates.amount === 'number' && Number.isFinite(updates.amount)
            ? updates.amount
            : existing.amount;
        if (Math.abs(parsedSplit.total - targetAmount) > 0.01) {
          return NextResponse.json(
            { error: 'Split amounts must add up to the transaction total.' },
            { status: 400 }
          );
        }
      } else {
        normalizedSplit = undefined;
      }
    }

    if (
      typeof updates.amount === 'number' &&
      (!Number.isFinite(updates.amount) || updates.amount <= 0)
    ) {
      return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 });
    }

    const baseDate =
      typeof updates.date === 'string'
        ? new Date(updates.date).toISOString()
        : existing.date;

    let recurring = existing.recurring;
    if (Object.prototype.hasOwnProperty.call(updates, 'recurring')) {
      if (!updates.recurring) {
        recurring = undefined;
      } else {
        if (!RECURRING_FREQUENCIES.includes(updates.recurring.frequency)) {
          return NextResponse.json({ error: 'Invalid recurring frequency' }, { status: 400 });
        }
        recurring = buildRecurringConfig(
          baseDate,
          updates.recurring.frequency,
          updates.recurring.interval,
          updates.recurring.endDate
        );
      }
    }

    const normalizedUpdates: Partial<Transaction> = {};

    if (typeof updates.amount === 'number' && Number.isFinite(updates.amount)) {
      normalizedUpdates.amount = Number(updates.amount.toFixed(2));
    }

    if (typeof updates.date === 'string') {
      normalizedUpdates.date = new Date(updates.date).toISOString();
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'category') && updates.category) {
      normalizedUpdates.category = updates.category;
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'subCategory')) {
      normalizedUpdates.subCategory = normalizeText(updates.subCategory);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'paymentMethod') && updates.paymentMethod) {
      normalizedUpdates.paymentMethod = updates.paymentMethod;
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'merchant')) {
      normalizedUpdates.merchant = normalizeText(updates.merchant);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'description')) {
      normalizedUpdates.description = normalizeText(updates.description);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'notes')) {
      normalizedUpdates.notes = normalizeText(updates.notes) || '';
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'tags')) {
      normalizedUpdates.tags = normalizeTags(updates.tags);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'attachmentBase64')) {
      normalizedUpdates.attachmentBase64 = normalizeText(updates.attachmentBase64);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'split')) {
      normalizedUpdates.split = normalizedSplit;
      if (normalizedSplit && normalizedSplit.length > 0) {
        normalizedUpdates.category = normalizedSplit[0].category;
        normalizedUpdates.subCategory = normalizedSplit[0].subCategory;
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'recurring')) {
      normalizedUpdates.recurring = recurring;
    }

    const updated = await updateTransaction(id, normalizedUpdates);

    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    broadcastTransactionEvent('transaction:edit', updated);

    return NextResponse.json(updated);
  } catch (error) {
    return handleRouteError(error, 'Failed to update transaction.');
  }
}
