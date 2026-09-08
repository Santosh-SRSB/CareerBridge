'use client';

import { InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function Input({ label, hint, error, className = '', id, ...props }: Props) {
  const inputId = id || props.name;
  return (
    <label className="block" htmlFor={inputId}>
      <span className="mb-1 block text-xs font-bold text-primary">{label}</span>
      <input
        id={inputId}
        suppressHydrationWarning
        {...props}
        className={`w-full rounded-xl border bg-[#f8faf9] px-3.5 py-2.5 text-sm font-medium text-primary outline-none transition duration-200 ${
          error
            ? 'border-error'
            : 'border-primary/15 hover:border-primary/30 focus:border-teal focus:bg-white focus:ring-2 focus:ring-teal/20'
        } ${className}`}
      />
      {error ? (
        <span className="mt-0.5 block text-[11px] font-medium text-error">{error}</span>
      ) : hint ? (
        <span className="mt-0.5 block text-[11px] text-muted">{hint}</span>
      ) : null}
    </label>
  );
}
