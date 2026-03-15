export interface SupabaseRuntimeConfig {
  url: string;
  anonKey: string;
}

function readEnv(name: keyof NodeJS.ProcessEnv): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseRuntimeConfig(): SupabaseRuntimeConfig {
  return {
    url: readEnv('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  };
}

export function getSiteUrl(fallbackOrigin: string): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit && explicit.trim().length > 0) {
    return explicit.replace(/\/$/, '');
  }
  return fallbackOrigin.replace(/\/$/, '');
}
