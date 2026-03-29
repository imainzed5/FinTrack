'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import AuthCardShell from '@/components/auth/AuthCardShell';
import AuthTextField from '@/components/auth/AuthTextField';
import AuthPasswordField from '@/components/auth/AuthPasswordField';
import type {
  AuthApiResponse,
  AuthFieldErrors,
  LoginPayload,
} from '@/lib/auth-contract';
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

function normalizeRedirectTarget(value: string | null): string | null {
  if (!value || !value.startsWith('/')) {
    return null;
  }

  if (value.startsWith('//')) {
    return null;
  }

  return value;
}

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
  const [formState, setFormState] = useState<LoginPayload>(initialLoginState);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);

  const redirectTarget = useMemo(
    () => normalizeRedirectTarget(searchParams.get('next')),
    [searchParams]
  );

  const showResetNotice = searchParams.get('reset') === '1';

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
      setFormError('');
      setFormSuccess('');
      setResendMessage('');
    };

  const handleRememberMeChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFormState((previous) => ({ ...previous, rememberMe: event.target.checked }));
  };

  const handleResendVerification = async () => {
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
      window.setTimeout(() => {
        router.push(destination);
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
      subtitle="Sign in if you want backup, sync, and multi-device access. You can still use Moneda locally without an account."
      footer={
        <p>
          Want local-first access instead?{' '}
          <Link
            href="/onboarding"
            className="font-semibold text-slate-700 underline decoration-slate-300 decoration-2 underline-offset-4 transition-colors hover:text-slate-600 dark:text-zinc-100 dark:hover:text-zinc-200"
          >
            Use this device
          </Link>{' '}
          or{' '}
          <Link
            href="/auth/signup"
            className="font-semibold text-emerald-700 underline decoration-emerald-300 decoration-2 underline-offset-4 transition-colors hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200"
          >
            create an account
          </Link>
        </p>
      }
    >
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <AuthTextField
          id="email"
          label="Email"
          autoFocus
          type="email"
          inputMode="email"
          enterKeyHint="next"
          autoComplete="email"
          value={formState.email}
          onChange={handleTextChange('email')}
          error={fieldErrors.email}
          placeholder="John.doe@email.com"
        />

        <AuthPasswordField
          id="password"
          label="Password"
          autoComplete="current-password"
          enterKeyHint="go"
          value={formState.password}
          onChange={handleTextChange('password')}
          error={fieldErrors.password}
          placeholder="Enter your password"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label
            htmlFor="remember-me"
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-1 text-sm text-slate-700 dark:text-zinc-200"
          >
            <input
              id="remember-me"
              type="checkbox"
              checked={formState.rememberMe}
              onChange={handleRememberMeChange}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-600"
            />
            Remember me
          </label>

          <Link
            href="/auth/forgot-password"
            className="text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-emerald-700 dark:text-zinc-200 dark:decoration-zinc-600 dark:hover:text-emerald-300"
          >
            Forgot password?
          </Link>
        </div>

        <div className="min-h-5" aria-live="polite" role="status">
          {showResetNotice ? (
            <p className="text-sm text-sky-700 dark:text-sky-300">
              Your reset request was received. If the email exists, a reset link was sent.
            </p>
          ) : null}
          {formError ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p>
          ) : null}
          {formSuccess ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">{formSuccess}</p>
          ) : null}
          {resendMessage ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">{resendMessage}</p>
          ) : null}
        </div>

        {showResendVerification ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-600/40 dark:bg-amber-500/10">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Need a fresh verification email for this account?
            </p>
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={isResendingVerification || resendCooldownSeconds > 0}
              className="mt-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-amber-300 disabled:text-amber-100 dark:bg-amber-500 dark:hover:bg-amber-400 dark:disabled:bg-amber-800"
            >
              {isResendingVerification
                ? 'Sending verification email...'
                : resendCooldownSeconds > 0
                  ? `Try again in ${resendCooldownSeconds}s`
                  : 'Resend verification email'}
            </button>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full min-h-11 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300 disabled:text-emerald-100 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:disabled:bg-emerald-700"
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>

        <p className="text-center text-xs text-slate-500 dark:text-zinc-400">
          Your financial data is encrypted in transit and at rest.
        </p>
      </form>
    </AuthCardShell>
  );
}
