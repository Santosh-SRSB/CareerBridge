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
      <label className="mb-1.5 block text-xs font-bold text-primary" htmlFor="mobile">
        Mobile number
      </label>
      <div className="flex gap-2">
        <select
          aria-label="Country code"
          value={dial}
          onChange={(event) => onDialChange(event.target.value)}
          className="w-24 rounded-xl border border-primary/15 bg-[#f8faf9] px-2.5 py-2.5 text-xs font-semibold text-primary outline-none transition focus:border-teal focus:bg-white"
        >
          {COUNTRIES.map((item) => (
            <option key={item.code} value={item.dial}>
              {item.flag} {item.dial}
            </option>
          ))}
        </select>
        <input
          id="mobile"
          suppressHydrationWarning
          inputMode="numeric"
          autoComplete="tel"
          placeholder="Enter mobile number"
          maxLength={country.maxLength}
          value={national}
          onChange={(event) => onNationalChange(event.target.value.replace(/\D/g, ''))}
          className={`flex-1 rounded-xl border bg-[#f8faf9] px-3.5 py-2.5 text-sm font-medium text-primary outline-none transition focus:border-teal focus:bg-white ${
            error ? 'border-error' : 'border-primary/15'
          }`}
        />
      </div>
      {error ? (
        <p className="mt-1 text-xs font-semibold text-error">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
