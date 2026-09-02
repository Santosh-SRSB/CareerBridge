'use client';

import { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'ghost' | 'link';
  loading?: boolean;
  loadingLabel?: string;
};

export function Button({
  variant = 'primary',
  loading,
  loadingLabel = 'Please wait...',
  className = '',
  children,
  disabled,
  ...props
}: Props) {
  const styles = {
    primary:
      'cb-btn-shine relative overflow-hidden bg-primary text-white shadow-[0_12px_28px_rgba(12,51,64,0.28)] transition duration-300 hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(12,51,64,0.36)] active:translate-y-0',
    secondary: 'border border-primary text-primary bg-surface hover:bg-primary-soft',
    tertiary: 'bg-accent text-primary hover:bg-accent/90',
    destructive: 'bg-error text-white hover:bg-error/90',
    ghost: 'text-primary hover:bg-primary-soft',
    link: 'text-accent underline-offset-2 hover:underline',
  }[variant];

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex w-full items-center justify-center rounded-md px-4 py-3.5 text-base font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${className}`}
    >
      {loading ? loadingLabel : children}
    </button>
  );
}
