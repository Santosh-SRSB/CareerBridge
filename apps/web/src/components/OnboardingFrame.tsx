'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

export const ONBOARDING_TOTAL_STEPS = 4;

const BACK_HREF: Record<number, string | undefined> = {
  1: undefined,
  2: '/onboarding',
  3: '/onboarding/name',
  4: '/onboarding/education',
};

export const onboardingPrimaryButtonClass =
  'rounded-full bg-[#0a2e2c] px-6 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#072422] transition disabled:opacity-60';

export const onboardingOptionButtonClass = (active: boolean) =>
  `rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
    active
      ? 'border-[#0a2e2c] bg-[#0a2e2c] text-white shadow-sm'
      : 'border-slate-200 bg-white text-slate-800 hover:border-[#0a2e2c]/30'
  }`;

export const onboardingSkipButtonClass =
  'text-xs font-semibold text-[#3b6cf4] hover:underline py-1';

export function OnboardingFrame({
  step,
  children,
}: {
  step: number;
  children: ReactNode;
}) {
  const backHref = BACK_HREF[step];
  const progress = Math.round((step / ONBOARDING_TOTAL_STEPS) * 100);

  return (
    <main className="min-h-screen bg-[#faf8f4] text-slate-900">
      <div className="mx-auto flex w-full max-w-md flex-col px-5 pb-10 pt-6">
        <div className="flex items-center gap-3">
          {backHref ? (
            <Link
              href={backHref}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-xs"
              aria-label="Go back"
            >
              <svg className="h-3.5 w-3.5 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          ) : (
            <div className="h-8 w-8 shrink-0" aria-hidden />
          )}
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
            Let&apos;s build your profile
          </h1>
        </div>

        <div className="mt-4 space-y-1.5">
          <p className="text-[11px] font-semibold text-slate-500">
            Step {step} of {ONBOARDING_TOTAL_STEPS}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#eadfce]">
            <div
              className="h-full rounded-full bg-[#3b6cf4] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}

export function OnboardingQuestion({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-extrabold leading-snug text-slate-900 sm:text-lg">{title}</h2>
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
}) {
  return (
    <div className="flex flex-col items-center gap-2 pt-4">
      {children}
      {onSkip ? (
        <button type="button" onClick={onSkip} className={onboardingSkipButtonClass}>
          {skipLabel}
        </button>
      ) : null}
    </div>
  );
}
