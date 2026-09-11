'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

export const ONBOARDING_TOTAL_STEPS = 4;

/** Profile Builder Growth palette */
export const OB = {
  ink: '#241C15',
  clay: '#B4592A',
  moss: '#0A2E2C',
  gold: '#D9A441',
  bg: '#EEF2E9',
  muted: '#6B6355',
  line: '#9CA392',
  lineSoft: '#E4E7DC',
} as const;

const BACK_HREF: Record<number, string | undefined> = {
  1: undefined,
  2: '/onboarding',
  3: '/onboarding/name',
  4: '/onboarding/education',
};

export const onboardingPrimaryButtonClass =
  'rounded-full px-7 py-2.5 text-sm font-semibold text-white transition disabled:opacity-40';

export const onboardingOptionButtonClass = (active: boolean) =>
  `rounded-full border px-3 py-1.5 text-xs font-medium transition sm:text-sm ${
    active
      ? 'border-[#0A2E2C] bg-[#0A2E2C] text-white'
      : 'border-[#7A8270] bg-white text-[#5C5546] hover:border-[#0A2E2C]'
  }`;

export const onboardingSkipButtonClass =
  'inline-flex items-center gap-1 text-xs font-medium text-[#0A2E2C] hover:opacity-80 transition sm:text-sm';

export const onboardingInputClass =
  'w-full rounded-lg border-2 border-[#7A8270] bg-white px-3.5 py-2.5 text-sm text-[#241C15] transition focus:border-[#0A2E2C] focus:outline-none focus:ring-2 focus:ring-[#0A2E2C]/25 sm:py-3';

export const onboardingLabelClass =
  'mb-2 block text-base font-semibold text-[#241C15] sm:text-[1.05rem]';

function Milestone({ reached }: { reached: boolean }) {
  return (
    <div
      key={reached ? 'reached' : 'pending'}
      className={reached ? 'cb-ob-sprout' : undefined}
      style={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: reached ? OB.gold : OB.lineSoft,
        border: `2px solid ${reached ? OB.moss : OB.line}`,
        transition: 'background 400ms ease, border-color 400ms ease',
      }}
    >
      {reached ? (
        <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
          <path
            d="M2 6 L5 9 L10 3"
            fill="none"
            stroke={OB.moss}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </div>
  );
}

export function OnboardingFrame({
  step,
  children,
  title,
  subtitle,
  showProgress = true,
  showBack = true,
  hideHeader = false,
  backHref: backHrefOverride,
}: {
  step: number;
  children: ReactNode;
  title?: string;
  subtitle?: string;
  /** Hide milestone bar (e.g. post-onboarding choice screen). */
  showProgress?: boolean;
  showBack?: boolean;
  /** Render children only — useful for custom complete screens. */
  hideHeader?: boolean;
  backHref?: string;
}) {
  const backHref = showBack ? (backHrefOverride ?? BACK_HREF[step]) : undefined;
  const percent = (step / ONBOARDING_TOTAL_STEPS) * 100;
  const milestones = [25, 50, 75, 100];

  return (
    <main
      className="box-border flex h-dvh max-h-dvh w-full items-center justify-center overflow-hidden px-3 py-3 sm:px-6 sm:py-4"
      style={{ background: OB.bg, fontFamily: 'var(--font-inter), Inter, sans-serif' }}
    >
      <div
        className={`relative flex max-h-[min(94dvh,720px)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white px-5 py-5 sm:rounded-3xl sm:px-7 sm:py-6 ${
          hideHeader
            ? 'h-[min(90dvh,680px)] sm:h-[620px] sm:py-8'
            : 'h-[min(88dvh,620px)] sm:h-[560px]'
        }`}
        style={{
          boxShadow: '0 1px 2px rgba(36,28,21,0.06), 0 12px 32px rgba(63,91,58,0.08)',
        }}
      >
        {backHref ? (
          <Link
            href={backHref}
            className="absolute right-3 top-3 z-10 inline-flex items-center gap-0.5 rounded-full border bg-white px-2 py-0.5 text-[11px] font-medium shadow-sm transition hover:border-[#0A2E2C] hover:text-[#0A2E2C] sm:right-4 sm:top-4"
            style={{ borderColor: '#7A8270', color: '#5C5546' }}
            aria-label="Go back"
          >
            ← Back
          </Link>
        ) : null}

        {!hideHeader ? (
          <div className={`shrink-0 ${backHref ? 'pt-5 sm:pt-5' : ''}`}>
            <h1
              className="text-[1.4rem] leading-tight sm:text-[1.65rem]"
              style={{
                fontFamily: "var(--font-fraunces), Georgia, 'Times New Roman', serif",
                fontWeight: 600,
                color: OB.ink,
              }}
            >
              {title || "Let's build your profile"}
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm" style={{ color: OB.muted }}>
              {subtitle || 'A few quick questions to get you matched with work.'}
            </p>
          </div>
        ) : null}

        {showProgress ? (
          <>
            <div className="mb-2 mt-4 shrink-0 text-[11px] font-medium sm:mt-5 sm:text-xs" style={{ color: OB.muted }}>
              Step {step} of {ONBOARDING_TOTAL_STEPS}
            </div>

            <div className="relative mb-4 h-7 shrink-0 sm:mb-5">
              <svg
                className="absolute left-0 right-0"
                style={{ top: '50%', transform: 'translateY(-50%)', width: '100%' }}
                height="4"
                viewBox="0 0 100 4"
                preserveAspectRatio="none"
                aria-hidden
              >
                <line
                  x1="0"
                  y1="2"
                  x2="100"
                  y2="2"
                  stroke={OB.line}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <line
                  x1="0"
                  y1="2"
                  x2={percent}
                  y2="2"
                  stroke={OB.moss}
                  strokeWidth="2"
                  strokeLinecap="round"
                  style={{ transition: 'x2 600ms ease' }}
                />
              </svg>
              {milestones.map((m) => (
                <div
                  key={m}
                  className="absolute"
                  style={{ top: '50%', left: `${m}%`, transform: 'translate(-50%, -50%)' }}
                >
                  <Milestone reached={percent >= m} />
                </div>
              ))}
            </div>
          </>
        ) : null}

        <div
          className={`flex min-h-0 flex-1 flex-col overflow-hidden [&>*]:flex [&>*]:min-h-0 [&>*]:flex-1 [&>*]:flex-col ${
            hideHeader ? '' : 'cb-ob-panel-in'
          }`}
        >
          {children}
        </div>
      </div>
    </main>
  );
}

export function OnboardingQuestion({
  title,
  children,
  hint,
}: {
  title: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <div>
        <label className={onboardingLabelClass}>{title}</label>
        {hint ? (
          <p className="-mt-0.5 mb-1.5 text-xs" style={{ color: OB.muted }}>
            {hint}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function OnboardingActions({
  children,
  onSkip,
  skipLabel = 'Skip for now',
}: {
  children: ReactNode;
  onSkip?: () => void;
  skipLabel?: string;
  /** @deprecated Top back is handled by OnboardingFrame */
  onBack?: () => void;
}) {
  return (
    <div className="mt-auto shrink-0 border-t border-[#EEF0E8] pt-3 sm:pt-4">
      <div className="flex justify-center">{children}</div>
      {onSkip ? (
        <div className="mt-1.5 flex justify-end">
          <button type="button" onClick={onSkip} className={onboardingSkipButtonClass}>
            {skipLabel} <span aria-hidden>→</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
