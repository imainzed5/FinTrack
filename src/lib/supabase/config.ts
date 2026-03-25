export interface SupabaseRuntimeConfig {
  url: string;
  anonKey: string;
}

// IMPORTANT: NEXT_PUBLIC_ vars must be accessed via static dot notation so that
// Next.js can inline them at build time. Dynamic access (process.env[name]) is
// not statically analyzable and results in `undefined` on the client.
export function getSupabaseRuntimeConfig(): SupabaseRuntimeConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || url.trim().length === 0) {
    throw new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!anonKey || anonKey.trim().length === 0) {
    throw new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return { url, anonKey };
}

export function getSiteUrl(fallbackOrigin: string): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit && explicit.trim().length > 0) {
    return explicit.replace(/\/$/, '');
  }
  return fallbackOrigin.replace(/\/$/, '');
}
