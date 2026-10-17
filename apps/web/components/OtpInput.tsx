'use client';

import { useRef } from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
};

export function OtpInput({ value, onChange, length = 6 }: Props) {
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
    <div className="flex justify-between gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          inputMode="numeric"
          maxLength={1}
          value={digit.trim()}
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
          className="h-12 w-11 rounded-sm border border-primary/20 bg-surface text-center text-lg font-semibold"
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  );
}
