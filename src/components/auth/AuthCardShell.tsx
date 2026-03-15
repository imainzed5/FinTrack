'use client';

import Link from 'next/link';
import { Wallet } from 'lucide-react';

interface AuthCardShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function AuthCardShell({
  title,
  subtitle,
  children,
  footer,
}: AuthCardShellProps) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-b from-slate-50 via-cyan-50/30 to-white dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-500/10"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-8 sm:px-6">
        <section className="w-full rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-[0_20px_45px_-24px_rgba(15,23,42,0.4)] backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95 sm:p-8">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-3 rounded-full border border-emerald-100 bg-emerald-50/60 px-3 py-1.5 text-sm text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Wallet size={16} />
            </span>
            FinTrack
          </Link>

          <header className="mb-6 space-y-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
              {title}
            </h1>
            <p className="font-body text-sm leading-relaxed text-slate-600 dark:text-zinc-300">{subtitle}</p>
          </header>

          {children}

          {footer ? (
            <footer className="mt-6 border-t border-slate-200 pt-4 text-sm text-slate-600 dark:border-zinc-800 dark:text-zinc-300">
              {footer}
            </footer>
          ) : null}
        </section>
      </div>
    </div>
  );
}
