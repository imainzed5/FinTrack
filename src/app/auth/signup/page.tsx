'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import AuthCardShell from '@/components/auth/AuthCardShell';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import AuthTextField from '@/components/auth/AuthTextField';
import AuthPasswordField from '@/components/auth/AuthPasswordField';
import type {
  AuthApiResponse,
  AuthFieldErrors,
  SignupPayload,
} from '@/lib/auth-contract';
import {
  buildAuthPagePath,
  getOAuthErrorMessage,
  normalizeRedirectTarget,
} from '@/lib/auth-redirect';
import {
  evaluatePasswordStrength,
  normalizeEmailAddress,
  PASSWORD_RULES,
  validateSignupPayload,
  type PasswordRuleChecks,
} from '@/lib/auth-contract';
import { CheckCircle2, Circle } from 'lucide-react';

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
  const searchParams = useSearchParams();
  const [formState, setFormState] = useState<SignupPayload>(initialSignupState);
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rateLimitCooldownSeconds, setRateLimitCooldownSeconds] = useState(0);
  const [oauthErrorDismissed, setOauthErrorDismissed] = useState(false);

  const redirectTarget = useMemo(
    () => normalizeRedirectTarget(searchParams.get('next')),
    [searchParams]
  );

  const oauthErrorMessage = useMemo(
    () => (oauthErrorDismissed ? '' : getOAuthErrorMessage(searchParams.get('oauthError'))),
    [oauthErrorDismissed, searchParams]
  );

  const loginHref = useMemo(
    () => buildAuthPagePath('/auth/login', { next: redirectTarget }),
    [redirectTarget]
  );

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

  useEffect(() => {
    setOauthErrorDismissed(false);
  }, [searchParams]);

  const handleTextChange =
    (field: Exclude<SignupField, 'acceptedTerms'>) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setFormState((previous) => ({ ...previous, [field]: value }));
      setFieldErrors((previous) => ({ ...previous, [field]: undefined }));
      setOauthErrorDismissed(true);
      setFormError('');
      setFormSuccess('');
    };

  const handleTermsChange = (event: ChangeEvent<HTMLInputElement>) => {
    setOauthErrorDismissed(true);
    setFormState((previous) => ({
      ...previous,
      acceptedTerms: event.target.checked,
    }));
    setFieldErrors((previous) => ({ ...previous, acceptedTerms: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOauthErrorDismissed(true);
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
      const destination = buildAuthPagePath('/auth/login', { next: redirectTarget });
      window.setTimeout(() => {
        router.push(destination);
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
      subtitle="Connect your devices and backup your history."
      footer={
        <span className="flex flex-col gap-2">
          <span>
            Already have an account?{' '}
            <Link
              href={loginHref}
              className="font-semibold text-teal-700 hover:text-teal-600 dark:text-teal-400 dark:hover:text-teal-300"
            >
              Sign in
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
      <form className="space-y-6" noValidate onSubmit={handleSubmit}>
        <div>
          <GoogleAuthButton
            mode="signup"
            nextPath={redirectTarget}
            disabled={isSubmitting || rateLimitCooldownSeconds > 0}
            onError={(message) => {
              setOauthErrorDismissed(true);
              setFormError(message);
              setFormSuccess('');
            }}
          />
        </div>

        <div className="flex items-center gap-3" aria-hidden>
          <div className="h-px flex-1 bg-slate-200 dark:bg-zinc-800" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
            or use email
          </span>
          <div className="h-px flex-1 bg-slate-200 dark:bg-zinc-800" />
        </div>

        <div className="space-y-4">
          <AuthTextField
            id="fullName"
            label="Full name"
            type="text"
            placeholder="John Doe"
            value={formState.fullName}
            onChange={handleTextChange('fullName')}
            error={fieldErrors.fullName}
            disabled={isSubmitting}
            autoComplete="name"
          />

          <AuthTextField
            id="email"
            label="Email"
            type="email"
            placeholder="john.doe@email.com"
            value={formState.email}
            onChange={handleTextChange('email')}
            error={fieldErrors.email}
            disabled={isSubmitting}
            autoComplete="email"
          />

          <div className="space-y-3">
            <AuthPasswordField
              id="password"
              label="Password"
              value={formState.password}
              onChange={handleTextChange('password')}
              error={fieldErrors.password}
              disabled={isSubmitting}
              autoComplete="new-password"
            />

            {formState.password.length > 0 && (
              <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-3.5 dark:border-zinc-800/60 dark:bg-zinc-900/30">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-zinc-400">
                    Password strength
                  </span>
                  <span className={`text-[11px] font-bold uppercase tracking-[0.15em] ${getStrengthTextTone(passwordStrength.score)}`}>
                    {passwordStrength.label}
                  </span>
                </div>
                <div className="mb-4 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
                  <div
                    className={`h-full transition-all duration-500 ease-out ${getStrengthTone(passwordStrength.score)}`}
                    style={{ width: strengthProgress + '%' }}
                  />
                </div>
                <ul className="grid grid-cols-1 gap-y-2 sm:grid-cols-2 text-[13px]">
                  {PASSWORD_RULES.map((rule) => {
                    const isMet = passwordStrength.checks[rule.id as keyof PasswordRuleChecks];
                    return (
                      <li key={rule.id} className="flex items-start gap-2">
                        {isMet ? (
                          <CheckCircle2 size={16} className="shrink-0 text-emerald-500 dark:text-emerald-400" />
                        ) : (
                          <Circle size={16} className="shrink-0 text-slate-300 dark:text-zinc-700" />
                        )}
                        <span className={isMet ? 'text-slate-700 dark:text-zinc-300' : 'text-slate-500 dark:text-zinc-500'}>
                          {rule.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <AuthPasswordField
            id="confirmPassword"
            label="Confirm password"
            placeholder="Repeat your password"
            value={formState.confirmPassword}
            onChange={handleTextChange('confirmPassword')}
            error={fieldErrors.confirmPassword}
            disabled={isSubmitting}
            autoComplete="new-password"
          />
        </div>

        <div className="flex items-start gap-3">
          <div className="relative flex mt-0.5 items-center justify-center">
            <input
              id="acceptedTerms"
              type="checkbox"
              checked={formState.acceptedTerms}
              onChange={handleTermsChange}
              disabled={isSubmitting}
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
          <div className="text-[13px] leading-relaxed">
            <label htmlFor="acceptedTerms" className="text-slate-600 dark:text-zinc-400 cursor-pointer">
              I agree to the{' '}
            </label>
            <Link
              href="/auth/terms"
              className="text-teal-700 hover:text-teal-600 underline underline-offset-4 dark:text-teal-400 dark:hover:text-teal-300 font-medium"
              target="_blank"
            >
              Terms of Service
            </Link>
            <span className="text-slate-600 dark:text-zinc-400"> and </span>
            <Link
              href="/auth/privacy"
              className="text-teal-700 hover:text-teal-600 underline underline-offset-4 dark:text-teal-400 dark:hover:text-teal-300 font-medium"
              target="_blank"
            >
              Privacy Policy
            </Link>
            .
            {fieldErrors.acceptedTerms && (
              <p className="mt-1 font-medium text-rose-600 dark:text-rose-400">
                {fieldErrors.acceptedTerms}
              </p>
            )}
          </div>
        </div>

        {formError || oauthErrorMessage ? (
           <div className="rounded-xl border border-rose-200/60 bg-rose-50 p-3 text-[13px] font-medium leading-snug text-rose-800 dark:border-rose-900/30 dark:bg-rose-500/10 dark:text-rose-300">
             {formError || oauthErrorMessage}
           </div>
         ) : null}
 
        {formSuccess && (
           <div className="rounded-xl border border-emerald-200/60 bg-emerald-50 p-3 text-[13px] font-medium leading-snug text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-500/10 dark:text-emerald-300">
             {formSuccess}
           </div>
         )}

         <button
           type="submit"
           disabled={!canSubmit}
           className="flex w-full items-center justify-center rounded-[1.125rem] bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:bg-teal-600 dark:hover:bg-teal-500 dark:focus-visible:ring-offset-zinc-950 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
         >
           {isSubmitting ? 'Creating account...' : 'Create account'}
         </button>
      </form>
    </AuthCardShell>
  );
}
