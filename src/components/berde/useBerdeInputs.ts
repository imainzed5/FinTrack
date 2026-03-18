import { useMemo } from 'react';
import type { DashboardData, Transaction } from '@/lib/types';
import type { BerdeInputs } from '@/components/berde/berde.types';

/**
 * Derives BerdeInputs from Moneda's existing DashboardData + transactions.
 * Drop this hook into DashboardClientPage and pass the result to <BerdeCard>.
 */
export function useBerdeInputs(
  dashboard: DashboardData,
  recentTransactions: Transaction[],
  daysUntilPayday: number,
): BerdeInputs {
  return useMemo(() => {
    const overallStatus = dashboard.budgetStatuses.find(
      (status) => status.category === 'Overall' && !status.subCategory,
    );
    const totalBudget = overallStatus?.effectiveLimit ?? dashboard.monthlyBudget ?? 0;
    const totalSpent = overallStatus?.spent ?? dashboard.totalSpentThisMonth ?? 0;
    const budgetUsedPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    const savingsRate = dashboard.savingsRate;

    const savingsGoalHit =
      savingsRate >= 20 ||
      dashboard.insights.some(
        (insight) =>
          insight.insightType === 'saving' && /goal|target/i.test(insight.message),
      );

    const savingsMilestoneHit = dashboard.insights.some(
      (insight) =>
        insight.insightType === 'saving' && /milestone|streak|record/i.test(insight.message),
    );

    const categoryOverspent = dashboard.budgetAlerts.some(
      (alert) => alert.threshold === 100 || alert.percentage >= 100,
    );

    // Daily spend streak analysis from daily spending points
    const dailyAmounts = dashboard.dailySpending.map((day) => day.amount);
    const avgDaily = dailyAmounts.length
      ? dailyAmounts.reduce((a, b) => a + b, 0) / dailyAmounts.length
      : 0;

    let highSpendDaysInRow = 0;
    let lowSpendStreakDays = 0;
    for (let i = dailyAmounts.length - 1; i >= 0; i--) {
      if (dailyAmounts[i] > avgDaily * 1.3) highSpendDaysInRow++;
      else break;
    }
    for (let i = dailyAmounts.length - 1; i >= 0; i--) {
      if (dailyAmounts[i] < avgDaily * 0.7) lowSpendStreakDays++;
      else break;
    }

    // Food percentage
    const foodSpend =
      dashboard.categoryBreakdown.find((entry) => entry.category === 'Food')?.amount ?? 0;
    const foodSpendPercent = totalSpent > 0 ? (foodSpend / totalSpent) * 100 : 0;

    // Same merchant count this week (last 7 transactions)
    const last7 = recentTransactions.slice(0, 7);
    const merchantCounts = last7.reduce<Record<string, number>>((acc, t) => {
      if (t.merchant) acc[t.merchant] = (acc[t.merchant] ?? 0) + 1;
      return acc;
    }, {});
    const sameMerchantCount = Math.max(0, ...Object.values(merchantCounts));

    // Impulse = latest transaction is Miscellaneous
    const impulseLogged = recentTransactions[0]?.category === 'Miscellaneous';

    // First transaction of month
    const isFirstTransaction = recentTransactions.length === 1;

    return {
      savingsRate,
      budgetUsedPercent,
      savingsGoalHit,
      lowSpendStreakDays,
      categoryOverspent,
      highSpendDaysInRow,
      daysUntilPayday,
      savingsMilestoneHit,
      isFirstTransaction,
      monthSpend: totalSpent,
      foodSpendPercent,
      sameMerchantCount,
      impulseLogged,
    };
  }, [dashboard, recentTransactions, daysUntilPayday]);
}
