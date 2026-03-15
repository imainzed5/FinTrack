'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseRuntimeConfig } from './config';

let cachedClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  const { url, anonKey } = getSupabaseRuntimeConfig();
  cachedClient = createBrowserClient(url, anonKey);
  return cachedClient;
}
