'use client';

import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '@/lib/api';
import { makeErrorId, reportClientError } from '@/lib/client-errors';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [errorId] = useState(() => makeErrorId());

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(`[global-error-boundary] ${errorId}`, error);
    reportClientError(getApiBaseUrl(), { errorId, message: error?.message, digest: error?.digest });
  }, [error, errorId]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 24, background: '#f7f4ef', color: '#0a2e2c' }}>
        <div role="alert">
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ marginBottom: 16, color: '#4a5f57' }}>
            Please try again. If the problem continues, contact support with Error ID:{' '}
            <strong data-testid="error-id">{errorId}</strong>.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: '#0a2e2c',
              color: '#fff',
              border: 0,
              borderRadius: 999,
              padding: '12px 20px',
              minHeight: 48,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
