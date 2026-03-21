import SavingsClientPage from '@/components/pages/SavingsClientPage';
import { getSavingsGoalsSummary } from '@/lib/db';
import type { SavingsGoalsSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';

const EMPTY_SUMMARY: SavingsGoalsSummary = {
  goals: [],
  totalSaved: 0,
  activeGoalCount: 0,
  savingsRate: 0,
};

export default async function SavingsPage() {
  let summary = EMPTY_SUMMARY;

  try {
    summary = await getSavingsGoalsSummary();
  } catch {
    summary = EMPTY_SUMMARY;
  }

  return <SavingsClientPage data={summary} savingsRate={summary.savingsRate} />;
}
