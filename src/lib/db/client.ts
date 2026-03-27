import type { SupabaseClient } from '@supabase/supabase-js';

import { requireSupabaseUser } from '../supabase/server';

export async function getAuthedClient(): Promise<{ supabase: SupabaseClient; userId: string }> {
  const { supabase, user } = await requireSupabaseUser();
  return {
    supabase,
    userId: user.id,
  };
}
