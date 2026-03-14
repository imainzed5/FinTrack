import { NextResponse } from 'next/server';
import { getTransactions, getBudgets } from '@/lib/db';
import { computeMonthlySavingsHistory } from '@/lib/insights-engine';

export async function GET() {
  const [transactions, budgets] = await Promise.all([getTransactions(), getBudgets()]);
  const savings = computeMonthlySavingsHistory(transactions, budgets);
  return NextResponse.json(savings);
}
