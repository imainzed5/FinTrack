import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getBudgets, setBudget, deleteBudget } from '@/lib/db';
import type { Budget } from '@/lib/types';

export async function GET() {
  const budgets = await getBudgets();
  return NextResponse.json(budgets);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.monthlyLimit || body.monthlyLimit <= 0) {
    return NextResponse.json({ error: 'Monthly limit must be positive' }, { status: 400 });
  }

  const budget: Budget = {
    id: body.id || uuidv4(),
    category: body.category || 'Overall',
    monthlyLimit: body.monthlyLimit,
    month: body.month,
  };

  await setBudget(budget);
  return NextResponse.json(budget, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }
  await deleteBudget(id);
  return NextResponse.json({ success: true });
}
