import { NextResponse } from 'next/server';
import { getTransactions, getBudgets } from '@/lib/db';
import { detectSubscriptions, generateTimelineEvents } from '@/lib/insights-engine';
import { scheduleRecurringProcessing } from '@/lib/recurring-scheduler';
import { isAuthRequiredError } from '@/lib/supabase/server';

export async function GET() {
  try {
    void scheduleRecurringProcessing();
    const [transactions, budgets] = await Promise.all([getTransactions(), getBudgets()]);
    const subscriptions = detectSubscriptions(transactions);
    const events = generateTimelineEvents(transactions, subscriptions, budgets);
    return NextResponse.json(events);
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : 'Failed to load timeline.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
