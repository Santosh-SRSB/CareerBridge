'use client';

import { useState } from 'react';
import { COUNTRIES } from '@/lib/phone';

export const MOBILE_DIGITS_ONLY_MESSAGE = 'Mobile number must contain digits only';

type Props = {
  dial: string;
  national: string;
  onDialChange: (dial: string) => void;
  onNationalChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
};

export function PhoneField({
  dial,
  national,
  onDialChange,
  onNationalChange,
  onBlur,
  error,
  hint = 'We will send a one-time password to this number.',
  id = 'mobile',
  required = false,
  disabled = false,
}: Props) {
  const country = COUNTRIES.find((item) => item.dial === dial) || COUNTRIES[0];
  const messageId = `${id}-message`;
  const [rejectedInput, setRejectedInput] = useState(false);
  const shownError = rejectedInput ? MOBILE_DIGITS_ONLY_MESSAGE : error;

  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold text-primary" htmlFor={id}>
        Mobile number
        {required ? (
          <span className="ml-0.5 text-red-700" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      <div className="flex gap-2">
        <select
          aria-label="Country code"
          value={dial}
          disabled={disabled}
          onChange={(event) => onDialChange(event.target.value)}
          className="min-h-[44px] w-24 rounded-xl border border-primary/15 bg-[#f8faf9] px-2.5 py-2.5 text-xs font-semibold text-primary outline-none transition focus:border-teal focus:bg-white disabled:opacity-60"
        >
          {COUNTRIES.map((item) => (
            <option key={item.code} value={item.dial}>
              {item.flag} {item.dial}
            </option>
          ))}
        </select>
        <input
          id={id}
          suppressHydrationWarning
          inputMode="numeric"
          autoComplete="tel"
          placeholder="Enter mobile number"
          maxLength={country.maxLength}
          value={national}
          required={required}
          aria-required={required || undefined}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={shownError || hint ? messageId : undefined}
          disabled={disabled}
          onBlur={onBlur}
          onChange={(event) => {
            const raw = event.target.value;
            setRejectedInput(/\D/.test(raw));
            onNationalChange(raw.replace(/\D/g, ''));
          }}
          className={`min-h-[44px] flex-1 rounded-xl border bg-[#f8faf9] px-3.5 py-2.5 text-sm font-medium text-primary outline-none transition focus:border-teal focus:bg-white disabled:opacity-60 ${
            shownError ? 'border-red-600' : 'border-primary/15'
          }`}
        />
      </div>
      {shownError ? (
        <p id={messageId} role="alert" className="mt-1 text-xs font-semibold text-red-700">
          {shownError}
        </p>
      ) : hint ? (
        <p id={messageId} className="mt-1 text-[11px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
