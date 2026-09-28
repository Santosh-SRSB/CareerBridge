'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import type { InterviewLoadError } from '@/lib/interview-load-error';

export function InterviewLoadErrorPanel({
  error,
  onRetry,
  backHref = '/interviews',
}: {
  error: InterviewLoadError;
  onRetry?: () => void;
  backHref?: string;
}) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-10 text-center">
      <p className="text-sm font-semibold text-slate-700">{error.message}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {error.kind === 'unauthenticated' ? (
          <Link href="/login">
            <Button type="button" block={false} size="md">
              Log in
            </Button>
          </Link>
        ) : null}
        {(error.kind === 'network' || error.kind === 'unknown') && onRetry ? (
          <Button type="button" block={false} size="md" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
        <Link href={backHref}>
          <Button type="button" variant="outline" block={false} size="md">
            Back to interviews
          </Button>
        </Link>
      </div>
    </div>
  );
}
