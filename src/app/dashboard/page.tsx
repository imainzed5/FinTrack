import { redirect } from 'next/navigation';
import DashboardClientPage from '@/components/pages/DashboardClientPage';
import {
  getTransactions,
  getBudgets,
  saveBudgets,
  saveBudgetThresholdAlerts,
} from '@/lib/db';
import {
  buildDashboardData,
  computeMonthlySavingsHistory,
  mergeTriggeredBudgetThresholds,
} from '@/lib/insights-engine';
import { scheduleRecurringProcessing } from '@/lib/recurring-scheduler';
import { isAuthRequiredError } from '@/lib/supabase/server';
import type { DashboardData, MonthlySavings } from '@/lib/types';

export default async function DashboardPage() {
  let initialData: DashboardData | null = null;
  let initialSavings: MonthlySavings[] = [];

  try {
    void scheduleRecurringProcessing();

    const [transactions, budgets] = await Promise.all([
      getTransactions(),
      getBudgets(),
    ]);

    const dashboard = buildDashboardData(transactions, budgets);
    const savings = computeMonthlySavingsHistory(transactions, budgets);

    if (dashboard.budgetAlerts.length > 0) {
      const mergedBudgets = mergeTriggeredBudgetThresholds(budgets, dashboard.budgetAlerts);
      await Promise.all([
        saveBudgets(mergedBudgets),
        saveBudgetThresholdAlerts(dashboard.budgetAlerts),
      ]);
    }

    initialData = dashboard;
    initialSavings = savings;
  } catch (error) {
    if (isAuthRequiredError(error)) {
      redirect('/auth/login?next=%2Fdashboard');
    }
  }

  return (
    <DashboardClientPage
      initialData={initialData}
      initialSavings={initialSavings}
    />
  );
}
