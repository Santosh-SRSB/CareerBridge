'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { LOAD_ERROR_MESSAGE } from '@/lib/client-errors';

export function ErrorState({
  message = LOAD_ERROR_MESSAGE,
  onRetry,
  className = '',
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      data-state="error"
      className={`flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-6 text-center ${className}`}
    >
      <p className="text-sm font-semibold text-[#7f1d1d]">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-navy px-6 text-sm font-bold text-white hover:bg-navy-deep"
        >
          Try Again
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  actionLabel,
  actionHref,
  onAction,
  className = '',
}: {
  title: string;
  message?: ReactNode;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}) {
  const actionClass =
    'inline-flex min-h-12 items-center justify-center rounded-full bg-navy px-6 text-sm font-bold text-white hover:bg-navy-deep';
  return (
    <div
      data-state="empty"
      className={`flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center ${className}`}
    >
      <p className="text-base font-bold text-ink">{title}</p>
      {message ? <p className="max-w-md text-sm text-muted">{message}</p> : null}
      {actionLabel && actionHref ? (
        <Link href={actionHref} className={`${actionClass} mt-2`}>
          {actionLabel}
        </Link>
      ) : actionLabel && onAction ? (
        <button type="button" onClick={onAction} className={`${actionClass} mt-2`}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`cb-skeleton animate-pulse rounded-xl bg-slate-200/80 ${className}`} />;
}

export function SkeletonList({ rows = 3, label = 'Loading…', className = '' }: { rows?: number; label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" data-state="loading" className={`flex flex-col gap-3 ${className}`}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
          <Skeleton className="mb-3 h-4 w-2/3" />
          <Skeleton className="mb-2 h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}
