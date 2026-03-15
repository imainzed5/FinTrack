import { NextResponse } from 'next/server';
import {
  getTransactions,
  getBudgets,
  processRecurringTransactions,
  saveBudgets,
  saveBudgetThresholdAlerts,
} from '@/lib/db';
import { buildDashboardData, mergeTriggeredBudgetThresholds } from '@/lib/insights-engine';
import { isAuthRequiredError } from '@/lib/supabase/server';

export async function GET() {
  try {
    await processRecurringTransactions();
    const transactions = await getTransactions();
    const budgets = await getBudgets();
    const dashboard = buildDashboardData(transactions, budgets);

    if (dashboard.budgetAlerts.length > 0) {
      const merged = mergeTriggeredBudgetThresholds(budgets, dashboard.budgetAlerts);
      await Promise.all([
        saveBudgets(merged),
        saveBudgetThresholdAlerts(dashboard.budgetAlerts),
      ]);
    }

    return NextResponse.json(dashboard);
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : 'Failed to load dashboard.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
