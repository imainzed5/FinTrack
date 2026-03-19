import { useMemo } from 'react';
import type { DashboardData, Transaction } from '@/lib/types';
import type { BerdeInputs } from '@/lib/berde/berde.types';

function getDaysUntilPayday(now: Date): number {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(0, daysInMonth - now.getDate());
}

export function useBerdeInputs(
  data: DashboardData,
  transactions: Transaction[],
  daysUntilPayday?: number,
): BerdeInputs {
  return useMemo(() => {
    const overallStatus =
      data.budgetStatuses.find(
        (status) => status.category === 'Overall' && !status.subCategory,
      ) ?? data.budgetStatuses.find((status) => status.category === 'Overall');

    const totalBudget = overallStatus?.effectiveLimit ?? overallStatus?.limit ?? data.monthlyBudget ?? 0;
    const totalSpent = overallStatus?.spent ?? data.totalSpentThisMonth ?? 0;
    const budgetUsedPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    const savingsRate = data.savingsRate;

    const savingsGoalHit =
      savingsRate >= 20 ||
      data.insights.some(
        (insight) => insight.insightType === 'saving' && /goal|target/i.test(insight.message),
      );

    const savingsMilestoneHit = data.insights.some(
      (insight) => insight.insightType === 'saving' && /milestone|streak|record/i.test(insight.message),
    );

    const categoryOverspent = data.budgetAlerts.some(
      (alert) => alert.threshold === 100 || alert.percentage >= 100,
    );

    const dailyAmounts = data.dailySpending.map((day) => day.amount);
    const avgDaily = dailyAmounts.length
      ? dailyAmounts.reduce((sum, amount) => sum + amount, 0) / dailyAmounts.length
      : 0;

    let highSpendDaysInRow = 0;
    let lowSpendStreakDays = 0;

    for (let index = dailyAmounts.length - 1; index >= 0; index -= 1) {
      if (dailyAmounts[index] > avgDaily * 1.3) {
        highSpendDaysInRow += 1;
      } else {
        break;
      }
    }

    for (let index = dailyAmounts.length - 1; index >= 0; index -= 1) {
      if (dailyAmounts[index] < avgDaily * 0.7) {
        lowSpendStreakDays += 1;
      } else {
        break;
      }
    }

    const foodSpend = data.categoryBreakdown.find((entry) => entry.category === 'Food')?.amount ?? 0;
    const foodSpendPercent = totalSpent > 0 ? (foodSpend / totalSpent) * 100 : 0;

    const last7Transactions = transactions.slice(0, 7);
    const merchantCounts = last7Transactions.reduce<Record<string, number>>((counts, transaction) => {
      if (transaction.merchant) {
        counts[transaction.merchant] = (counts[transaction.merchant] ?? 0) + 1;
      }
      return counts;
    }, {});

    const sameMerchantCount = Math.max(0, ...Object.values(merchantCounts));
    const impulseLogged = transactions[0]?.category === 'Miscellaneous';
    const isFirstTransaction = transactions.length === 1;

    return {
      savingsRate,
      budgetUsedPercent,
      savingsGoalHit,
      lowSpendStreakDays,
      categoryOverspent,
      highSpendDaysInRow,
      daysUntilPayday: daysUntilPayday ?? getDaysUntilPayday(new Date()),
      savingsMilestoneHit,
      isFirstTransaction,
      monthSpend: totalSpent,
      foodSpendPercent,
      sameMerchantCount,
      impulseLogged,
    };
  }, [data, transactions, daysUntilPayday]);
}
