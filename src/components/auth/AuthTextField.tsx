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
      <label htmlFor={id} className="block text-sm font-semibold text-slate-900 dark:text-zinc-100">
        {label}
      </label>
      <input
        id={id}
        type={type}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        className={`w-full min-h-11 rounded-[0.875rem] border px-3.5 py-2.5 text-[15px] text-slate-900 shadow-[0_1px_0_rgba(255,255,255,0.65)_inset] outline-none transition placeholder:text-slate-400 focus:ring-4 dark:bg-zinc-950/90 dark:text-zinc-100 dark:placeholder:text-zinc-500 ${
          error
            ? 'border-rose-300 bg-rose-50/70 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-500/80 dark:bg-rose-950/20'
            : 'border-slate-200 bg-white/90 focus:border-teal-500 focus:ring-teal-500/15 dark:border-zinc-800 dark:bg-zinc-950/75 dark:focus:border-teal-400'
        }`}
        {...inputProps}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
