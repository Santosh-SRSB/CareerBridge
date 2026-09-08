'use client';

import { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'ghost' | 'link' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  loading?: boolean;
  loadingLabel?: string;
};

export function Button({
  variant = 'primary',
  size = 'lg',
  block = true,
  loading,
  loadingLabel = 'Please wait...',
  className = '',
  children,
  disabled,
  ...props
}: Props) {
  const styles = {
    primary:
      size === 'lg'
        ? 'cb-btn-shine relative overflow-hidden bg-primary text-white shadow-[0_12px_28px_rgba(10,46,44,0.28)] transition duration-300 hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(10,46,44,0.36)] active:translate-y-0'
        : 'bg-primary text-white hover:bg-primary-hover',
    secondary: 'border border-primary text-primary bg-surface hover:bg-primary-soft',
    outline: 'border border-slate-200 text-slate-800 bg-white hover:bg-slate-50',
    tertiary: 'bg-accent text-primary hover:bg-accent/90',
    destructive: 'bg-error text-white hover:bg-error/90',
    ghost: 'text-primary hover:bg-primary-soft',
    link: 'text-accent underline-offset-2 hover:underline',
  }[variant];
  const sizes = {
    sm: 'h-8 px-3 text-xs font-bold rounded-full',
    md: 'h-9 min-w-0 px-3.5 text-sm font-semibold rounded-full',
    lg: 'px-4 py-3.5 text-base font-bold rounded-md',
  }[size];

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex cursor-pointer items-center justify-center transition disabled:cursor-not-allowed disabled:opacity-60 ${
        block ? 'w-full' : 'w-auto'
      } ${sizes} ${styles} ${className}`}
    >
      {loading ? loadingLabel : children}
    </button>
  );
}
