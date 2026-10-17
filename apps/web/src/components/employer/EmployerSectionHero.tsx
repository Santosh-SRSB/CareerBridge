import type { ReactNode } from 'react';
import Link from 'next/link';
import { EvPageHead } from '@/components/employer/ui';

type Tone = 'jobs' | 'applications' | 'interviews' | 'candidates' | 'messages' | 'analytics';

const TONE_META: Record<Tone, { eyebrow: string; accent: string }> = {
  jobs: { eyebrow: 'Openings', accent: 'Publish and manage roles from one board' },
  applications: { eyebrow: 'Pipeline', accent: 'Review Profile Match, shortlist, and decide' },
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
}: {
  tone: Tone;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  const meta = TONE_META[tone];
  return <EvPageHead eyebrow={meta.eyebrow} title={title} subtitle={subtitle || meta.accent} actions={action} />;
}

export function EmployerQuickLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="ev-btn">
      {children}
    </Link>
  );
}
