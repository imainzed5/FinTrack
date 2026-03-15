'use client';

import type { InputHTMLAttributes } from 'react';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface AuthPasswordFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}

export default function AuthPasswordField({
  id,
  label,
  error,
  hint,
  ...inputProps
}: AuthPasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800 dark:text-zinc-100">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={isVisible ? 'text' : 'password'}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
          className={`w-full min-h-11 rounded-xl border px-3 py-2.5 pr-12 text-[15px] text-slate-900 outline-none transition focus:ring-2 dark:bg-zinc-950 dark:text-zinc-100 ${
            error
              ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/30 dark:border-rose-500'
              : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/30 dark:border-zinc-700 dark:focus:border-emerald-500'
          }`}
          {...inputProps}
        />

        <button
          type="button"
          onClick={() => setIsVisible((previous) => !previous)}
          className="absolute right-0 top-0 flex h-11 min-w-11 items-center justify-center text-slate-500 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-zinc-400 dark:hover:text-zinc-200 dark:focus-visible:ring-offset-zinc-950"
          aria-label={isVisible ? 'Hide password' : 'Show password'}
        >
          {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-500 dark:text-zinc-400">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
