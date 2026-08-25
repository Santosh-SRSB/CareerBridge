'use client';

import type { ReactNode } from 'react';
import { AuthShell } from '@/components/AuthShell';

export function EmployerOnboardingFrame({
  step,
  title,
  subtitle,
  backHref,
  children,
}: {
  step: 1 | 2;
  title: string;
  subtitle: string;
  backHref?: string;
  children: ReactNode;
}) {
  return (
    <AuthShell title={title} subtitle={subtitle} backHref={backHref} marketing={false}>
      <p className="mb-4 text-sm text-muted">{step} of 2</p>
      <div className="mb-6 h-1.5 overflow-hidden rounded-pill bg-primary-soft">
        <div className="h-full bg-accent" style={{ width: `${(step / 2) * 100}%` }} />
      </div>
      {children}
    </AuthShell>
  );
}
