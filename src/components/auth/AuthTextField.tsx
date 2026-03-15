'use client';

import type { InputHTMLAttributes } from 'react';

interface AuthTextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}

export default function AuthTextField({
  id,
  label,
  error,
  hint,
  type = 'text',
  ...inputProps
}: AuthTextFieldProps) {
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800 dark:text-zinc-100">
        {label}
      </label>
      <input
        id={id}
        type={type}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        className={`w-full min-h-11 rounded-xl border px-3 py-2.5 text-[15px] text-slate-900 outline-none transition focus:ring-2 dark:bg-zinc-950 dark:text-zinc-100 ${
          error
            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/30 dark:border-rose-500'
            : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/30 dark:border-zinc-700 dark:focus:border-emerald-500'
        }`}
        {...inputProps}
      />
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
