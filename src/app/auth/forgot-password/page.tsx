'use client';

import Link from 'next/link';
import { type ChangeEvent, type FormEvent, useState } from 'react';
import AuthCardShell from '@/components/auth/AuthCardShell';
import AuthTextField from '@/components/auth/AuthTextField';
import type { AuthApiResponse } from '@/lib/auth-contract';
import { isValidEmailAddress, normalizeEmailAddress } from '@/lib/auth-contract';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
    setEmailError('');
    setFormError('');
    setFormSuccess('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailError('');
    setFormError('');
    setFormSuccess('');

    const normalizedEmail = normalizeEmailAddress(email);

    if (!normalizedEmail) {
      setEmailError('Email is required.');
      return;
    }

    if (!isValidEmailAddress(normalizedEmail)) {
      setEmailError('Enter a valid email address.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data = (await response.json()) as AuthApiResponse;

      if (!response.ok || !data.success) {
        if (!data.success && data.fieldErrors?.email) {
          setEmailError(data.fieldErrors.email);
        }

        const fallback = 'Unable to request password reset. Please try again.'; 
        setFormError(data.success ? fallback : data.error);
        return;
      }

      setFormSuccess(data.message);
      setEmail('');
    } catch {
      setFormError('Network error. Please check your connection and retry.');   
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCardShell
      title="Forgot your password?"
      subtitle="Enter your account email and we will send a secure reset link." 
      footer={
        <p>
          Remembered your password?{' '}
          <Link
            href="/auth/login"
            className="font-semibold text-teal-700 hover:text-teal-600 dark:text-teal-400 dark:hover:text-teal-300"
          >
            Back to sign in
          </Link>
        </p>
      }
    >
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <AuthTextField
          id="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={handleEmailChange}
          error={emailError}
          placeholder="name@example.com"
        />

        <div className="min-h-5" aria-live="polite" role="status">
          {formError ? (
            <div className="rounded-xl border border-rose-200/60 bg-rose-50 p-3 text-[13px] font-medium leading-snug text-rose-800 dark:border-rose-900/30 dark:bg-rose-500/10 dark:text-rose-300">
              {formError}
            </div>
          ) : null}
          {formSuccess ? (
            <div className="rounded-xl border border-teal-200/60 bg-teal-50 p-3 text-[13px] font-medium leading-snug text-teal-800 dark:border-teal-900/30 dark:bg-teal-500/10 dark:text-teal-300">
              {formSuccess}
            </div>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center rounded-[1.125rem] bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:bg-teal-600 dark:hover:bg-teal-500 dark:focus-visible:ring-offset-zinc-950 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
        >
          {isSubmitting ? 'Sending reset link...' : 'Send reset link'}
        </button>
      </form>
    </AuthCardShell>
  );
}
