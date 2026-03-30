'use client';

import { useState } from 'react';
import { normalizeRedirectTarget } from '@/lib/auth-redirect';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface GoogleAuthButtonProps {
  mode: 'login' | 'signup';
  nextPath?: string | null;
  disabled?: boolean;
  onError?: (message: string) => void;
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path
        d="M21.805 10.023H12.24v3.955h5.492c-.237 1.273-.953 2.351-2.028 3.074v2.553h3.287c1.925-1.773 3.034-4.39 3.034-7.496 0-.703-.063-1.381-.18-2.086Z"
        fill="#4285F4"
      />
      <path
        d="M12.24 21.96c2.74 0 5.039-.908 6.719-2.455l-3.287-2.553c-.909.609-2.071.969-3.432.969-2.637 0-4.872-1.778-5.671-4.169H3.171v2.633A10.144 10.144 0 0 0 12.24 21.96Z"
        fill="#34A853"
      />
      <path
        d="M6.569 13.752A6.095 6.095 0 0 1 6.252 11.98c0-.615.111-1.212.317-1.772V7.575H3.171a10.146 10.146 0 0 0 0 8.81l3.398-2.633Z"
        fill="#FBBC04"
      />
      <path
        d="M12.24 6.04c1.49 0 2.827.512 3.879 1.518l2.909-2.91C17.274 2.982 14.975 2 12.24 2A10.144 10.144 0 0 0 3.171 7.575l3.398 2.633c.799-2.391 3.034-4.168 5.671-4.168Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function GoogleAuthButton({
  mode,
  nextPath,
  disabled = false,
  onError,
}: GoogleAuthButtonProps) {
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    onError?.('');
    setPending(true);

    try {
      const redirectTo = new URL('/api/auth/callback', window.location.origin);
      redirectTo.searchParams.set('source', mode);

      const normalizedNextPath = normalizeRedirectTarget(nextPath);
      if (normalizedNextPath) {
        redirectTo.searchParams.set('next', normalizedNextPath);
      }

      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo.toString(),
        },
      });

      if (error || !data?.url) {
        setPending(false);
        onError?.('Unable to connect to Google right now. Please try again.');
        return;
      }

      window.location.assign(data.url);
    } catch {
      setPending(false);
      onError?.('Unable to connect to Google right now. Please try again.');
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || pending}
      className="flex min-h-11 w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-900 dark:disabled:border-zinc-800 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-500"
    >
      <GoogleIcon />
      <span>{pending ? 'Connecting to Google...' : 'Continue with Google'}</span>
    </button>
  );
}