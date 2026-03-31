'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import AuthCardShell from '@/components/auth/AuthCardShell';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import AuthTextField from '@/components/auth/AuthTextField';
import AuthPasswordField from '@/components/auth/AuthPasswordField';
import { useAppSession } from '@/components/AppSessionProvider';
import type {
  AuthApiResponse,
  AuthFieldErrors,
  LoginPayload,
} from '@/lib/auth-contract';
import {
  buildAuthPagePath,
  getOAuthErrorMessage,
  normalizeRedirectTarget,
} from '@/lib/auth-redirect';
import {
  isValidEmailAddress,
  normalizeEmailAddress,
  validateLoginPayload,
} from '@/lib/auth-contract';

type LoginField = 'email' | 'password';
type LoginFieldErrors = Partial<Record<LoginField, string>>;

const initialLoginState: LoginPayload = {
  email: '',
  password: '',
  rememberMe: false,
};

function pickLoginFieldErrors(errors: AuthFieldErrors): LoginFieldErrors {
  const mappedErrors: LoginFieldErrors = {};
  if (errors.email) {
    mappedErrors.email = errors.email;
  }
  if (errors.password) {
    mappedErrors.password = errors.password;
  }
  return mappedErrors;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshSession } = useAppSession();
  const [formState, setFormState] = useState<LoginPayload>(initialLoginState);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);
  const [oauthErrorDismissed, setOauthErrorDismissed] = useState(false);

  const redirectTarget = useMemo(
    () => normalizeRedirectTarget(searchParams.get('next')),
    [searchParams]
  );

  const oauthErrorMessage = useMemo(
    () => (oauthErrorDismissed ? '' : getOAuthErrorMessage(searchParams.get('oauthError'))),
    [oauthErrorDismissed, searchParams]
  );

  const signupHref = useMemo(
    () => buildAuthPagePath('/auth/signup', { next: redirectTarget }),
    [redirectTarget]
  );

  const showResetNotice = searchParams.get('reset') === '1';

  useEffect(() => {
    setOauthErrorDismissed(false);
  }, [searchParams]);

  useEffect(() => {
    if (resendCooldownSeconds <= 0) return;

    const timer = window.setInterval(() => {
      setResendCooldownSeconds((previous) => (previous <= 1 ? 0 : previous - 1));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [resendCooldownSeconds]);

  const canSubmit =
    !isSubmitting && formState.email.trim().length > 0 && formState.password.length > 0;

  const handleTextChange =
    (field: LoginField) => (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setFormState((previous) => ({ ...previous, [field]: value }));
      setFieldErrors((previous) => ({ ...previous, [field]: undefined }));
      setOauthErrorDismissed(true);
      setFormError('');
      setFormSuccess('');
      setResendMessage('');
    };

  const handleRememberMeChange = (event: ChangeEvent<HTMLInputElement>) => {
    setOauthErrorDismissed(true);
    setFormState((previous) => ({ ...previous, rememberMe: event.target.checked }));
  };

  const handleResendVerification = async () => {
    setOauthErrorDismissed(true);
    setFormError('');
    setFormSuccess('');
    setResendMessage('');

    const normalizedEmail = normalizeEmailAddress(formState.email);
    if (!isValidEmailAddress(normalizedEmail)) {
      setFieldErrors((previous) => ({
        ...previous,
        email: 'Enter the same valid email you used to sign up.',
      }));
      return;
    }

    if (resendCooldownSeconds > 0) {
      return;
    }

    setIsResendingVerification(true);

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data = (await response.json().catch(() => null)) as AuthApiResponse | null;

      if (!response.ok || !data || !data.success) {
        if (data && !data.success && data.fieldErrors) {
          setFieldErrors(pickLoginFieldErrors(data.fieldErrors));
        }

        const fallback = 'Unable to resend verification email right now.';
        setFormError(data && !data.success ? data.error : fallback);

        if (response.status === 429) {
          const retryAfter = Number(response.headers.get('Retry-After'));
          setResendCooldownSeconds(
            Number.isFinite(retryAfter) && retryAfter > 0 ? Math.floor(retryAfter) : 60
          );
        }
        return;
      }

      setResendMessage(data.message);
    } catch {
      setFormError('Network error. Please check your connection and retry.');
    } finally {
      setIsResendingVerification(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOauthErrorDismissed(true);
    setFormError('');
    setFormSuccess('');

    const payload: LoginPayload = {
      ...formState,
      email: normalizeEmailAddress(formState.email),
    };

    const validationErrors = validateLoginPayload(payload);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(pickLoginFieldErrors(validationErrors));
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as AuthApiResponse | null;

      if (!response.ok || !data || !data.success) {
        if (data && !data.success && data.fieldErrors) {
          setFieldErrors(pickLoginFieldErrors(data.fieldErrors));
        }

        setShowResendVerification(response.status === 403);
        const fallback = 'Unable to sign in. Please try again.';
        setFormError(data && !data.success ? data.error : fallback);
        return;
      }

      setShowResendVerification(false);
      setFormSuccess(data.message);
      const destination = redirectTarget || data.redirectTo || '/dashboard';

      try {
        await refreshSession();
      } catch {
        // Keep the server-set session cookie as the source of truth even if the refresh races.
      }

      window.setTimeout(() => {
        router.replace(destination);
      }, 700);
    } catch {
      setFormError('Network error. Please check your connection and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCardShell
      title="Welcome back"
      subtitle="Sign in to your Moneda account to pick up where you left off."
      footer={
        <span className="flex flex-col gap-2">
          <span>
            Don&apos;t have an account?{' '}
            <Link
              href={signupHref}
              className="font-semibold text-teal-700 hover:text-teal-600 dark:text-teal-400 dark:hover:text-teal-300"
            >
              Sign up
            </Link>
          </span>
          <span className="text-xs text-slate-400 dark:text-zinc-500">
            Prefer local-first?{' '}
            <Link
              href="/onboarding"
              className="underline underline-offset-4 hover:text-slate-600 dark:hover:text-zinc-300"
            >
              Use this device unconditionally
            </Link>
          </span>
        </span>
      }
    >
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <div className="space-y-4">
          <AuthTextField
            id="email"
            label="Email"
            autoFocus
            type="email"
            placeholder="john.doe@email.com"
            value={formState.email}
            onChange={handleTextChange('email')}
            error={fieldErrors.email}
            disabled={isSubmitting || isResendingVerification}
            autoComplete="email"
          />

          <AuthPasswordField
            id="password"
            label="Password"
            value={formState.password}
            onChange={handleTextChange('password')}
            error={fieldErrors.password}
            disabled={isSubmitting || isResendingVerification}
            autoComplete="current-password"
          />

          <div className="flex items-center justify-between text-[13px]">
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={formState.rememberMe}
                  onChange={handleRememberMeChange}
                  disabled={isSubmitting || isResendingVerification}
                  className="peer h-4 w-4 shrink-0 appearance-none rounded border border-slate-300 bg-white transition-colors checked:border-transparent checked:bg-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/30 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:checked:bg-teal-500"
                />
                <svg
                  className="pointer-events-none absolute h-2.5 w-2.5 text-white opacity-0 peer-checked:opacity-100"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M3 8L6 11L11 3.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="font-medium text-slate-600 group-hover:text-slate-900 dark:text-zinc-400 dark:group-hover:text-zinc-200">
                Remember me
              </span>
            </label>
            <Link
              href="/auth/forgot-password"
              className="font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-slate-900 dark:text-zinc-400 dark:decoration-zinc-700 dark:hover:text-zinc-200"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {formError || oauthErrorMessage ? (
          <div className="rounded-xl border border-rose-200/60 bg-rose-50 p-3 text-[13px] font-medium leading-snug text-rose-800 dark:border-rose-900/30 dark:bg-rose-500/10 dark:text-rose-300">
            {formError || oauthErrorMessage}
          </div>
        ) : null}

        {formSuccess || showResetNotice ? (
          <div className="rounded-xl border border-emerald-200/60 bg-emerald-50 p-3 text-[13px] font-medium leading-snug text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            {formSuccess || (showResetNotice ? 'Your password has been successfully reset. You can now sign in.' : '')}
          </div>
        ) : null}

        {resendMessage ? (
          <div className="rounded-xl border border-teal-200/60 bg-teal-50 p-3 text-[13px] font-medium leading-snug text-teal-800 dark:border-teal-900/30 dark:bg-teal-500/10 dark:text-teal-300">
            {resendMessage}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="flex w-full items-center justify-center rounded-[1.125rem] bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:bg-teal-600 dark:hover:bg-teal-500 dark:focus-visible:ring-offset-zinc-950 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>

        {showResendVerification && resendCooldownSeconds === 0 && !formSuccess && (
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={isResendingVerification}
            className="flex w-full items-center justify-center rounded-[1.125rem] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {isResendingVerification ? 'Sending...' : 'Resend verification email'}
          </button>
        )}
        
        {showResendVerification && resendCooldownSeconds > 0 && !formSuccess && (
          <div className="text-center text-[13px] text-slate-500 dark:text-zinc-400">
            Please wait {resendCooldownSeconds}s to resend verification.
          </div>
        )}

        <div className="mt-6 flex items-center gap-3" aria-hidden>
          <div className="h-px flex-1 bg-slate-200 dark:bg-zinc-800" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
            or continue with
          </span>
          <div className="h-px flex-1 bg-slate-200 dark:bg-zinc-800" />
        </div>

        <div className="mt-5">
          <GoogleAuthButton
            mode="login"
            nextPath={redirectTarget}
            disabled={isSubmitting || isResendingVerification}
            onError={(message) => {
              setOauthErrorDismissed(true);
              setFormError(message);
              setFormSuccess('');
              setResendMessage('');
            }}
          />
        </div>
      </form>
    </AuthCardShell>
  );
}
