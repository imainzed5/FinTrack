import { NextResponse } from 'next/server';
import { getTransactions, getBudgets } from '@/lib/db';
import { buildDashboardData } from '@/lib/insights-engine';

export async function GET() {
  const transactions = await getTransactions();
  const budgets = await getBudgets();
  const dashboard = buildDashboardData(transactions, budgets);
  return NextResponse.json(dashboard);
}
