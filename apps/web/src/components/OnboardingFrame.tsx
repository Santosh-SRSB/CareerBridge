'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

export const ONBOARDING_TOTAL_STEPS = 4;

/** Onboarding card palette — matches Profile Builder reference */
export const OB = {
  ink: '#1c1c1a',
  clay: '#B4592A',
  moss: '#0B3D33',
  accent: '#0B3D33',
  accentDark: '#062019',
  accentTint: '#E3F2ED',
  accentTintStrong: '#A9D6C7',
  gold: '#D9A441',
  bg: '#f4f4f2',
  surface: '#ffffff',
  surfaceTint: '#f6f6f4',
  muted: '#6b6a63',
  textMuted: '#a3a299',
  border: '#e4e3de',
  borderStrong: '#d4d3cc',
  line: '#d4d3cc',
  lineSoft: '#e4e3de',
  green50: '#E3F2ED',
  green100: '#A9D6C7',
  green200: '#6FB89E',
  green400: '#1F6E58',
  green800: '#0B3D33',
  amber50: '#FAEEDA',
  amber100: '#FAC775',
  amber800: '#633806',
  teal50: '#E1F5EE',
  teal100: '#9FE1CB',
  teal800: '#085041',
  purple50: '#EEEDFE',
  purple100: '#CECBF6',
  purple800: '#3C3489',
} as const;

export const BACK_HREF: Record<number, string | undefined> = {
  1: undefined,
  2: '/onboarding',
  3: '/onboarding/name',
  4: '/onboarding/education',
};

export const onboardingPrimaryButtonClass =
  'inline-flex h-11 w-full items-center justify-center rounded-[10px] border-0 px-5 text-sm font-semibold text-white transition hover:-translate-y-px disabled:opacity-40 disabled:hover:translate-y-0';

export const onboardingOptionButtonClass = (active: boolean) =>
  `rounded-full border px-3.5 py-2 text-xs font-medium transition sm:text-sm ${
    active
      ? 'border-[#0B3D33] bg-[#0B3D33] text-white'
      : 'border-[#d4d3cc] bg-white text-[#6b6a63] hover:border-[#0B3D33]'
  }`;

export const onboardingSkipButtonClass =
  'inline-flex items-center gap-1 text-xs font-medium text-[#0B3D33] hover:opacity-80 transition sm:text-sm';

export const onboardingInputClass =
  'h-10 w-full rounded-[10px] border border-[#d4d3cc] bg-[#f6f6f4] px-3 text-sm text-[#1c1c1a] outline-none transition focus:border-[#0B3D33] focus:shadow-[0_0_0_3px_#E3F2ED]';

