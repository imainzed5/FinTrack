'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import AuthCardShell from '@/components/auth/AuthCardShell';
import AuthTextField from '@/components/auth/AuthTextField';
import AuthPasswordField from '@/components/auth/AuthPasswordField';
import type {
  AuthApiResponse,
  AuthFieldErrors,
  SignupPayload,
} from '@/lib/auth-contract';
import {
  evaluatePasswordStrength,
  normalizeEmailAddress,
  PASSWORD_RULES,
  type PasswordRuleChecks,
  validateSignupPayload,
} from '@/lib/auth-contract';

type SignupField = 'fullName' | 'email' | 'password' | 'confirmPassword' | 'acceptedTerms';
type SignupFieldErrors = Partial<Record<SignupField, string>>;

const initialSignupState: SignupPayload = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  acceptedTerms: false,
};

function pickSignupFieldErrors(errors: AuthFieldErrors): SignupFieldErrors {
  const mappedErrors: SignupFieldErrors = {};
  if (errors.fullName) {
    mappedErrors.fullName = errors.fullName;
  }
  if (errors.email) {
    mappedErrors.email = errors.email;
  }
  if (errors.password) {
    mappedErrors.password = errors.password;
  }
  if (errors.confirmPassword) {
    mappedErrors.confirmPassword = errors.confirmPassword;
  }
  if (errors.acceptedTerms) {
    mappedErrors.acceptedTerms = errors.acceptedTerms;
  }
  return mappedErrors;
}

function getStrengthTone(score: number): string {
  if (score <= 1) return 'bg-rose-500';
  if (score === 2) return 'bg-amber-500';
  if (score === 3) return 'bg-sky-500';
  if (score === 4) return 'bg-teal-500';
  return 'bg-emerald-500';
}

function getStrengthTextTone(score: number): string {
  if (score <= 1) return 'text-rose-600 dark:text-rose-400';
  if (score === 2) return 'text-amber-600 dark:text-amber-300';
  if (score === 3) return 'text-sky-600 dark:text-sky-300';
  if (score === 4) return 'text-teal-600 dark:text-teal-300';
  return 'text-emerald-700 dark:text-emerald-300';
}

