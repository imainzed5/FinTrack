import type { Metadata } from 'next';
import Link from 'next/link';
import { Fraunces, Manrope } from 'next/font/google';
import SaldaObserver from '@/components/SaldaObserver';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BarChart3,
  Receipt,
  ShieldCheck,
  Target,
  Wallet,
} from 'lucide-react';

const displayFont = Fraunces({
  subsets: ['latin'],
  weight: ['600', '700'],
});

const bodyFont = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

type Feature = {
  title: string;
  description: string;
  icon: LucideIcon;
};

type JourneyStep = {
  title: string;
  description: string;
};

type Testimonial = {
  quote: string;
  name: string;
  role: string;
};

const features: Feature[] = [
  {
    title: 'Budgeting without shame',
    description:
      'Build category budgets that fit real life, then adjust when things change instead of feeling behind.',
    icon: Target,
  },
  {
    title: 'Transaction tracking that stays simple',
    description:
      'Log spending quickly, spot patterns instantly, and stop guessing where your paycheck disappeared to.',
    icon: Receipt,
  },
  {
    title: 'Savings insights you can act on',
    description:
      'See trends, not noise. Know what is improving month over month and what needs attention now.',
    icon: BarChart3,
  },
  {
    title: 'Privacy-first from day one',
    description:
      'Your financial data is protected in transit and at rest, with clear terms and policy transparency.',
    icon: ShieldCheck,
  },
];

const journey: JourneyStep[] = [
  {
    title: 'Set up this device',
    description: 'Create your device profile, wallet, and first budget in a calm guided flow.',
  },
  {
    title: 'Track right away',
    description:
      'Add transactions, savings goals, and debts locally, then organize them into categories that make sense to you.',
  },
  {
    title: 'Add backup when ready',
    description:
      'Sign in later if you want cloud backup and multi-device sync without giving up local access.',
  },
];

const testimonials: Testimonial[] = [
  {
    quote:
      'I was not overspending wildly. I was just blind. Moneda gave me a clean picture in one week.',
    name: 'Mina R.',
    role: 'Freelance Designer',
  },
  {
    quote:
      'My first salary used to disappear by month-end. Now I know exactly what goes to food, transport, and fun.',
    name: 'Andre K.',
    role: 'Fresh Graduate',
  },
  {
    quote:
      'We started using Moneda as a family and finally hit our emergency fund target consistently.',
    name: 'Leah and Marco',
    role: 'Parents of Two',
  },
];

export const metadata: Metadata = {
  title: 'Moneda | You Earn Enough. Now See Where It Goes.',
  description:
    'Moneda helps everyday people understand spending, set realistic budgets, and feel in control of their money.',
  alternates: {
    canonical: '/',
  },
};

