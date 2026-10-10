'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';
import type { OnboardingIconName } from '@/lib/onboarding-category-icon';
import './onboarding-shell.css';

export const ONBOARDING_TOTAL_STEPS = 4;

export const ONBOARDING_STEP_LABELS = ['Location', 'Work status', 'Job preferences', 'Skills'] as const;

/** Onboarding card palette — matches Profile Builder reference */
export const OB = {
  ink: '#10137c',
  clay: '#1A1FC4',
  moss: '#10137C',
  accent: '#10137C',
  accentDark: '#10137c',
  accentTint: '#E3E4F2',
  accentTintStrong: '#A9ADD6',
  gold: '#D9A441',
  bg: '#f8f9fc',
  surface: '#ffffff',
  surfaceTint: '#f5f7ff',
  muted: '#4b4f8f',
  textMuted: '#7b7fa8',
  border: '#e5e7f2',
  borderStrong: '#d1d5e5',
  line: '#d1d5e5',
  lineSoft: '#e5e7f2',
  green50: '#E3E4F2',
  green100: '#A9ADD6',
  green200: '#6F76B8',
  green400: '#1F276E',
  green800: '#10137C',
  amber50: '#FAEEDA',
  amber100: '#FAC775',
  amber800: '#633806',
  teal50: '#E1E3F5',
  teal100: '#9FA6E1',
  teal800: '#10137c',
  purple50: '#EEEDFE',
  purple100: '#CECBF6',
  purple800: '#3C3489',
} as const;

export const BACK_HREF: Record<number, string | undefined> = {
  1: undefined,
  2: '/onboarding',
  3: '/onboarding/status',
  4: '/onboarding/preferences',
};

export const onboardingPrimaryButtonClass =
  'inline-flex h-11 w-full items-center justify-center rounded-[10px] border-0 px-5 text-sm font-semibold text-white transition hover:-translate-y-px disabled:opacity-40 disabled:hover:translate-y-0';

export const onboardingOptionButtonClass = (active: boolean) =>
  `rounded-full border px-3.5 py-2 text-xs font-medium transition sm:text-sm ${
    active
      ? 'border-[#10137C] bg-[#10137C] text-white'
      : 'border-[#d1d5e5] bg-white text-[#4b4f8f] hover:border-[#10137C]'
  }`;

export const onboardingSkipButtonClass =
  'inline-flex items-center gap-1 text-xs font-medium text-[#10137C] hover:opacity-80 transition sm:text-sm';

export const onboardingInputClass =
  'h-10 w-full rounded-[10px] border border-[#d1d5e5] bg-[#f5f7ff] px-3 text-sm text-[#10137c] outline-none transition focus:border-[#10137C] focus:shadow-[0_0_0_3px_#E3E4F2]';

export const onboardingLabelClass =
  'mb-1.5 block text-[13px] font-medium text-[#4b4f8f]';

/** Primary / secondary button classes for the onboarding shell footer and status screens. */
export const obxPrimaryButtonClass = 'obx-btn obx-btn--primary';
export const obxGhostButtonClass = 'obx-btn obx-btn--ghost';

function OnboardingSteps({ step }: { step: number }) {
  const current = Math.min(Math.max(step, 1), ONBOARDING_TOTAL_STEPS);
  const percent = Math.round((current / ONBOARDING_TOTAL_STEPS) * 100);
  return (
    <>
      <ol className="obx-steps" aria-label="Onboarding progress">
        {ONBOARDING_STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const state = n < current ? 'is-done' : n === current ? 'is-cur' : '';
          return (
            <li key={label} className={state} aria-current={n === current ? 'step' : undefined}>
              <span className="n">{n < current ? '✓' : n}</span>
              <span className="l">{label}</span>
            </li>
          );
        })}
      </ol>
      <div
        className="obx-mprog"
        role="progressbar"
        aria-label="Onboarding progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`Step ${current} of ${ONBOARDING_TOTAL_STEPS}, ${percent}% complete`}
        data-testid="onboarding-progress"
      >
        {ONBOARDING_STEP_LABELS.map((label, i) => (
          <span key={label} className={i < current ? 'on' : ''} />
        ))}
      </div>
      <p className="obx-stp">
        Step {current} of {ONBOARDING_TOTAL_STEPS} · {ONBOARDING_STEP_LABELS[current - 1]}
      </p>
    </>
  );
}

