import { redirect } from 'next/navigation';
import TimelineClientPage from '@/components/pages/TimelineClientPage';
import { getBudgets, getTransactions } from '@/lib/db';
import { detectSubscriptions, generateTimelineEvents } from '@/lib/insights-engine';
import { scheduleRecurringProcessing } from '@/lib/recurring-scheduler';
import { isAuthRequiredError } from '@/lib/supabase/server';
import type { TimelineEvent } from '@/lib/types';

export default async function TimelinePage() {
  let initialEvents: TimelineEvent[] = [];

  try {
    void scheduleRecurringProcessing();

    const [transactions, budgets] = await Promise.all([
      getTransactions(),
      getBudgets(),
    ]);
    const subscriptions = detectSubscriptions(transactions);
    initialEvents = generateTimelineEvents(transactions, subscriptions, budgets);
  } catch (error) {
    if (isAuthRequiredError(error)) {
      redirect('/auth/login?next=%2Ftimeline');
    }
  }

  return <TimelineClientPage initialEvents={initialEvents} />;
}
