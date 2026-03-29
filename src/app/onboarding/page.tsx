'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, HardDrive, ShieldCheck, Wallet } from 'lucide-react';
import { useAppSession } from '@/components/AppSessionProvider';
import { DEFAULT_DEVICE_CURRENCY, SUPPORTED_DEVICE_CURRENCIES } from '@/lib/local-first';

function normalizeMoneyInput(value: string): string {
  const sanitized = value.replace(/[^0-9.]/g, '');
  const dotIndex = sanitized.indexOf('.');
  if (dotIndex === -1) {
    return sanitized;
  }

  return `${sanitized.slice(0, dotIndex + 1)}${sanitized.slice(dotIndex + 1).replace(/\./g, '')}`;
}

export default function LocalOnboardingPage() {
  const router = useRouter();
  const { booting, completeOnboarding, deviceProfile, onboardingComplete, syncing } = useAppSession();
  const [displayName, setDisplayName] = useState('');
  const [currency, setCurrency] = useState(DEFAULT_DEVICE_CURRENCY);
  const [displayNameDirty, setDisplayNameDirty] = useState(false);
  const [currencyDirty, setCurrencyDirty] = useState(false);
  const [startingAccountName, setStartingAccountName] = useState('');
  const [startingBalance, setStartingBalance] = useState('');
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!booting && onboardingComplete) {
      router.replace('/dashboard');
    }
  }, [booting, onboardingComplete, router]);

  const submitLabel = useMemo(() => (syncing ? 'Saving device setup...' : 'Enter Moneda'), [syncing]);
  const resolvedDisplayName = displayNameDirty
    ? displayName
    : (deviceProfile?.displayName || displayName);
  const resolvedCurrency = currencyDirty
    ? currency
    : (deviceProfile?.currency || currency || DEFAULT_DEVICE_CURRENCY);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (resolvedDisplayName.trim().length < 2) {
      setError('Display name should be at least 2 characters.');
      return;
    }

    try {
      await completeOnboarding({
        displayName: resolvedDisplayName.trim(),
        currency: resolvedCurrency,
        startingAccountName: startingAccountName.trim() || undefined,
        startingBalance: startingBalance ? Number.parseFloat(startingBalance) : undefined,
        monthlyBudget: monthlyBudget ? Number.parseFloat(monthlyBudget) : undefined,
      });
      router.replace('/dashboard');
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Unable to set up this device right now.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.12),transparent_42%),linear-gradient(180deg,#f7f3ea_0%,#f2efe7_100%)] px-4 py-8 text-zinc-900 sm:px-6">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
        <section className="rounded-[34px] border border-[#dfd8ca] bg-white/88 p-6 shadow-[0_24px_60px_rgba(34,29,20,0.08)] backdrop-blur sm:p-7">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
            Device-first setup
          </div>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-tight text-zinc-900 sm:text-5xl">
            Set up Moneda on this device
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-600 sm:text-base">
            Start locally. Your data stays stored on this device until you decide to add an account for backup and sync.
          </p>

          <div className="mt-8 space-y-4">
            <article className="rounded-[26px] border border-[#e7e0d4] bg-[#fbf8f1] p-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <HardDrive size={18} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Stored only on this device</p>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">
                    Use the full app without signing in, even when you are offline.
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-[26px] border border-[#e7e0d4] bg-[#fbf8f1] p-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                  <ShieldCheck size={18} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Optional account later</p>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">
                    Sign in any time if you want backup, sync, and multi-device access.
                  </p>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="rounded-[34px] border border-[#dfd8ca] bg-white/92 p-6 shadow-[0_24px_60px_rgba(34,29,20,0.08)] backdrop-blur sm:p-7">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-500">
            <Wallet size={16} className="text-emerald-600" />
            Local onboarding
          </div>

          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Display name
              </label>
              <input
                value={resolvedDisplayName}
                onChange={(event) => {
                  setDisplayNameDirty(true);
                  setDisplayName(event.target.value);
                }}
                placeholder="What should Moneda call you?"
                className="mt-2 min-h-12 w-full rounded-2xl border border-[#ddd6c8] bg-[#fbf8f1] px-4 text-sm outline-none transition focus:border-[#1D9E75]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Currency
              </label>
              <select
                value={resolvedCurrency}
                onChange={(event) => {
                  setCurrencyDirty(true);
                  setCurrency(event.target.value);
                }}
                className="mt-2 min-h-12 w-full rounded-2xl border border-[#ddd6c8] bg-[#fbf8f1] px-4 text-sm outline-none transition focus:border-[#1D9E75]"
              >
                {SUPPORTED_DEVICE_CURRENCIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  Starting wallet name
                </label>
                <input
                  value={startingAccountName}
                  onChange={(event) => setStartingAccountName(event.target.value)}
                  placeholder="Optional, defaults to Cash"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-[#ddd6c8] bg-[#fbf8f1] px-4 text-sm outline-none transition focus:border-[#1D9E75]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  Starting balance
                </label>
                <input
                  value={startingBalance}
                  onChange={(event) => setStartingBalance(normalizeMoneyInput(event.target.value))}
                  inputMode="decimal"
                  placeholder="Optional"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-[#ddd6c8] bg-[#fbf8f1] px-4 text-sm outline-none transition focus:border-[#1D9E75]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Monthly budget
              </label>
              <input
                value={monthlyBudget}
                onChange={(event) => setMonthlyBudget(normalizeMoneyInput(event.target.value))}
                inputMode="decimal"
                placeholder="Optional overall budget"
                className="mt-2 min-h-12 w-full rounded-2xl border border-[#ddd6c8] bg-[#fbf8f1] px-4 text-sm outline-none transition focus:border-[#1D9E75]"
              />
            </div>

            {error ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={syncing}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1D9E75] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#187f5d] disabled:opacity-60"
            >
              {submitLabel}
              <ArrowRight size={16} />
            </button>
          </form>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
            <Link href="/auth/login" className="font-semibold text-emerald-700 underline underline-offset-4">
              I already have an account
            </Link>
            <span className="text-zinc-300">/</span>
            <Link href="/" className="font-semibold text-zinc-700 underline underline-offset-4">
              Back to landing page
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}