export const onboardingLabelClass =
  'mb-1.5 block text-[13px] font-medium text-[#6b6a63]';

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
  /** Hide progress dots (e.g. post-onboarding choice screen). */
  showProgress?: boolean;
  showBack?: boolean;
  /** Render children only — useful for custom complete screens. */
  hideHeader?: boolean;
  backHref?: string;
}) {
  const backHref = backHrefOverride ?? BACK_HREF[step];
  const canGoBack = showBack && Boolean(backHref);

  return (
    <main
      className="box-border flex h-dvh max-h-dvh w-full items-center justify-center overflow-hidden px-4 py-6 sm:px-6 sm:py-8"
      style={{
        background: OB.bg,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        color: OB.ink,
      }}
    >
      <div
        className={`relative flex max-h-[min(94dvh,720px)] w-full max-w-[360px] flex-col overflow-hidden rounded-[20px] border bg-white px-5 py-5 ${
          hideHeader
            ? 'h-[min(90dvh,680px)] sm:h-[620px] sm:py-8'
            : 'h-[min(88dvh,640px)] sm:h-[580px]'
        }`}
        style={{
          borderColor: OB.border,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        {canGoBack ? (
          <div className="mb-2 shrink-0">
            <Link
              href={backHref!}
              className="inline-flex items-center gap-1 text-sm font-semibold transition hover:opacity-80"
              style={{ color: OB.moss }}
            >
              ← Back
            </Link>
          </div>
        ) : null}

        {!hideHeader && (title || subtitle) ? (
          <div className="mb-3 shrink-0">
            {title ? (
              <h1 className="m-0 text-lg font-semibold leading-tight" style={{ color: OB.ink }}>
                {title}
              </h1>
            ) : null}
            {subtitle ? (
              <p className="mt-1 text-sm leading-snug" style={{ color: OB.muted }}>
                {subtitle}
              </p>
            ) : null}
          </div>
        ) : null}

        <div
          className={`flex min-h-0 flex-1 flex-col overflow-hidden [&>*]:flex [&>*]:min-h-0 [&>*]:flex-1 [&>*]:flex-col ${
            hideHeader ? '' : 'cb-ob-panel-in'
          }`}
          data-ob-progress={showProgress ? '1' : '0'}
        >
          {children}
        </div>
      </div>
    </main>
  );
}

type HeroTone = 'green' | 'amber' | 'teal' | 'purple';

const HERO_TONE: Record<
  HeroTone,
  { bg: string; circle: string; stroke: string; deco?: string; decoSoft?: string }
> = {
  green: {
    bg: OB.green50,
    circle: OB.green100,
    stroke: OB.green800,
    deco: OB.green400,
    decoSoft: OB.green200,
  },
  amber: { bg: OB.amber50, circle: OB.amber100, stroke: OB.amber800 },
  teal: { bg: OB.teal50, circle: OB.teal100, stroke: OB.teal800 },
  purple: { bg: OB.purple50, circle: OB.purple100, stroke: OB.purple800 },
};

export function OnboardingHero({
  tone,
  children,
  deco = false,
}: {
  tone: HeroTone;
  children: ReactNode;
  deco?: boolean;
}) {
  const t = HERO_TONE[tone];
  return (
    <div
      className="cb-ob-hero relative mb-[18px] mt-1 flex h-[110px] items-center justify-center overflow-hidden rounded-2xl sm:h-[120px]"
      style={{ background: t.bg }}
    >
      <div
        className="cb-ob-hero-circle flex h-[68px] w-[68px] items-center justify-center rounded-full sm:h-[72px] sm:w-[72px]"
        style={{ background: t.circle }}
      >
        {children}
      </div>
      {deco && t.deco ? (
        <>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill={t.deco}
            className="absolute right-7 top-4"
            aria-hidden
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
          </svg>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill={t.decoSoft}
            className="absolute bottom-3.5 left-6"
            aria-hidden
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
          </svg>
        </>
      ) : null}
    </div>
  );
}

export function OnboardingStepHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-[18px]">
      <h3 className="m-0 text-lg font-semibold leading-tight" style={{ color: OB.ink }}>
        {title}
      </h3>
      {subtitle ? (
        <p className="mt-1 mb-0 text-sm leading-relaxed" style={{ color: OB.muted }}>
          {subtitle}
        </p>
      ) : null}
    </div>
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
    <div className="space-y-1.5">
      <div>
        <label className={onboardingLabelClass}>{title}</label>
        {hint ? (
          <p className="-mt-0.5 mb-1.5 text-xs" style={{ color: OB.textMuted }}>
            {hint}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function OnboardingDots({ step }: { step: number }) {
  return (
    <div className="mb-3.5 mt-4 flex justify-center gap-1.5" aria-hidden>
      {Array.from({ length: ONBOARDING_TOTAL_STEPS }, (_, i) => {
        const index = i + 1;
        const active = index === step;
        const done = index < step;
        return (
          <div
            key={index}
            className="h-1.5 rounded-[3px] transition-all duration-250"
            style={{
              width: active ? 20 : 6,
              background: active ? OB.accent : done ? OB.accentTintStrong : OB.border,
            }}
          />
        );
      })}
    </div>
  );
}

export function OnboardingActions({
  children,
  step,
  backHref,
  onSkip,
  skipLabel = 'Skip for now',
}: {
  children: ReactNode;
  /** When set, renders progress dots above the nav row. */
  step?: number;
  backHref?: string;
  onSkip?: () => void;
  skipLabel?: string;
  /** @deprecated Top back is handled by nav row */
  onBack?: () => void;
}) {
  const resolvedBack = backHref ?? (step != null ? BACK_HREF[step] : undefined);

  return (
    <div className="mt-auto shrink-0 pt-2">
      {step != null ? <OnboardingDots step={step} /> : null}
      <div className="flex gap-2.5">
        {resolvedBack ? (
          <Link
            href={resolvedBack}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-[10px] border bg-white text-sm font-medium transition hover:-translate-y-px"
            style={{ borderColor: OB.borderStrong, color: OB.ink }}
          >
            Back
          </Link>
        ) : null}
        <div className={resolvedBack ? 'flex-[2]' : 'w-full'}>{children}</div>
      </div>
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

export function OnboardingFieldIcon({ children }: { children: ReactNode }) {
  return (
    <span
      className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
      style={{ color: OB.textMuted }}
      aria-hidden
    >
      {children}
    </span>
  );
}
