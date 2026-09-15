import type { ReactNode } from 'react';
import Link from 'next/link';

type Tone = 'jobs' | 'applications' | 'interviews' | 'candidates' | 'messages' | 'analytics';

const TONE_META: Record<
  Tone,
  { eyebrow: string; accent: string }
> = {
  jobs: { eyebrow: 'Openings desk', accent: 'Roles you publish and manage' },
  applications: { eyebrow: 'Applicant pipeline', accent: 'ATS score · shortlist · decide' },
  interviews: { eyebrow: 'Interview calendar', accent: 'Confirm · reschedule · complete' },
  candidates: { eyebrow: 'Talent discovery', accent: 'Ranked matches for each job' },
  messages: { eyebrow: 'Inbox', accent: 'Applications, interviews, alerts' },
  analytics: { eyebrow: 'Hiring intelligence', accent: 'Funnel · volume · role performance' },
};

function JobsHeroArt() {
  return (
    <div className="ep-hero__art" aria-hidden>
      <svg viewBox="0 0 200 140" className="ep-hero__art-svg">
        <ellipse cx="100" cy="128" rx="68" ry="8" fill="#eef1f4" />
        {/* clipboard / job card */}
        <g className="ep-hero__float">
          <rect x="28" y="24" width="86" height="92" rx="14" fill="#fff" stroke="#e2e8ef" strokeWidth="2.2" />
          <rect x="44" y="18" width="54" height="14" rx="7" fill="#fff6e8" stroke="#e8a63b" strokeWidth="2" />
          <path d="M46 52h50M46 66h40M46 80h46" stroke="#edf1f5" strokeWidth="4" strokeLinecap="round" />
          <rect x="46" y="92" width="36" height="10" rx="5" fill="#ffe0a0" />
        </g>
        {/* hiring character */}
        <g className="ep-hero__char">
          <circle cx="152" cy="54" r="22" fill="#fff" stroke="#e2e8ef" strokeWidth="2.2" />
          <circle cx="144" cy="50" r="2.2" fill="#3d4f5f" />
          <circle cx="160" cy="50" r="2.2" fill="#3d4f5f" />
          <path d="M146 60c3.5 3.8 12 3.8 15.5 0" stroke="#e8a63b" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <path d="M164 34c6-10 14-6 14 3" stroke="#e8a63b" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <path d="M134 80c8 18 34 18 42 0" stroke="#e2e8ef" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <circle className="ep-hero__spark" cx="172" cy="26" r="4" fill="#e8a63b" />
        </g>
      </svg>
    </div>
  );
}

function InterviewsHeroArt() {
  return (
    <div className="ep-hero__art" aria-hidden>
      <svg viewBox="0 0 200 140" className="ep-hero__art-svg">
        <ellipse cx="100" cy="128" rx="68" ry="8" fill="#eef1f4" />
        <g className="ep-hero__float">
          <rect x="30" y="28" width="90" height="78" rx="14" fill="#fff" stroke="#e2e8ef" strokeWidth="2.2" />
          <rect x="30" y="28" width="90" height="20" rx="14" fill="#f7f9fb" />
          <path d="M48 22v16M102 22v16" stroke="#e8a63b" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="58" cy="72" r="10" fill="#fff6e8" stroke="#e8a63b" strokeWidth="2" />
          <circle cx="86" cy="72" r="10" fill="#fff" stroke="#e2e8ef" strokeWidth="2" />
          <path d="M68 72h8" stroke="#e8a63b" strokeWidth="2" strokeLinecap="round" />
        </g>
        <g className="ep-hero__char">
          <circle cx="156" cy="56" r="20" fill="#fff" stroke="#e2e8ef" strokeWidth="2.2" />
          <circle cx="149" cy="52" r="2" fill="#3d4f5f" />
          <circle cx="163" cy="52" r="2" fill="#3d4f5f" />
          <path d="M150 62c3 3 10 3 13 0" stroke="#e8a63b" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M168 36c5-8 12-5 12 2" stroke="#e8a63b" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <circle className="ep-hero__spark" cx="176" cy="28" r="3.5" fill="#f0c56a" />
        </g>
      </svg>
    </div>
  );
}

