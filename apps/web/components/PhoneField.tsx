'use client';

import { COUNTRIES } from '@/lib/phone';

type Props = {
  dial: string;
  national: string;
  onDialChange: (dial: string) => void;
  onNationalChange: (value: string) => void;
  error?: string;
  hint?: string;
};

export function PhoneField({
  dial,
  national,
  onDialChange,
  onNationalChange,
  error,
  hint = 'We will send a one-time password to this number.',
}: Props) {
  const country = COUNTRIES.find((item) => item.dial === dial) || COUNTRIES[0];

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium" htmlFor="mobile">
        Mobile number
      </label>
      <div className="flex gap-2">
        <select
          aria-label="Country code"
          value={dial}
          onChange={(event) => onDialChange(event.target.value)}
          className="w-28 rounded-sm border border-primary/20 bg-surface px-2 py-3 text-base"
        >
          {COUNTRIES.map((item) => (
            <option key={item.code} value={item.dial}>
              {item.dial}
            </option>
          ))}
        </select>
        <input
          id="mobile"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="Enter Mobile Number"
          maxLength={country.maxLength}
          value={national}
          onChange={(event) => onNationalChange(event.target.value.replace(/\D/g, ''))}
          className={`flex-1 rounded-sm border bg-surface px-3 py-3 text-base ${
            error ? 'border-error' : 'border-primary/20'
          }`}
        />
      </div>
      {error ? (
        <p className="mt-1 text-sm text-error">{error}</p>
      ) : (
        <p className="mt-1 text-sm text-muted">{hint}</p>
      )}
    </div>
  );
}
