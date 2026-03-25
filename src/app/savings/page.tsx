import SavingsClientPage from '@/components/pages/SavingsClientPage';
import { getSavingsGoalsSummary } from '@/lib/db';
import { createSupabaseServerClient } from '@/lib/supabase/server';
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
  let viewerUserId = '';

  try {
    summary = await getSavingsGoalsSummary();
  } catch {
    summary = EMPTY_SUMMARY;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    viewerUserId = user?.id ?? '';
  } catch {
    viewerUserId = '';
  }

  return <SavingsClientPage data={summary} savingsRate={summary.savingsRate} userId={viewerUserId} />;
}
