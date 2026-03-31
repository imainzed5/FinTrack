'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Wallet } from 'lucide-react';

interface AuthCardShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  formHeader?: ReactNode;
}

export default function AuthCardShell({
  title,
  subtitle,
  children,
  footer,
  formHeader,
}: AuthCardShellProps) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#fbfaf5_0%,#eef9f5_42%,#ffffff_100%)] dark:bg-[linear-gradient(180deg,#0b1110_0%,#0f1716_42%,#09090b_100%)] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-[28rem] w-full bg-[radial-gradient(55%_42%_at_50%_0%,rgba(20,184,166,0.15),transparent_75%),radial-gradient(36%_32%_at_86%_8%,rgba(251,191,36,0.1),transparent_78%)] dark:bg-[radial-gradient(55%_42%_at_50%_0%,rgba(20,184,166,0.12),transparent_75%),radial-gradient(36%_32%_at_86%_8%,rgba(245,158,11,0.08),transparent_78%)]"
      />

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-[440px]">
        <div className="flex justify-center mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 rounded-full border border-teal-200/50 bg-white/50 px-3 py-1.5 text-sm font-semibold text-teal-950 shadow-sm backdrop-blur-md transition-colors hover:bg-white/80 dark:border-teal-500/30 dark:bg-zinc-900/50 dark:text-teal-100 dark:hover:bg-zinc-900"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-white shadow-[0_2px_10px_-2px_rgba(13,148,136,0.5)]">
              <Wallet size={14} aria-hidden />
            </span>
            Moneda
          </Link>
        </div>

        <div className="text-center mb-8 px-4">
          <h1 className="font-display text-2xl sm:text-[1.75rem] font-semibold leading-tight tracking-tight text-slate-900 dark:text-zinc-50">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2.5 text-[15px] leading-relaxed text-slate-600 dark:text-zinc-300">
              {subtitle}
            </p>
          )}
        </div>

        <div className="bg-white/95 dark:bg-zinc-950/90 py-8 px-6 shadow-[0_32px_80px_-40px_rgba(15,23,42,0.15)] backdrop-blur-xl sm:rounded-[2rem] sm:px-10 border border-white/80 dark:border-white/10 text-left w-full">
          {formHeader ? <div className="mb-6">{formHeader}</div> : null}
          {children}
        </div>
        
        {footer ? (
          <div className="mt-8 text-center text-[13px] leading-relaxed text-slate-500 dark:text-zinc-400 px-4 max-w-sm mx-auto">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
