'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  Sparkles,
  UserRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import BerdeSprite from '@/components/BerdeSprite';
import { useAppSession } from '@/components/AppSessionProvider';
import { DEFAULT_DEVICE_CURRENCY, SUPPORTED_DEVICE_CURRENCIES } from '@/lib/local-first';
import type { BerdeState } from '@/lib/berde/berde.types';

const ONBOARDING_DRAFT_KEY = 'moneda-onboarding-draft-v1';

type StepIndex = 0 | 1 | 2;

interface OnboardingFormState {
  displayName: string;
  currency: string;
  startingAccountName: string;
  startingBalance: string;
  monthlyBudget: string;
}

interface OnboardingDraft {
  currentStep: number;
  values: OnboardingFormState;
}

interface StoryStep {
  label: string;
  eyebrow: string;
  prompt: string;
  icon: LucideIcon;
  spriteState: BerdeState;
}

const EMPTY_VALUES: OnboardingFormState = {
  displayName: '',
  currency: DEFAULT_DEVICE_CURRENCY,
  startingAccountName: '',
  startingBalance: '',
  monthlyBudget: '',
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  PHP: '₱',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  SGD: 'S$',
};

const STORY_STEPS: readonly StoryStep[] = [
  {
    label: 'Meet Berde',
    eyebrow: 'Step 1 of 3',
    prompt: 'Tell Berde what to call you on this device.',
    icon: UserRound,
    spriteState: 'helper',
  },
  {
    label: 'Build Your Wallet',
    eyebrow: 'Step 2 of 3',
    prompt: 'Choose your currency, then name the wallet Berde should watch first.',
    icon: Wallet,
    spriteState: 'proud',
  },
  {
    label: 'Start Tracking',
    eyebrow: 'Step 3 of 3',
    prompt: 'Add a monthly budget if you want one, then review everything before you begin.',
    icon: BadgeDollarSign,
    spriteState: 'motivational',
  },
];

function normalizeMoneyInput(value: string): string {
  const sanitized = value.replace(/[^0-9.]/g, '');
  const dotIndex = sanitized.indexOf('.');
  if (dotIndex === -1) {
    return sanitized;
  }

  return `${sanitized.slice(0, dotIndex + 1)}${sanitized.slice(dotIndex + 1).replace(/\./g, '')}`;
}

