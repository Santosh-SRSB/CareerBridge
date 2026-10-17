'use client';

import { InputHTMLAttributes, useId } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function Input({ label, hint, error, className = '', id, required, ...props }: Props) {
  const generatedId = useId();
  const inputId = id || props.name || generatedId;
  const noteId = `${inputId}-note`;
  const note = error || hint;
  return (
    <label className="block" htmlFor={inputId}>
      <span className="mb-1 block text-xs font-bold text-primary">
        {label}
        {required ? (
          <span className="ml-0.5 text-error" aria-hidden="true">
            *
          </span>
        ) : null}
      </span>
      <input
        id={inputId}
        suppressHydrationWarning
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        {...props}
        className={`w-full rounded-xl border bg-[#f8faf9] px-3.5 py-2.5 text-sm font-medium text-primary outline-none transition duration-200 ${
          error
            ? 'border-error'
            : 'border-primary/15 hover:border-primary/30 focus:border-teal focus:bg-white focus:ring-2 focus:ring-teal/20'
        } ${className}`}
      />
      {error ? (
        <span id={noteId} className="mt-0.5 block text-[11px] font-medium text-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span id={noteId} className="mt-0.5 block text-[11px] text-muted">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
