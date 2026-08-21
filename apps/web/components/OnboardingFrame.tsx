import type { ReactNode } from 'react';
import { AuthShell } from '@/components/AuthShell';

const BACK_HREF: Record<number, string> = {
  1: '/onboarding',
  2: '/onboarding/name',
  3: '/onboarding/location',
  4: '/onboarding/education',
  5: '/onboarding/interests',
};

export function OnboardingFrame({
  step,
  title,
  subtitle,
  children,
}: {
  step: number;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <AuthShell title={title} subtitle={subtitle} backHref={BACK_HREF[step]} marketing={false}>
      <p className="mb-6 text-sm text-muted">{step} of 5</p>
      <div className="mb-6 h-1.5 overflow-hidden rounded-pill bg-primary-soft">
        <div className="h-full bg-accent" style={{ width: `${(step / 5) * 100}%` }} />
      </div>
      {children}
    </AuthShell>
  );
}