function parseOptionalAmount(value: string): number | undefined {
  if (value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function clampStep(step: number): StepIndex {
  if (step <= 0) {
    return 0;
  }

  if (step >= STORY_STEPS.length - 1) {
    return 2;
  }

  return 1;
}

function isOnboardingDraft(value: unknown): value is OnboardingDraft {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.currentStep !== 'number') {
    return false;
  }

  if (!candidate.values || typeof candidate.values !== 'object') {
    return false;
  }

  const values = candidate.values as Record<string, unknown>;
  return (
    typeof values.displayName === 'string' &&
    typeof values.currency === 'string' &&
    typeof values.startingAccountName === 'string' &&
    typeof values.startingBalance === 'string' &&
    typeof values.monthlyBudget === 'string'
  );
}

function getStepError(step: StepIndex, values: OnboardingFormState): string | null {
  if (step === 0 && values.displayName.trim().length < 2) {
    return 'Give Berde at least 2 characters so the greeting feels right.';
  }

  if (step === 1) {
    if (!values.currency.trim()) {
      return 'Pick the currency this device should use.';
    }

    if (values.startingBalance.trim().length > 0 && parseOptionalAmount(values.startingBalance) === undefined) {
      return 'Starting balance needs a valid number.';
    }
  }

  if (step === 2 && values.monthlyBudget.trim().length > 0 && parseOptionalAmount(values.monthlyBudget) === undefined) {
    return 'Monthly budget needs a valid number.';
  }

  return null;
}

function formatCurrencyPreview(value: string, currency: string): string {
  const amount = parseOptionalAmount(value);
  if (amount === undefined) {
    return 'Not set yet';
  }

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

export default function LocalOnboardingPage() {
  const router = useRouter();
  const { booting, completeOnboarding, deviceProfile, onboardingComplete, syncing } = useAppSession();
  const [values, setValues] = useState<OnboardingFormState>(EMPTY_VALUES);
  const [currentStep, setCurrentStep] = useState<StepIndex>(0);
  const [error, setError] = useState('');
  const [hasHydratedDraft, setHasHydratedDraft] = useState(false);

  useEffect(() => {
    if (!booting && onboardingComplete) {
      try {
        window.localStorage.removeItem(ONBOARDING_DRAFT_KEY);
      } catch {
        // ignore draft cleanup failures
      }
      router.replace('/dashboard');
    }
  }, [booting, onboardingComplete, router]);

  useEffect(() => {
    if (booting || hasHydratedDraft || onboardingComplete) {
      return;
    }

    const nextValues: OnboardingFormState = {
      ...EMPTY_VALUES,
      displayName: deviceProfile?.displayName ?? '',
      currency: deviceProfile?.currency || DEFAULT_DEVICE_CURRENCY,
    };
    let nextStep: StepIndex = 0;

    try {
      const rawDraft = window.localStorage.getItem(ONBOARDING_DRAFT_KEY);
      if (rawDraft) {
        const parsedDraft = JSON.parse(rawDraft) as unknown;
        if (isOnboardingDraft(parsedDraft)) {
          Object.assign(nextValues, parsedDraft.values);
          nextValues.currency = parsedDraft.values.currency || nextValues.currency;
          nextStep = clampStep(parsedDraft.currentStep);
        }
      }
    } catch {
      // ignore invalid draft payloads and fall back to defaults
    }

    const frame = window.requestAnimationFrame(() => {
      setValues(nextValues);
      setCurrentStep(nextStep);
      setHasHydratedDraft(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [
    booting,
    deviceProfile?.currency,
    deviceProfile?.displayName,
    hasHydratedDraft,
    onboardingComplete,
  ]);

  useEffect(() => {
    if (!hasHydratedDraft || onboardingComplete) {
      return;
    }

    try {
      window.localStorage.setItem(
        ONBOARDING_DRAFT_KEY,
        JSON.stringify({
          currentStep,
          values,
        }),
      );
    } catch {
      // ignore draft persistence failures
    }
  }, [currentStep, hasHydratedDraft, onboardingComplete, values]);

  const activeStep = STORY_STEPS[currentStep];
  const showSetupNotes = currentStep === STORY_STEPS.length - 1;
  const progressPercent = ((currentStep + 1) / STORY_STEPS.length) * 100;
  const primaryActionLabel =
    currentStep === 0
      ? 'Build your wallet'
      : currentStep === 1
        ? 'Review the setup'
        : syncing
          ? 'Creating your device...'
          : 'Start with this setup';

  const setField = (field: keyof OnboardingFormState, value: string) => {
    setValues((previous) => ({
      ...previous,
      [field]: value,
    }));
    if (error) {
      setError('');
    }
  };

  const goToStep = (step: number) => {
    const nextStep = clampStep(step);
    if (nextStep > currentStep) {
      return;
    }

    setCurrentStep(nextStep);
    setError('');
  };

  const handleBack = () => {
    setCurrentStep((previous) => clampStep(previous - 1));
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationError = getStepError(currentStep, values);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');

    if (currentStep < STORY_STEPS.length - 1) {
      setCurrentStep(clampStep(currentStep + 1));
      return;
    }

    try {
      await completeOnboarding({
        displayName: values.displayName.trim(),
        currency: values.currency,
        startingAccountName: values.startingAccountName.trim() || undefined,
        startingBalance: parseOptionalAmount(values.startingBalance),
        monthlyBudget: parseOptionalAmount(values.monthlyBudget),
      });

      try {
        window.localStorage.removeItem(ONBOARDING_DRAFT_KEY);
      } catch {
        // ignore draft cleanup failures
      }

      router.replace('/dashboard');
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Unable to set up this device right now.'
      );
    }
  };

  if (onboardingComplete) {
    return null;
  }

  if (booting || !hasHydratedDraft) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.12),transparent_42%),linear-gradient(180deg,#f7f3ea_0%,#f2efe7_100%)] px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-6xl animate-pulse space-y-5">
          <div className="h-32 rounded-[32px] border border-[#dfd8ca] bg-white/75" />
          <div className="grid gap-8 lg:grid-cols-[0.3fr_0.7fr] lg:items-start">
            <div className="h-[420px] rounded-[34px] border border-[#dfd8ca] bg-white/80" />
            <div className="h-[560px] rounded-[34px] border border-[#dfd8ca] bg-white/90" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.12),transparent_42%),linear-gradient(180deg,#f7f3ea_0%,#f2efe7_100%)] px-4 py-8 text-zinc-900 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-[34px] border border-[#dfd8ca] bg-white/78 p-5 shadow-[0_20px_60px_rgba(34,29,20,0.06)] backdrop-blur sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                Device-first onboarding
              </p>
              <h1 className="mt-2 font-display text-3xl font-semibold leading-tight text-zinc-900 sm:text-4xl">
                Set up this device with Berde, one checkpoint at a time.
              </h1>
            </div>
            <div className="rounded-full border border-[#ded5c7] bg-[#fbf8f1] px-4 py-2 text-sm font-medium text-zinc-600">
              {activeStep.eyebrow}
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#e7dece]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-amber-400 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

        </section>

        <div className="grid gap-6 lg:grid-cols-[0.3fr_0.7fr] lg:items-start">
          <aside className="lg:sticky lg:top-8">
            <section className="rounded-[34px] border border-[#dfd8ca] bg-white/82 p-5 shadow-[0_24px_60px_rgba(34,29,20,0.06)] backdrop-blur sm:p-6">
              <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-start">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                    Checkpoints
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    Move step by step, or jump back to revise anything you already finished.
                  </p>
                </div>
                <div className="rounded-full border border-[#ded5c7] bg-[#fbf8f1] px-4 py-2 text-sm font-medium text-zinc-600">
                  {activeStep.eyebrow}
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {STORY_STEPS.map((step, index) => {
                  const StepIcon = step.icon;
                  const isActive = index === currentStep;
                  const isComplete = index < currentStep;
                  const isClickable = index <= currentStep;

                  return (
                    <button
                      key={step.label}
                      type="button"
                      onClick={() => goToStep(index)}
                      disabled={!isClickable}
                      className={`w-full rounded-[24px] border px-4 py-4 text-left transition-all ${
                        isActive
                          ? 'border-emerald-300 bg-emerald-50/80 shadow-[0_12px_30px_rgba(29,158,117,0.12)]'
                          : isComplete
                            ? 'border-[#ddd4c6] bg-white/90 hover:border-emerald-200 hover:bg-emerald-50/40'
                            : 'border-[#e7ded0] bg-white/55 opacity-70'
                      } ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${
                          isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-[#f2ece1] text-zinc-500'
                        }`}>
                          {isComplete ? <CheckCircle2 size={18} /> : <StepIcon size={18} />}
                        </span>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                          {index + 1}
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-zinc-900">{step.label}</p>
                      <p className="mt-1 text-sm leading-6 text-zinc-500">{step.prompt}</p>
                    </button>
                  );
                })}
              </div>
            </section>
          </aside>

          <section className="w-full rounded-[34px] border border-[#dfd8ca] bg-white/92 p-6 shadow-[0_24px_60px_rgba(34,29,20,0.08)] backdrop-blur sm:p-7">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-500">
                    <activeStep.icon size={16} className="text-emerald-600" />
                    {activeStep.label}
                  </div>
                </div>
                <div className="shrink-0 rounded-[22px] border border-[#e7dfd0] bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(248,243,234,0.9))] p-2 shadow-[0_12px_28px_rgba(29,158,117,0.08)]">
                  <BerdeSprite size={56} state={activeStep.spriteState} />
                </div>
              </div>
              <h3 className="mt-4 font-display text-3xl font-semibold leading-tight text-zinc-900">
                {activeStep.prompt}
              </h3>
              <p className="mt-3 text-sm leading-7 text-zinc-600">
                Move through the setup quickly. You can still go back anytime before finishing.
              </p>

              <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              {currentStep === 0 ? (
                <div className="animate-fade-up space-y-4">
                  <div>
                    <label
                      htmlFor="display-name"
                      className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500"
                    >
                      Display name
                    </label>
                    <input
                      id="display-name"
                      value={values.displayName}
                      onChange={(event) => setField('displayName', event.target.value)}
                      placeholder="What should Berde call you?"
                      autoFocus
                      className="mt-2 min-h-12 w-full rounded-2xl border border-[#ddd6c8] bg-[#fbf8f1] px-4 text-sm outline-none transition focus:border-[#1D9E75]"
                    />
                  </div>

                  <div className="rounded-[24px] border border-[#e7ded0] bg-[#fbf8f1] p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                      <UserRound size={16} className="text-emerald-600" />
                      Greeting preview
                    </div>
                    <p className="mt-3 text-sm leading-7 text-zinc-600">
                      {values.displayName.trim().length >= 2
                        ? `Berde will greet you as ${values.displayName.trim()} while this device learns your money rhythm.`
                        : 'Give Berde a name to unlock a more personal start.'}
                    </p>
                  </div>
                </div>
              ) : null}

              {currentStep === 1 ? (
                <div className="animate-fade-up space-y-5">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      Currency
                    </label>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {SUPPORTED_DEVICE_CURRENCIES.map((option) => {
                        const isSelected = values.currency === option;
                        const symbol = getCurrencySymbol(option);

                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setField('currency', option)}
                            className={`rounded-[22px] border px-4 py-4 text-left transition-all ${
                              isSelected
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 shadow-[0_10px_24px_rgba(29,158,117,0.12)]'
                                : 'border-[#e7ded0] bg-[#fbf8f1] text-zinc-700 hover:border-emerald-200 hover:bg-emerald-50/40'
                            }`}
                          >
                            <div className="flex items-center gap-3 text-sm font-semibold">
                              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 font-display text-lg font-semibold shadow-[inset_0_0_0_1px_rgba(223,216,202,0.9)]">
                                {symbol}
                              </span>
                              <span>
                                <span className="block text-sm font-semibold">{option}</span>
                                <span className="block text-xs font-medium uppercase tracking-[0.1em] text-zinc-400">
                                  {symbol} currency
                                </span>
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="starting-wallet"
                        className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500"
                      >
                        Starting wallet name
                      </label>
                      <input
                        id="starting-wallet"
                        value={values.startingAccountName}
                        onChange={(event) => setField('startingAccountName', event.target.value)}
                        placeholder="Optional, defaults to Cash"
                        autoFocus
                        className="mt-2 min-h-12 w-full rounded-2xl border border-[#ddd6c8] bg-[#fbf8f1] px-4 text-sm outline-none transition focus:border-[#1D9E75]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="starting-balance"
                        className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500"
                      >
                        Starting balance
                      </label>
                      <input
                        id="starting-balance"
                        value={values.startingBalance}
                        onChange={(event) => setField('startingBalance', normalizeMoneyInput(event.target.value))}
                        inputMode="decimal"
                        placeholder="Optional"
                        className="mt-2 min-h-12 w-full rounded-2xl border border-[#ddd6c8] bg-[#fbf8f1] px-4 text-sm outline-none transition focus:border-[#1D9E75]"
                      />
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-[#e7ded0] bg-[#fbf8f1] p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                      <Wallet size={16} className="text-emerald-600" />
                      Wallet preview
                    </div>
                    <p className="mt-3 text-sm leading-7 text-zinc-600">
                      {`${values.startingAccountName.trim() || 'Cash'} will open in ${values.currency} ${
                        values.startingBalance.trim().length > 0
                          ? `with ${formatCurrencyPreview(values.startingBalance, values.currency)} ready to track.`
                          : 'with a zero starting point until you add your first amount.'
                      }`}
                    </p>
                  </div>
                </div>
              ) : null}

              {currentStep === 2 ? (
                <div className="animate-fade-up space-y-5">
                  <div className="rounded-[28px] border border-[#e7ded0] bg-[#fbf8f1] p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                      <Sparkles size={16} className="text-amber-500" />
                      Final review and editable summary
                    </div>
                    <p className="mt-2 text-sm leading-7 text-zinc-600">
                      This is the last checkpoint. Everything below can still be edited before Berde opens your dashboard.
                    </p>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div>
                        <label
                          htmlFor="review-name"
                          className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500"
                        >
                          Display name
                        </label>
                        <input
                          id="review-name"
                          value={values.displayName}
                          onChange={(event) => setField('displayName', event.target.value)}
                          className="mt-2 min-h-12 w-full rounded-2xl border border-[#ddd6c8] bg-white px-4 text-sm outline-none transition focus:border-[#1D9E75]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="review-currency"
                          className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500"
                        >
                          Currency
                        </label>
                        <select
                          id="review-currency"
                          value={values.currency}
                          onChange={(event) => setField('currency', event.target.value)}
                          className="mt-2 min-h-12 w-full rounded-2xl border border-[#ddd6c8] bg-white px-4 text-sm outline-none transition focus:border-[#1D9E75]"
                        >
                          {SUPPORTED_DEVICE_CURRENCIES.map((option) => (
                            <option key={option} value={option}>
                              {`${getCurrencySymbol(option)} ${option}`}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="review-wallet"
                          className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500"
                        >
                          Starting wallet name
                        </label>
                        <input
                          id="review-wallet"
                          value={values.startingAccountName}
                          onChange={(event) => setField('startingAccountName', event.target.value)}
                          placeholder="Optional, defaults to Cash"
                          className="mt-2 min-h-12 w-full rounded-2xl border border-[#ddd6c8] bg-white px-4 text-sm outline-none transition focus:border-[#1D9E75]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="review-balance"
                          className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500"
                        >
                          Starting balance
                        </label>
                        <input
                          id="review-balance"
                          value={values.startingBalance}
                          onChange={(event) => setField('startingBalance', normalizeMoneyInput(event.target.value))}
                          inputMode="decimal"
                          placeholder="Optional"
                          className="mt-2 min-h-12 w-full rounded-2xl border border-[#ddd6c8] bg-white px-4 text-sm outline-none transition focus:border-[#1D9E75]"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label
                          htmlFor="review-budget"
                          className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500"
                        >
                          Monthly budget
                        </label>
                        <input
                          id="review-budget"
                          value={values.monthlyBudget}
                          onChange={(event) => setField('monthlyBudget', normalizeMoneyInput(event.target.value))}
                          inputMode="decimal"
                          placeholder="Optional overall budget"
                          className="mt-2 min-h-12 w-full rounded-2xl border border-[#ddd6c8] bg-white px-4 text-sm outline-none transition focus:border-[#1D9E75]"
                        />
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-[22px] border border-[#e7ded0] bg-white px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Name</p>
                        <p className="mt-2 text-sm font-semibold text-zinc-900">
                          {values.displayName.trim() || 'Not set yet'}
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-[#e7ded0] bg-white px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Wallet</p>
                        <p className="mt-2 text-sm font-semibold text-zinc-900">
                          {values.startingAccountName.trim() || 'Cash'}
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-[#e7ded0] bg-white px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Balance</p>
                        <p className="mt-2 text-sm font-semibold text-zinc-900">
                          {formatCurrencyPreview(values.startingBalance, values.currency)}
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-[#e7ded0] bg-white px-4 py-3 sm:col-span-2 xl:col-span-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Budget plan</p>
                        <p className="mt-2 text-sm font-semibold text-zinc-900">
                          {values.monthlyBudget.trim().length > 0
                            ? `${formatCurrencyPreview(values.monthlyBudget, values.currency)} per month`
                            : 'No monthly budget yet. You can add one later in Settings.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {error ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div>
                  {currentStep > 0 ? (
                    <button
                      type="button"
                      onClick={handleBack}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#d9d1c2] bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-[#f5f1e8]"
                    >
                      <ArrowLeft size={16} />
                      Back
                    </button>
                  ) : null}
                </div>

                <button
                  type="submit"
                  disabled={syncing}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#1D9E75] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#187f5d] disabled:opacity-60"
                >
                  {primaryActionLabel}
                  <ArrowRight size={16} />
                </button>
              </div>
              </form>

              {showSetupNotes ? (
                <div className="mt-6 rounded-[24px] border border-[#e7ded0] bg-[#fbf8f1] px-5 py-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                    <Sparkles size={14} className="text-amber-500" />
                    After setup
                  </div>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-zinc-600">
                    <p>Your device starts local-first, so you can use the app without signing in.</p>
                    <p>You can add backup, restore, and multi-device sync later without redoing onboarding.</p>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
                <Link href="/auth/login" className="font-semibold text-emerald-700 underline underline-offset-4">
                  I already have an account
                </Link>
                <span className="text-zinc-300">/</span>
                <Link href="/" className="font-semibold text-zinc-700 underline underline-offset-4">
                  Back to landing page
                </Link>
              </div>
            </div>
        </section>
        </div>
      </div>
    </div>
  );
}