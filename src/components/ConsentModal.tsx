'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ConsentCheckResponse } from '@/lib/policy';

interface ConsentModalProps {
  open: boolean;
  policies: ConsentCheckResponse['policies'];
  isSubmitting: boolean;
  errorMessage: string;
  onAccept: () => void;
}

export default function ConsentModal({
  open,
  policies,
  isSubmitting,
  errorMessage,
  onAccept,
}: ConsentModalProps) {
  if (!open) {
    return null;
  }

  return (
    <ConsentModalContent
      policies={policies}
      isSubmitting={isSubmitting}
      errorMessage={errorMessage}
      onAccept={onAccept}
    />
  );
}

function ConsentModalContent({
  policies,
  isSubmitting,
  errorMessage,
  onAccept,
}: Omit<ConsentModalProps, 'open'>) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-modal-title"
      aria-describedby="consent-modal-description"
    >
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
        <header className="space-y-2">
          <h2 id="consent-modal-title" className="text-xl font-bold text-slate-900 dark:text-zinc-50">
            Policy update requires your confirmation
          </h2>
          <p
            id="consent-modal-description"
            className="text-sm leading-relaxed text-slate-600 dark:text-zinc-300"
          >
            FinTrack has updated legal terms. Please review and accept the current versions to
            continue using your account.
          </p>
        </header>

        <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-800/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-slate-900 dark:text-zinc-100">Terms of Service</span>
            <span className="text-slate-600 dark:text-zinc-300">
              Accepted: {policies.terms_of_service.accepted_version ?? 'none'} | Current:{' '}
              {policies.terms_of_service.current_version}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-slate-900 dark:text-zinc-100">Privacy Policy</span>
            <span className="text-slate-600 dark:text-zinc-300">
              Accepted: {policies.privacy_policy.accepted_version ?? 'none'} | Current:{' '}
              {policies.privacy_policy.current_version}
            </span>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-700 dark:text-zinc-200">
          Review the current documents:{' '}
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
        </p>

        <label
          htmlFor="accept-latest-policies"
          className="mt-4 inline-flex min-h-11 cursor-pointer items-start gap-2 rounded-xl px-1 text-sm text-slate-700 dark:text-zinc-200"
        >
          <input
            id="accept-latest-policies"
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-600"
          />
          <span>I have reviewed and accept the latest Terms and Privacy Policy.</span>
        </label>

        {errorMessage ? (
          <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{errorMessage}</p>
        ) : null}

        <button
          type="button"
          onClick={onAccept}
          disabled={!confirmed || isSubmitting}
          className="mt-5 w-full min-h-11 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300 disabled:text-emerald-100 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:disabled:bg-emerald-700"
        >
          {isSubmitting ? 'Updating consent...' : 'Accept and continue'}
        </button>
      </section>
    </div>
  );
}
