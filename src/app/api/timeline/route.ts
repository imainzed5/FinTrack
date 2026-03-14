import { NextResponse } from 'next/server';
import { getTransactions, getBudgets } from '@/lib/db';
import { detectSubscriptions, generateTimelineEvents } from '@/lib/insights-engine';

export async function GET() {
  const [transactions, budgets] = await Promise.all([getTransactions(), getBudgets()]);
  const subscriptions = detectSubscriptions(transactions);
  const events = generateTimelineEvents(transactions, subscriptions, budgets);
  return NextResponse.json(events);
}
