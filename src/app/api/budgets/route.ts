import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getBudgets, setBudget, deleteBudget } from '@/lib/db';
import type { Budget, BudgetInput } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';
import { broadcastBudgetEvent } from '@/lib/transaction-ws-server';

const VALID_THRESHOLDS = [50, 80, 100] as const;

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeThresholds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.filter(
        (entry): entry is (typeof VALID_THRESHOLDS)[number] =>
          VALID_THRESHOLDS.includes(entry as (typeof VALID_THRESHOLDS)[number])
      )
    )
  ).sort((a, b) => a - b);
}

export async function GET() {
  const budgets = await getBudgets();
  return NextResponse.json(budgets);
}

export async function POST(request: NextRequest) {
  const body: BudgetInput = await request.json();

  if (!body.month || !/^\d{4}-\d{2}$/.test(body.month)) {
    return NextResponse.json({ error: 'Month must use YYYY-MM format.' }, { status: 400 });
  }

  const category = body.category || 'Overall';
  if (category !== 'Overall' && !CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Invalid category.' }, { status: 400 });
  }

  if (!body.monthlyLimit || body.monthlyLimit <= 0) {
    return NextResponse.json({ error: 'Monthly limit must be positive' }, { status: 400 });
  }

  const subCategory = category === 'Overall' ? undefined : normalizeText(body.subCategory);

  const existingBudgets = await getBudgets();
  const existingBudget = existingBudgets.find(
    (entry) =>
      (body.id ? entry.id === body.id : false) ||
      (
        entry.category === category &&
        entry.month === body.month &&
        (entry.subCategory || '') === (subCategory || '')
      )
  );

  const budget: Budget = {
    id: body.id || uuidv4(),
    category,
    subCategory,
    monthlyLimit: Number(body.monthlyLimit.toFixed(2)),
    month: body.month,
    rollover: Boolean(body.rollover),
    alertThresholdsTriggered: normalizeThresholds(body.alertThresholdsTriggered),
  };

  const savedBudget = await setBudget(budget);
  broadcastBudgetEvent(existingBudget ? 'budget:edit' : 'budget:add', savedBudget);

  return NextResponse.json(savedBudget, { status: existingBudget ? 200 : 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }

  const deleted = await deleteBudget(id);
  if (!deleted) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  broadcastBudgetEvent('budget:delete', { id });

  return NextResponse.json({ success: true });
}
