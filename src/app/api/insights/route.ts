import { NextResponse } from 'next/server';
import { getTransactions, processRecurringTransactions } from '@/lib/db';
import { generateInsights, detectSubscriptions, generateSubscriptionInsights } from '@/lib/insights-engine';
import { getBudgets } from '@/lib/db';

export async function GET() {
  await processRecurringTransactions();
  const transactions = await getTransactions();
  const budgets = await getBudgets();
  const subscriptions = detectSubscriptions(transactions);

  const insights = [
    ...generateInsights(transactions, budgets),
    ...generateSubscriptionInsights(subscriptions),
  ];

  return NextResponse.json(insights);
}
