import { NextResponse } from 'next/server';
import {
  getTransactions,
  getBudgets,
  processRecurringTransactions,
  saveBudgets,
} from '@/lib/db';
import { buildDashboardData, mergeTriggeredBudgetThresholds } from '@/lib/insights-engine';

export async function GET() {
  await processRecurringTransactions();
  const transactions = await getTransactions();
  const budgets = await getBudgets();
  const dashboard = buildDashboardData(transactions, budgets);

  if (dashboard.budgetAlerts.length > 0) {
    const merged = mergeTriggeredBudgetThresholds(budgets, dashboard.budgetAlerts);
    await saveBudgets(merged);
  }

  return NextResponse.json(dashboard);
}
