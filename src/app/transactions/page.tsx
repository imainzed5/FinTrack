import { redirect } from 'next/navigation';
import TransactionsClientPage from '@/components/pages/TransactionsClientPage';
import { getTransactions } from '@/lib/db';
import { scheduleRecurringProcessing } from '@/lib/recurring-scheduler';
import { isAuthRequiredError } from '@/lib/supabase/server';
import type { Transaction } from '@/lib/types';

export default async function TransactionsPage() {
  let initialTransactions: Transaction[] = [];

  try {
    void scheduleRecurringProcessing();
    initialTransactions = await getTransactions();
  } catch (error) {
    if (isAuthRequiredError(error)) {
      redirect('/auth/login?next=%2Ftransactions');
    }
  }

  return <TransactionsClientPage initialTransactions={initialTransactions} />;
}