export default function SignupPage() {
  const router = useRouter();
  const [formState, setFormState] = useState<SignupPayload>(initialSignupState);
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rateLimitCooldownSeconds, setRateLimitCooldownSeconds] = useState(0);

  const passwordStrength = useMemo(
    () => evaluatePasswordStrength(formState.password),
    [formState.password]
  );

  const strengthProgress = (passwordStrength.score / PASSWORD_RULES.length) * 100;
  const hasValidPassword = passwordStrength.score === PASSWORD_RULES.length;

  const canSubmit =
    !isSubmitting &&
    rateLimitCooldownSeconds === 0 &&
    formState.fullName.trim().length >= 2 &&
    formState.email.trim().length > 0 &&
    formState.password.length > 0 &&
    formState.confirmPassword.length > 0 &&
    formState.confirmPassword === formState.password &&
    formState.acceptedTerms &&
    hasValidPassword;

  useEffect(() => {
    if (rateLimitCooldownSeconds <= 0) return;

    const timer = window.setInterval(() => {
      setRateLimitCooldownSeconds((previous) => (previous <= 1 ? 0 : previous - 1));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [rateLimitCooldownSeconds]);

  const handleTextChange =
    (field: Exclude<SignupField, 'acceptedTerms'>) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setFormState((previous) => ({ ...previous, [field]: value }));
      setFieldErrors((previous) => ({ ...previous, [field]: undefined }));
      setFormError('');
      setFormSuccess('');
    };

  const handleTermsChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFormState((previous) => ({
      ...previous,
      acceptedTerms: event.target.checked,
    }));
    setFieldErrors((previous) => ({ ...previous, acceptedTerms: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setFormSuccess('');

    const payload: SignupPayload = {
      ...formState,
      fullName: formState.fullName.trim(),
      email: normalizeEmailAddress(formState.email),
    };

    const validationErrors = validateSignupPayload(payload);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(pickSignupFieldErrors(validationErrors));
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as AuthApiResponse | null;

      if (!response.ok || !data || !data.success) {
        if (data && !data.success && data.fieldErrors) {
          setFieldErrors(pickSignupFieldErrors(data.fieldErrors));
        }

        if (response.status === 429) {
          const retryAfter = Number(response.headers.get('Retry-After'));
          setRateLimitCooldownSeconds(
            Number.isFinite(retryAfter) && retryAfter > 0 ? Math.floor(retryAfter) : 60
          );
        }

        const fallback = 'Unable to create your account. Please try again.';
        setFormError(data && !data.success ? data.error : fallback);
        return;
      }

      setRateLimitCooldownSeconds(0);
      setFormSuccess(data.message);
      window.setTimeout(() => {
        router.push('/auth/login');
      }, 1100);
    } catch {
      setFormError('Network error. Please check your connection and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCardShell
      title="Create your account"
      subtitle="Build healthy spending habits with clear, private financial insights."
      footer={
        <p>
          Already have an account?{' '}
          <Link
            href="/auth/login"
            className="font-semibold text-emerald-700 underline decoration-emerald-300 decoration-2 underline-offset-4 transition-colors hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <AuthTextField
          id="fullName"
          label="Full name"
          autoFocus
          enterKeyHint="next"
          autoComplete="name"
          value={formState.fullName}
          onChange={handleTextChange('fullName')}
          error={fieldErrors.fullName}
          placeholder="John Doe"
        />

        <AuthTextField
          id="email"
          label="Email"
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
          autoComplete="new-password"
          enterKeyHint="next"
          value={formState.password}
          onChange={handleTextChange('password')}
          error={fieldErrors.password}
          hint="Use a unique password for your account security."
          placeholder="Create a password"
        />

        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-slate-700 dark:text-zinc-300">Password strength</p>
            <p className={`text-xs font-semibold ${getStrengthTextTone(passwordStrength.score)}`}>
              {passwordStrength.label}
            </p>
          </div>

          <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-zinc-800" aria-hidden>
            <div
              className={`h-2 rounded-full transition-all ${getStrengthTone(
                passwordStrength.score
              )}`}
              style={{ width: `${strengthProgress}%` }}
            />
          </div>

          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {PASSWORD_RULES.map((rule) => {
              const passed = passwordStrength.checks[rule.id as keyof PasswordRuleChecks];
              return (
                <li key={rule.id} className="flex items-center gap-1.5 text-xs">
                  {passed ? (
                    <CheckCircle2 size={14} className="text-emerald-500" aria-hidden />
                  ) : (
                    <Circle size={14} className="text-slate-400 dark:text-zinc-500" aria-hidden />
                  )}
                  <span className={passed ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-zinc-400'}>
                    {rule.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <AuthPasswordField
          id="confirmPassword"
          label="Confirm password"
          autoComplete="new-password"
          enterKeyHint="done"
          value={formState.confirmPassword}
          onChange={handleTextChange('confirmPassword')}
          error={fieldErrors.confirmPassword}
          placeholder="Repeat your password"
        />

        <div>
          <label
            htmlFor="accepted-terms"
            className="inline-flex min-h-11 cursor-pointer items-start gap-2 rounded-xl px-1 text-sm text-slate-700 dark:text-zinc-200"
          >
            <input
              id="accepted-terms"
              type="checkbox"
              checked={formState.acceptedTerms}
              onChange={handleTermsChange}
              aria-invalid={Boolean(fieldErrors.acceptedTerms)}
              aria-describedby={
                fieldErrors.acceptedTerms ? 'accepted-terms-error' : undefined
              }
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-600"
            />
            <span>
              I agree to the{' '}
              <Link
                href="/auth/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-emerald-700 underline decoration-emerald-300 decoration-2 underline-offset-4 transition-colors hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                href="/auth/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-emerald-700 underline decoration-emerald-300 decoration-2 underline-offset-4 transition-colors hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200"
              >
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          {fieldErrors.acceptedTerms ? (
            <p
              id="accepted-terms-error"
              role="alert"
              className="mt-1 text-xs text-rose-600 dark:text-rose-400"
            >
              {fieldErrors.acceptedTerms}
            </p>
          ) : null}
        </div>

        <div className="min-h-5" aria-live="polite" role="status">
          {formError ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p>
          ) : null}
          {formSuccess ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">{formSuccess}</p>
          ) : null}
          {rateLimitCooldownSeconds > 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Too many attempts. Please wait {rateLimitCooldownSeconds}s before trying again.
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full min-h-11 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300 disabled:text-emerald-100 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:disabled:bg-emerald-700"
        >
          {isSubmitting
            ? 'Creating account...'
            : rateLimitCooldownSeconds > 0
              ? `Try again in ${rateLimitCooldownSeconds}s`
              : 'Create account'}
        </button>

        <p className="text-center text-xs text-slate-500 dark:text-zinc-400">
          No card required. You can start tracking immediately.
        </p>
      </form>
    </AuthCardShell>
  );
}
