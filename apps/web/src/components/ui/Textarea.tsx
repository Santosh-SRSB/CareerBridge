import { TextareaHTMLAttributes } from 'react';

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function Textarea({ label, hint, error, className = '', id, ...props }: Props) {
  const inputId = id || props.name;
  return (
    <label className="block" htmlFor={inputId}>
      <span className="mb-1.5 block text-sm font-semibold text-primary">{label}</span>
      <textarea
        id={inputId}
        {...props}
        suppressHydrationWarning
        className={`min-h-28 w-full rounded-md border bg-[#faf8f3] px-3.5 py-3 text-base outline-none ${
          error ? 'border-error' : 'border-primary/10'
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