export default function LandingPage() {
  return (
    <div
      className={`${bodyFont.className} relative min-h-screen overflow-x-clip bg-stone-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(70%_50%_at_50%_0%,rgba(251,191,36,0.2),transparent_70%)] dark:bg-[radial-gradient(70%_50%_at_50%_0%,rgba(20,184,166,0.2),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-44 h-80 w-80 rounded-full bg-teal-500/10 blur-3xl dark:bg-teal-500/20"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-[26rem] h-80 w-80 rounded-full bg-amber-300/20 blur-3xl dark:bg-amber-400/10"
      />

      <header className="relative">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-teal-200/70 bg-white/70 px-3 py-1.5 text-sm font-semibold text-teal-800 backdrop-blur-sm transition-colors hover:bg-white dark:border-teal-500/30 dark:bg-zinc-900/70 dark:text-teal-300"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-white">
              <Wallet size={16} aria-hidden />
            </span>
            Moneda
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/auth/login"
              className="rounded-full border border-slate-300/80 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Log In
            </Link>
            <Link
              href="/auth/signup"
              className="rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-500"
            >
              Sign Up
            </Link>
          </div>
        </nav>

        <section
          data-salda="hero-section"
          className="mx-auto grid w-full max-w-6xl gap-10 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:pb-24 lg:pt-10"
        >
          <div className="animate-fade-in">
            <p className="mb-4 inline-flex rounded-full border border-amber-200 bg-amber-100/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              Clarity, not guilt
            </p>
            <h1
              className={`${displayFont.className} text-balance text-4xl font-semibold leading-tight text-slate-900 dark:text-zinc-100 sm:text-5xl lg:text-6xl`}
            >
              You earn enough. You just can&apos;t see where it goes.
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-slate-600 dark:text-zinc-300 sm:text-lg">
              Moneda was built for the moment you check your bank balance and wonder what happened. It helps regular people understand spending, set realistic budgets, and finally feel in control of money.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2 rounded-full bg-teal-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-teal-500"
              >
                Use on this device
                <ArrowRight size={16} aria-hidden />
              </Link>
              <Link
                href="/auth/login"
                className="rounded-full border border-slate-300 bg-white/85 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/85 dark:text-zinc-200"
              >
                Back up or sign in
              </Link>
            </div>

            <p className="mt-4 text-sm text-slate-500 dark:text-zinc-400">
              Start locally first. Add an account later if you want backup and multi-device sync.
            </p>
          </div>

          <figure className="animate-fade-in rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-[0_30px_60px_-35px_rgba(15,23,42,0.45)] backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80 lg:p-5">
            <figcaption className="mb-4 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              <span>Moneda Preview</span>
              <span>Placeholder</span>
            </figcaption>

            <div className="space-y-3">
              <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4 dark:border-teal-500/20 dark:bg-teal-500/10">
                <p className="text-xs font-medium text-teal-700 dark:text-teal-200">Monthly snapshot</p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-xl bg-white p-2 dark:bg-zinc-900/70">
                    <p className="text-slate-500 dark:text-zinc-400">Budget</p>
                    <p className="font-semibold text-slate-900 dark:text-zinc-100">PHP 3,200</p>
                  </div>
                  <div className="rounded-xl bg-white p-2 dark:bg-zinc-900/70">
                    <p className="text-slate-500 dark:text-zinc-400">Spent</p>
                    <p className="font-semibold text-slate-900 dark:text-zinc-100">PHP 2,460</p>
                  </div>
                  <div className="rounded-xl bg-white p-2 dark:bg-zinc-900/70">
                    <p className="text-slate-500 dark:text-zinc-400">Saved</p>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-300">PHP 740</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/60">
                <p className="text-xs font-medium text-slate-700 dark:text-zinc-200">Recent transactions</p>
                <div className="mt-2 space-y-2 text-xs">
                  <div className="flex items-center justify-between rounded-lg bg-white px-2 py-1.5 dark:bg-zinc-900">
                    <span className="text-slate-600 dark:text-zinc-300">Groceries</span>
                    <span className="font-semibold text-rose-600 dark:text-rose-300">-PHP 84</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-white px-2 py-1.5 dark:bg-zinc-900">
                    <span className="text-slate-600 dark:text-zinc-300">Transport</span>
                    <span className="font-semibold text-rose-600 dark:text-rose-300">-PHP 26</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-white px-2 py-1.5 dark:bg-zinc-900">
                    <span className="text-slate-600 dark:text-zinc-300">Freelance invoice</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-300">+PHP 980</span>
                  </div>
                </div>
              </div>
            </div>
          </figure>
        </section>
      </header>

      <main className="relative pb-20">
        <section id="why" data-salda="why" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-6 rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70 lg:grid-cols-[1fr_0.9fr] lg:p-8">
            <div>
              <h2 className={`${displayFont.className} text-3xl text-slate-900 dark:text-zinc-100`}>
                Why Moneda exists
              </h2>
              <p className="mt-3 text-slate-600 dark:text-zinc-300">
                Moneda began as a student project—built by someone who wanted to monitor their own expenses and finally see where their money was going. As a student, the developer faced the same confusion and stress as most people: money coming in, but never knowing exactly where it went. The app was designed to be simple, honest, and narrative-driven, so anyone could gain clarity without feeling overwhelmed.
              </p>
              <p className="mt-3 text-slate-600 dark:text-zinc-300">
                Moneda is for freelancers with irregular income, fresh grads managing a first salary, and families saving for something meaningful. You do not need to be a finance expert. You just need a clear picture—and a story that makes sense for your life.
              </p>
              <div className="mt-6">
                <Link
                  href="/onboarding"
                  className="inline-flex items-center gap-2 rounded-full border border-teal-300 bg-teal-50 px-5 py-2.5 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-100 dark:border-teal-500/40 dark:bg-teal-500/10 dark:text-teal-200 dark:hover:bg-teal-500/20"
                >
                  Use Moneda on this device
                  <ArrowRight size={16} aria-hidden />
                </Link>
              </div>
            </div>

            <div className="grid gap-3">
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/80">
                <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Freelancer</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
                  Handle variable income without losing control of essentials.
                </p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/80">
                <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Fresh grad</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
                  Build confident money habits from your very first paycheck.
                </p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/80">
                <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Family</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
                  Align spending with goals that matter to everyone in the household.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section
          id="features"
          data-salda="features"
          className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8"
        >
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className={`${displayFont.className} text-3xl text-slate-900 dark:text-zinc-100`}>
              Features built for everyday life
            </h2>
            <Link
              href="/auth/signup"
              className="hidden text-sm font-semibold text-teal-700 underline decoration-teal-300 underline-offset-4 hover:text-teal-600 dark:text-teal-300 sm:inline"
            >
              Create free account
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-teal-300 dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-teal-500/50"
                >
                  <div className="mb-3 inline-flex rounded-xl bg-teal-100 p-2 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
                    <Icon size={18} aria-hidden />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
                    {feature.description}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-500/30 dark:bg-amber-500/10">
            <p className="text-sm text-amber-900 dark:text-amber-100">
              Moneda does not punish you for spending. It gives you context so you can make better choices next month.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {journey.map((step) => (
                <div
                  key={step.title}
                  className="rounded-2xl border border-amber-200/80 bg-white/80 px-4 py-3 dark:bg-zinc-900/70"
                >
                  <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{step.title}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">{step.description}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-400"
              >
                Use Moneda now
                <ArrowRight size={16} aria-hidden />
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white/85 px-4 py-2 text-sm font-semibold text-amber-900 transition-colors hover:bg-white"
              >
                Add backup and sync later
              </Link>
            </div>
          </div>
        </section>

        <section id="how" data-salda="how" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <h2 className={`${displayFont.className} text-3xl text-slate-900 dark:text-zinc-100`}>
            How it works
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {journey.map((step, index) => (
              <article
                key={step.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/80"
              >
                <p className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                  {index + 1}
                </p>
                <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-zinc-100">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-zinc-300">{step.description}</p>
              </article>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/onboarding"
              className="rounded-full bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-500"
            >
              Set up this device
            </Link>
            <Link
              href="/auth/login"
              className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Back up or sign in
            </Link>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <h2 className={`${displayFont.className} text-3xl text-slate-900 dark:text-zinc-100`}>
            What users say
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {testimonials.map((testimonial) => (
              <blockquote
                key={testimonial.name}
                className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/80"
              >
                <p className="text-sm leading-relaxed text-slate-700 dark:text-zinc-200">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
                <footer className="mt-4 text-xs text-slate-500 dark:text-zinc-400">
                  <p className="font-semibold text-slate-800 dark:text-zinc-100">{testimonial.name}</p>
                  <p>{testimonial.role}</p>
                </footer>
              </blockquote>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white/80 py-8 dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-slate-600 dark:text-zinc-300">
              Your data privacy matters. Moneda is designed with clear controls and transparent policies.
            </p>
            <Link
              href="/auth/signup"
              className="rounded-full bg-teal-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-500"
            >
              Create account
            </Link>
            <Link
              href="/onboarding"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Use on this device
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-zinc-300">
            <Link href="/auth/login" className="hover:text-teal-700 dark:hover:text-teal-300">
              Log In
            </Link>
            <Link href="/auth/signup" className="hover:text-teal-700 dark:hover:text-teal-300">
              Sign Up
            </Link>
            <Link
              href="/auth/terms?returnTo=%2F"
              className="hover:text-teal-700 dark:hover:text-teal-300"
            >
              Terms of Service
            </Link>
            <Link
              href="/auth/privacy?returnTo=%2F"
              className="hover:text-teal-700 dark:hover:text-teal-300"
            >
              Privacy Policy
            </Link>
          </div>

          <p className="text-xs text-slate-500 dark:text-zinc-400">
            (c) 2026 Moneda. Built to help everyday people feel financially clear and in control.
          </p>
        </div>
      </footer>

      <div className="sr-only" aria-live="polite">
        Moneda landing page loaded
      </div>
      <SaldaObserver />
    </div>
  );
}
