'use client';

import { TextareaHTMLAttributes, useId } from 'react';

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function Textarea({ label, hint, error, className = '', id, required, ...props }: Props) {
  const generatedId = useId();
  const inputId = id || props.name || generatedId;
  const noteId = `${inputId}-note`;
  const note = error || hint;
  return (
    <label className="block" htmlFor={inputId}>
      <span className="mb-1.5 block text-sm font-semibold text-primary">
        {label}
        {required ? (
          <span className="ml-0.5 text-error" aria-hidden="true">
            *
          </span>
        ) : null}
      </span>
      <textarea
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        {...props}
        suppressHydrationWarning
        className={`min-h-28 w-full rounded-md border bg-[#faf8f3] px-3.5 py-3 text-base outline-none ${
          error ? 'border-error' : 'border-primary/10'
        } ${className}`}
      />
      {error ? (
        <span id={noteId} className="mt-1 block text-sm text-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span id={noteId} className="mt-1 block text-sm text-muted">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
