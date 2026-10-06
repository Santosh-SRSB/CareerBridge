'use client';

import { useRef } from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
};

export function OtpInput({ value, onChange, length = 6, disabled = false, invalid = false, describedBy }: Props) {
  const digits = value.padEnd(length, ' ').slice(0, length).split('');
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  function setDigit(index: number, char: string) {
    const next = value.split('');
    next[index] = char;
    const joined = next.join('').slice(0, length);
    onChange(joined);
    if (char && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="One-time password">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit.trim()}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(event) => setDigit(index, event.target.value.replace(/\D/g, '').slice(-1))}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !value[index] && index > 0) {
              refs.current[index - 1]?.focus();
            }
          }}
          onPaste={(event) => {
            event.preventDefault();
            const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
            onChange(pasted);
          }}
          className={`h-12 w-11 rounded-xl border bg-[#f8faf9] text-center text-xl font-bold text-primary outline-none transition focus:bg-white focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
            invalid
              ? 'border-red-600 focus:border-red-600 focus:ring-red-200'
              : 'border-primary/20 focus:border-teal focus:ring-teal/20'
          }`}
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  );
}
