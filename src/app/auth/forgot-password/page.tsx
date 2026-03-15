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
            className="font-semibold text-emerald-700 underline decoration-emerald-300 decoration-2 underline-offset-4 transition-colors hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200"
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
            <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p>
          ) : null}
          {formSuccess ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">{formSuccess}</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full min-h-11 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300 disabled:text-emerald-100 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:disabled:bg-emerald-700"
        >
          {isSubmitting ? 'Sending reset link...' : 'Send reset link'}
        </button>
      </form>
    </AuthCardShell>
  );
}
