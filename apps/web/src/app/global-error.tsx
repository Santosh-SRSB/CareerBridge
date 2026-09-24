'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const errorId = error.digest || 'CB-ERR';
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 24, background: '#f7f4ef', color: '#0a2e2c' }}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Something went wrong</h1>
        <p style={{ marginBottom: 16, color: '#6b8178' }}>
          Please try again. If the problem continues, contact support with Error ID:{' '}
          <strong>{errorId}</strong>.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            background: '#0a2e2c',
            color: '#fff',
            border: 0,
            borderRadius: 999,
            padding: '10px 18px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Try Again
        </button>
      </body>
    </html>
  );
}
