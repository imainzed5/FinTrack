import { NextResponse } from 'next/server';
import { getTransactions } from '@/lib/db';
import { generateInsights, detectSubscriptions, generateSubscriptionInsights } from '@/lib/insights-engine';
import { getBudgets } from '@/lib/db';
import { scheduleRecurringProcessing } from '@/lib/recurring-scheduler';
import { isAuthRequiredError } from '@/lib/supabase/server';

export async function GET() {
  try {
    void scheduleRecurringProcessing();
    const transactions = await getTransactions();
    const budgets = await getBudgets();
    const subscriptions = detectSubscriptions(transactions);

    const insights = [
      ...generateInsights(transactions, budgets),
      ...generateSubscriptionInsights(subscriptions),
    ];

    return NextResponse.json(insights);
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : 'Failed to load insights.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
