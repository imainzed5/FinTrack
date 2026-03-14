import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getTransactions, addTransaction, deleteTransaction, updateTransaction } from '@/lib/db';
import type { Transaction, TransactionInput } from '@/lib/types';
import { CATEGORIES, PAYMENT_METHODS } from '@/lib/types';

export async function GET(request: NextRequest) {
  const transactions = await getTransactions();
  const { searchParams } = request.nextUrl;

  let filtered = transactions;

  const month = searchParams.get('month');
  if (month) {
    filtered = filtered.filter((t) => t.date.startsWith(month));
  }

  const category = searchParams.get('category');
  if (category) {
    filtered = filtered.filter((t) => t.category === category);
  }

  filtered.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return NextResponse.json(filtered);
}

export async function POST(request: NextRequest) {
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

  const now = new Date().toISOString();
  const transaction: Transaction = {
    id: uuidv4(),
    amount: body.amount,
    category: body.category,
    date: body.date || now,
    paymentMethod: body.paymentMethod || 'Cash',
    notes: body.notes || '',
    tags: body.tags || [],
    createdAt: now,
    updatedAt: now,
    synced: true,
  };

  await addTransaction(transaction);
  return NextResponse.json(transaction, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }
  const deleted = await deleteTransaction(id);
  if (!deleted) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }
  const updated = await updateTransaction(id, updates);
  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(updated);
}
