import { NextResponse } from 'next/server';
import { getTransactions, getBudgets, processRecurringTransactions } from '@/lib/db';
import { computeMonthlySavingsHistory } from '@/lib/insights-engine';

export async function GET() {
  await processRecurringTransactions();
  const [transactions, budgets] = await Promise.all([getTransactions(), getBudgets()]);
  const savings = computeMonthlySavingsHistory(transactions, budgets);
  return NextResponse.json(savings);
}
