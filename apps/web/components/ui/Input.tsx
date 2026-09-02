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
      <span className="mb-1.5 block text-sm font-semibold text-primary">{label}</span>
      <input
        id={inputId}
        {...props}
        className={`w-full rounded-md border bg-[#faf8f3] px-3.5 py-3.5 text-base outline-none transition duration-300 ${
          error
            ? 'border-error'
            : 'border-primary/10 hover:border-primary/25 focus:border-accent focus:bg-white focus:shadow-[0_10px_28px_rgba(232,185,35,0.22)] focus:-translate-y-0.5'
        } ${className}`}
      />
      {error ? (
        <span className="mt-1 block text-sm text-error">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-sm text-muted">{hint}</span>
      ) : null}
    </label>
  );
}