export function OnboardingFrame({
  step,
  children,
  showProgress = true,
  onSkip,
  skipLabel = 'Skip for now',
  skipDisabled = false,
}: {
  step: number;
  children: ReactNode;
  /** Hide the step indicator (e.g. profile setup and resume choice screens). */
  showProgress?: boolean;
  onSkip?: () => void;
  skipLabel?: string;
  skipDisabled?: boolean;
}) {
  return (
    <main className="obx-page">
      <div className="obx-shell">
        <header className="obx-top">
          <BrandLogo tone="dark" size="sm" />
          {onSkip ? (
            <button type="button" className="obx-skip" onClick={onSkip} disabled={skipDisabled}>
              {skipLabel}
            </button>
          ) : null}
        </header>
        {showProgress ? <OnboardingSteps step={step} /> : null}
        {children}
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

const ONBOARDING_ICONS: Record<OnboardingIconName, ReactNode> = {
  pin: (
    <>
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" />
    </>
  ),
  sparkle: (
    <>
      <path d="m12 2 1.4 5.6L19 9l-5.6 1.4L12 16l-1.4-5.6L5 9l5.6-1.4L12 2Z" />
      <path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  code: <path d="m8 9-3 3 3 3M16 9l3 3-3 3M14 5l-4 14" />,
  data: <path d="M5 20V10M10 20V4M15 20v-7M20 20V7" />,
  headset: (
    <>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <path d="M18 19c0 1.7-1.3 3-3 3h-3" />
      <rect x="3" y="13" width="4" height="6" rx="2" />
      <rect x="17" y="13" width="4" height="6" rx="2" />
    </>
  ),
  design: (
    <>
      <path d="M12 22a10 10 0 1 0 0-20 8 8 0 0 0-8 8c0 4 3 4 5 4h1a2 2 0 0 1 2 2v1a3 3 0 0 0 3 3" />
      <circle cx="7.5" cy="9" r=".5" />
      <circle cx="10" cy="5.5" r=".5" />
      <circle cx="15" cy="6.5" r=".5" />
    </>
  ),
  engineering: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
  test: (
    <>
      <path d="M9 3h6M10 3v5l-5 9a2.5 2.5 0 0 0 2.2 4h9.6a2.5 2.5 0 0 0 2.2-4l-5-9V3" />
      <path d="M8 14h8" />
    </>
  ),
  marketing: (
    <>
      <path d="m3 11 15-6v14L3 13v-2Z" />
      <path d="m7 14 1.5 5h4" />
    </>
  ),
  people: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m14 7 5 5-5 5" />
    </>
  ),
};

export function OnboardingIcon({ name, size = 22 }: { name: OnboardingIconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ONBOARDING_ICONS[name]}
    </svg>
  );
}

export function OnboardingStepHeader({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: OnboardingIconName;
}) {
  return (
    <div className="obx-hd">
      {icon ? (
        <span className="obx-hi">
          <OnboardingIcon name={icon} />
        </span>
      ) : null}
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </div>
  );
}

export function OnboardingQuestion({
  title,
  children,
  hint,
  htmlFor,
}: {
  title: string;
  children: ReactNode;
  hint?: string;
  htmlFor?: string;
}) {
  return (
    <div>
      <label className="obx-label" htmlFor={htmlFor}>
        {title}
        {hint ? <em>{hint}</em> : null}
      </label>
      {children}
    </div>
  );
}

/** Inline form error; when `onRetry` is set (save failures) a Retry button repeats the action. */
export function OnboardingError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  if (!message) return null;
  return (
    <div role="alert" className="obx-error">
      <span>{message}</span>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="obx-link">
          Retry
        </button>
      ) : null}
    </div>
  );
}

/** Sticky footer: Back link (when the step has one) and the primary action. */
export function OnboardingActions({
  children,
  step,
  backHref,
}: {
  children: ReactNode;
  step?: number;
  backHref?: string;
}) {
  const resolvedBack = backHref ?? (step != null ? BACK_HREF[step] : undefined);

  return (
    <div className="obx-foot">
      {resolvedBack ? (
        <Link href={resolvedBack} className={obxGhostButtonClass}>
          Back
        </Link>
      ) : null}
      {children}
    </div>
  );
}

/** Shell placeholder while the onboarding gate and profile load. */
export function OnboardingLoading({ step, showProgress = true }: { step: number; showProgress?: boolean }) {
  return (
    <OnboardingFrame step={step} showProgress={showProgress}>
      <div className="obx-body" role="status" aria-live="polite">
        <span className="sr-only">Loading...</span>
        <div className="obx-skel" style={{ height: 56, marginBottom: 24 }} />
        <div className="obx-skel" style={{ height: 46, marginBottom: 14 }} />
        <div className="obx-skel" style={{ height: 46 }} />
      </div>
    </OnboardingFrame>
  );
}

export function OnboardingFieldIcon({ children }: { children: ReactNode }) {
  return (
    <span className="flex shrink-0 items-center" aria-hidden>
      {children}
    </span>
  );
}
