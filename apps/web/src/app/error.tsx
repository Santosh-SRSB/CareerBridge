'use client';

import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '@/lib/api';
import { makeErrorId, reportClientError } from '@/lib/client-errors';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [errorId] = useState(() => makeErrorId());

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(`[error-boundary] ${errorId}`, error);
    reportClientError(getApiBaseUrl(), { errorId, message: error?.message, digest: error?.digest });
  }, [error, errorId]);

  return (
    <div role="alert" className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-bold text-[#0a2e2c]">Something went wrong</h1>
      <p className="max-w-md text-sm font-semibold text-[#4a5f57]">
        We couldn&apos;t load this page. Please try again. If the problem continues, contact support with
        Error ID: <span className="font-mono" data-testid="error-id">{errorId}</span>
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="min-h-12 rounded-full bg-[#0a2e2c] px-6 py-3 text-sm font-bold text-white"
      >
        Try Again
      </button>
    </div>
  );
}
