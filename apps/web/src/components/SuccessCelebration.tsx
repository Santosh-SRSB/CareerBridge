'use client';

import { OB } from '@/components/OnboardingFrame';

type SuccessCelebrationProps = {
  phase: 'loading' | 'success';
  loadingTitle?: string;
  loadingSubtitle?: string;
  successTitle: string;
  successSubtitle?: string;
};

export function SuccessCelebration({
  phase,
  loadingTitle = 'Saving…',
  loadingSubtitle,
  successTitle,
  successSubtitle,
}: SuccessCelebrationProps) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-4"
      style={{ background: 'rgba(36, 28, 21, 0.45)' }}
      role="status"
      aria-live="polite"
    >
      <div
        className="cb-success-card w-full max-w-sm rounded-2xl bg-white px-6 py-8 text-center"
        style={{
          boxShadow: '0 12px 32px rgba(63,91,58,0.16)',
          fontFamily: 'var(--font-inter), Inter, sans-serif',
        }}
      >
        {phase === 'loading' ? (
          <>
            <div className="cb-success-spinner mx-auto" aria-hidden />
            <p
              className="mt-5 text-lg font-semibold"
              style={{
                color: OB.ink,
                fontFamily: "var(--font-fraunces), Georgia, 'Times New Roman', serif",
              }}
            >
              {loadingTitle}
            </p>
            {loadingSubtitle ? (
              <p className="mt-2 text-sm" style={{ color: OB.muted }}>
                {loadingSubtitle}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <div className="cb-success-tick mx-auto" aria-hidden>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 12.5l5 5L19 7"
                  stroke="#fff"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p
              className="mt-5 text-lg font-semibold"
              style={{
                color: OB.ink,
                fontFamily: "var(--font-fraunces), Georgia, 'Times New Roman', serif",
              }}
            >
              {successTitle}
            </p>
            {successSubtitle ? (
              <p className="mt-2 text-sm" style={{ color: OB.muted }}>
                {successSubtitle}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
