import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getBudgets, setBudget, deleteBudget } from '@/lib/db';
import { BUDGET_ALERT_THRESHOLDS } from '@/lib/budgeting';
import type { Budget, BudgetInput } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';
import { isAuthRequiredError } from '@/lib/supabase/server';

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
        (entry): entry is (typeof BUDGET_ALERT_THRESHOLDS)[number] =>
          BUDGET_ALERT_THRESHOLDS.includes(entry as (typeof BUDGET_ALERT_THRESHOLDS)[number])
      )
    )
  ).sort((a, b) => a - b);
}

export async function GET() {
  try {
    const budgets = await getBudgets();
    return NextResponse.json(budgets);
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : 'Failed to load budgets.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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
    return NextResponse.json(savedBudget, { status: existingBudget ? 200 : 201 });
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : 'Failed to save budget.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const deleted = await deleteBudget(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : 'Failed to delete budget.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
