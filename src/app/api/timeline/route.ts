import { NextResponse } from 'next/server';
import { getTransactions, getBudgets, processRecurringTransactions } from '@/lib/db';
import { detectSubscriptions, generateTimelineEvents } from '@/lib/insights-engine';

export async function GET() {
  await processRecurringTransactions();
  const [transactions, budgets] = await Promise.all([getTransactions(), getBudgets()]);
  const subscriptions = detectSubscriptions(transactions);
  const events = generateTimelineEvents(transactions, subscriptions, budgets);
  return NextResponse.json(events);
}
