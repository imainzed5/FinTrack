'use client';

import { type InputHTMLAttributes, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface AuthPasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  id: string;
  label: string;
  error?: string;
}

export default function AuthPasswordField({
  id,
  label,
  error,
  ...inputProps
}: AuthPasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const describedBy = error ? `${id}-error` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-900 dark:text-zinc-100">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`w-full min-h-11 rounded-[0.875rem] border py-2.5 pl-3.5 pr-12 text-[15px] text-slate-900 shadow-[0_1px_0_rgba(255,255,255,0.65)_inset] outline-none transition placeholder:text-slate-400 focus:ring-4 dark:bg-zinc-950/90 dark:text-zinc-100 dark:placeholder:text-zinc-500 ${
            error
              ? 'border-rose-300 bg-rose-50/70 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-500/80 dark:bg-rose-950/20'
              : 'border-slate-200 bg-white/90 focus:border-teal-500 focus:ring-teal-500/15 dark:border-zinc-800 dark:bg-zinc-950/75 dark:focus:border-teal-400'
          }`}
          {...inputProps}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded p-0.5 dark:text-zinc-500 dark:hover:text-zinc-300"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
