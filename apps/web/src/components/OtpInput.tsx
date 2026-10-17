'use client';

import { useEffect, useRef } from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  labelledBy?: string;
};

export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  invalid = false,
  describedBy,
  labelledBy,
}: Props) {
  const digits = value.padEnd(length, ' ').slice(0, length).split('');
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  // Focus moves synchronously after a change, before the parent re-renders with the new value.
  const current = useRef(value);
  useEffect(() => {
    current.current = value;
  }, [value]);

  function emit(next: string) {
    current.current = next;
    onChange(next);
  }

  function focusBox(index: number) {
    refs.current[Math.max(0, Math.min(length - 1, index))]?.focus();
  }

  function setDigit(index: number, char: string) {
    const next = value.split('');
    next[index] = char;
    emit(next.join('').slice(0, length));
    if (char && index < length - 1) {
      focusBox(index + 1);
    }
  }

  function fillCode(raw: string) {
    const code = raw.replace(/\D/g, '').slice(0, length);
    emit(code);
    focusBox(code.length);
  }

  return (
    <div
      className="cb-otp flex justify-between gap-2"
      role="group"
      aria-label={labelledBy ? undefined : 'One-time password'}
      aria-labelledby={labelledBy}
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          value={digit.trim()}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onFocus={(event) => {
            // Digits fill left to right, so focus never lands past the first empty box.
            if (index > current.current.length) focusBox(current.current.length);
            else event.target.select();
          }}
          onChange={(event) => {
            const typed = event.target.value.replace(/\D/g, '');
            if (typed.length >= length) fillCode(typed);
            else setDigit(index, typed.slice(-1));
          }}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !value[index] && index > 0) {
              event.preventDefault();
              emit(value.slice(0, index - 1));
              focusBox(index - 1);
            } else if (event.key === 'ArrowLeft') {
              event.preventDefault();
              focusBox(index - 1);
            } else if (event.key === 'ArrowRight') {
              event.preventDefault();
              focusBox(index + 1);
            }
          }}
          onPaste={(event) => {
            event.preventDefault();
            fillCode(event.clipboardData.getData('text'));
          }}
          className={`cb-otp__digit h-12 w-11 rounded-xl border bg-[#f8faf9] text-center text-xl font-bold text-primary outline-none transition focus:bg-white focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
            invalid
              ? 'border-red-600 focus:border-red-600 focus:ring-red-200'
              : 'border-primary/20 focus:border-teal focus:ring-teal/20'
          }`}
          aria-label={`Digit ${index + 1} of ${length}`}
        />
      ))}
    </div>
  );
}