function ApplicationsHeroArt() {
  return (
    <div className="ep-hero__art" aria-hidden>
      <svg viewBox="0 0 200 140" className="ep-hero__art-svg">
        <ellipse cx="100" cy="128" rx="68" ry="8" fill="#eef1f4" />
        <g className="ep-hero__float">
          <rect x="26" y="30" width="100" height="78" rx="14" fill="#fff" stroke="#e2e8ef" strokeWidth="2.2" />
          <circle cx="52" cy="58" r="14" fill="#fff6e8" stroke="#e8a63b" strokeWidth="2" />
          <path d="M74 50h40M74 64h32" stroke="#edf1f5" strokeWidth="4" strokeLinecap="round" />
          <rect x="42" y="84" width="68" height="10" rx="5" fill="#ffe0a0" />
        </g>
        <g className="ep-hero__char">
          <circle cx="158" cy="50" r="20" fill="#fff" stroke="#e2e8ef" strokeWidth="2.2" />
          <circle cx="151" cy="46" r="2" fill="#3d4f5f" />
          <circle cx="165" cy="46" r="2" fill="#3d4f5f" />
          <path d="M152 56c3 3 11 3 14 0" stroke="#e8a63b" strokeWidth="2" strokeLinecap="round" fill="none" />
          <circle className="ep-hero__spark" cx="176" cy="28" r="4" fill="#e8a63b" />
        </g>
      </svg>
    </div>
  );
}

function AnalyticsHeroArt() {
  return (
    <div className="ep-hero__art" aria-hidden>
      <svg viewBox="0 0 200 140" className="ep-hero__art-svg">
        <defs>
          <linearGradient id="epAnGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#ffe8b8" />
            <stop offset="100%" stopColor="#e8a63b" />
          </linearGradient>
        </defs>
        <ellipse cx="100" cy="128" rx="70" ry="8" fill="#eef1f4" />
        <rect x="18" y="22" width="110" height="90" rx="14" fill="#fff" stroke="#e2e8ef" strokeWidth="2" />
        <path d="M34 96h78" stroke="#edf1f5" strokeWidth="3" strokeLinecap="round" />
        <rect className="ep-hero__bar" x="38" y="58" width="16" height="38" rx="4" fill="#ffe0a0" />
        <rect className="ep-hero__bar ep-hero__bar--2" x="62" y="44" width="16" height="52" rx="4" fill="url(#epAnGrad)" />
        <rect className="ep-hero__bar ep-hero__bar--3" x="86" y="34" width="16" height="62" rx="4" fill="#f0c56a" />
        <path
          className="ep-hero__trend"
          d="M36 78c18-8 28-28 46-32 12-2 22 10 30 6"
          fill="none"
          stroke="#e8a63b"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <g className="ep-hero__char">
          <circle cx="158" cy="52" r="22" fill="#fff" stroke="#e2e8ef" strokeWidth="2.2" />
          <circle cx="150" cy="48" r="2.2" fill="#3d4f5f" />
          <circle cx="166" cy="48" r="2.2" fill="#3d4f5f" />
          <path d="M152 58c3.5 4 12 4 15.5 0" stroke="#e8a63b" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <path d="M170 32c6-10 14-6 14 3" stroke="#e8a63b" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <path d="M140 78c8 18 34 18 42 0" stroke="#e2e8ef" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <circle className="ep-hero__spark" cx="178" cy="24" r="4" fill="#e8a63b" />
        </g>
      </svg>
    </div>
  );
}

const HERO_ART: Partial<Record<Tone, () => ReactNode>> = {
  jobs: JobsHeroArt,
  interviews: InterviewsHeroArt,
  applications: ApplicationsHeroArt,
  analytics: AnalyticsHeroArt,
};

export function EmployerSectionHero({
  tone,
  title,
  subtitle,
  action,
  compact = false,
}: {
  tone: Tone;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  const meta = TONE_META[tone];
  const Art = HERO_ART[tone];
  return (
    <header className={`ep-hero ep-hero--${tone} ${compact ? 'ep-hero--compact' : ''}`.trim()}>
      <div className="ep-hero__glow" aria-hidden />
      <div className="ep-hero__copy">
        <p className="ep-hero__eyebrow">{meta.eyebrow}</p>
        <h1 className="ep-hero__title">{title}</h1>
        <p className="ep-hero__sub">{subtitle || meta.accent}</p>
      </div>
      {Art ? <Art /> : null}
      {action ? <div className="ep-hero__action">{action}</div> : null}
    </header>
  );
}

export function EmployerQuickLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="ep-hero__link">
      {children}
    </Link>
  );
}
