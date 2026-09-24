'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const errorId = error.digest || 'CB-ERR';
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-bold text-[#0a2e2c]">Something went wrong</h1>
      <p className="max-w-md text-sm font-semibold text-[#6b8178]">
        Please try again. Error ID: <span className="font-mono">{errorId}</span>
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-full bg-[#0a2e2c] px-5 py-2.5 text-sm font-bold text-white"
      >
        Try Again
      </button>
    </div>
  );
}
