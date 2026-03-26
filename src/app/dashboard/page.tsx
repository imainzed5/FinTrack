import DashboardClientPage from '../../components/pages/DashboardClientPage';
import {
  getBudgets,
  getTotalBalance,
  getTransactions,
  processRecurringTransactions,
  saveBudgets,
  saveBudgetThresholdAlerts,
} from '@/lib/db';
import { buildDashboardData, mergeTriggeredBudgetThresholds } from '@/lib/insights-engine';
import { createSupabaseServerClient, isAuthRequiredError } from '@/lib/supabase/server';
import type { DashboardData } from '@/lib/types';

export const dynamic = 'force-dynamic';

const EMPTY_DASHBOARD_DATA: DashboardData = {
  totalSpentThisMonth: 0,
  totalSpentLastMonth: 0,
  totalBalance: 0,
  remainingBudget: 0,
  monthlyBudget: 0,
  savingsRate: 0,
  expenseGrowthRate: 0,
  budgetStatuses: [],
  budgetAlerts: [],
  categoryBreakdown: [],
  weeklySpending: [],
  dailySpending: [],
  calendarSpending: [],
  currentMonthTransactions: [],
  recentTransactions: [],
  insights: [],
};

async function loadDashboardData(): Promise<DashboardData> {
  try {
    await processRecurringTransactions();
    const [transactions, budgets, totalBalance] = await Promise.all([
      getTransactions(),
      getBudgets(),
      getTotalBalance(),
    ]);
    const dashboard = buildDashboardData(transactions, budgets);

    if (dashboard.budgetAlerts.length > 0) {
      const mergedBudgets = mergeTriggeredBudgetThresholds(budgets, dashboard.budgetAlerts);
      await Promise.all([
        saveBudgets(mergedBudgets),
        saveBudgetThresholdAlerts(dashboard.budgetAlerts),
      ]);
    }

    return { ...dashboard, totalBalance };
  } catch (error) {
    if (!isAuthRequiredError(error)) {
      console.error('Failed to load dashboard data:', error);
    }

    return EMPTY_DASHBOARD_DATA;
  }
}

function deriveFirstName(value: string): string {
  const normalized = value.includes('@') ? value.split('@')[0] : value;
  const firstToken = normalized.trim().split(/\s+/)[0];
  return firstToken || 'there';
}

async function loadViewerIdentity(): Promise<{ firstName: string; userId: string }> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const metadata = user?.user_metadata;
    const metadataFullName =
      metadata &&
      typeof metadata === 'object' &&
      'full_name' in metadata &&
      typeof (metadata as { full_name?: unknown }).full_name === 'string'
        ? ((metadata as { full_name?: string }).full_name ?? '').trim()
        : '';

    const fullName = metadataFullName || user?.email || 'there';
    return {
      firstName: deriveFirstName(fullName),
      userId: user?.id ?? '',
    };
  } catch {
    return { firstName: 'there', userId: '' };
  }
}

export default async function DashboardPage() {
  const [data, viewerIdentity] = await Promise.all([
    loadDashboardData(),
    loadViewerIdentity(),
  ]);

  return (
    <DashboardClientPage
      data={data}
      firstName={viewerIdentity.firstName}
      userId={viewerIdentity.userId}
    />
  );
}
