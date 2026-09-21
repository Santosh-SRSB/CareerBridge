import type { ReactNode } from 'react';
import Link from 'next/link';

type Tone = 'jobs' | 'applications' | 'interviews' | 'candidates' | 'messages' | 'analytics';

const TONE_META: Record<Tone, { eyebrow: string; accent: string }> = {
  jobs: { eyebrow: 'Openings', accent: 'Publish and manage roles from one board' },
  applications: { eyebrow: 'Pipeline', accent: 'Review ATS scores, shortlist, and decide' },
  interviews: { eyebrow: 'Scheduling', accent: 'Confirm, reschedule, and close interviews' },
  candidates: { eyebrow: 'Talent', accent: 'Search ranked matches for open roles' },
  messages: { eyebrow: 'Inbox', accent: 'Applications, interviews, and alerts' },
  analytics: { eyebrow: 'Insights', accent: 'Funnel volume and role performance' },
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
  return (
    <header className={`ep-prohead ep-prohead--${tone} ${compact ? 'ep-prohead--compact' : ''}`.trim()}>
      <div className="ep-prohead__copy">
        <p className="ep-prohead__eyebrow">{meta.eyebrow}</p>
        <h1 className="ep-prohead__title">{title}</h1>
        <p className="ep-prohead__sub">{subtitle || meta.accent}</p>
      </div>
      {action ? <div className="ep-prohead__action">{action}</div> : null}
    </header>
  );
}

export function EmployerQuickLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="ep-prohead__cta">
      {children}
    </Link>
  );
}
