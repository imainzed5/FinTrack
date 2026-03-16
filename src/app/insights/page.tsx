import { redirect } from 'next/navigation';
import InsightsClientPage from '@/components/pages/InsightsClientPage';
import { getBudgets, getTransactions } from '@/lib/db';
import { scheduleRecurringProcessing } from '@/lib/recurring-scheduler';
import { isAuthRequiredError } from '@/lib/supabase/server';
import type { Budget, Transaction } from '@/lib/types';

export default async function InsightsPage() {
  let initialTransactions: Transaction[] = [];
  let initialBudgets: Budget[] = [];

  try {
    void scheduleRecurringProcessing();

    const [transactions, budgets] = await Promise.all([
      getTransactions(),
      getBudgets(),
    ]);

    initialTransactions = transactions;
    initialBudgets = budgets;
  } catch (error) {
    if (isAuthRequiredError(error)) {
      redirect('/auth/login?next=%2Finsights');
    }
  }

  return (
    <InsightsClientPage
      initialTransactions={initialTransactions}
      initialBudgets={initialBudgets}
    />
  );
}
