export interface SupabaseRuntimeConfig {
  url: string;
  anonKey: string;
}

function getInvalidSupabaseUrlMessage(): string {
  return 'Invalid NEXT_PUBLIC_SUPABASE_URL. Expected a Supabase project URL such as https://<project-ref>.supabase.co.';
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

  let parsedSupabaseUrl: URL;
  try {
    parsedSupabaseUrl = new URL(url);
  } catch {
    throw new Error(getInvalidSupabaseUrlMessage());
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl && siteUrl.trim().length > 0) {
    try {
      const parsedSiteUrl = new URL(siteUrl);
      if (parsedSiteUrl.host === parsedSupabaseUrl.host) {
        throw new Error(
          'NEXT_PUBLIC_SUPABASE_URL is pointing at NEXT_PUBLIC_SITE_URL. Set it to your Supabase project URL instead.'
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('NEXT_PUBLIC_SUPABASE_URL')) {
        throw error;
      }
    }
  }

  return { url: parsedSupabaseUrl.toString().replace(/\/$/, ''), anonKey: anonKey.trim() };
}

export function getSiteUrl(fallbackOrigin: string): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit && explicit.trim().length > 0) {
    return explicit.replace(/\/$/, '');
  }
  return fallbackOrigin.replace(/\/$/, '');
}
