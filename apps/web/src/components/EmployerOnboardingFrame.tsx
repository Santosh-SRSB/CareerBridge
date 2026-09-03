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
    <AuthShell
      title={title}
      subtitle={subtitle}
      backHref={backHref}
      marketing={false}
      showLogo={false}
      compact
    >
      <div className="ep-onboard">
        <div className="ep-onboard__meta">
          <p className="ep-onboard__step">{step} of 2</p>
          <p className="ep-onboard__hint">{step === 1 ? 'Company KYC' : 'Affiliation'}</p>
        </div>
        <div className="ep-onboard__track" aria-hidden>
          <div className="ep-onboard__fill" style={{ width: `${(step / 2) * 100}%` }} />
        </div>
        {children}
      </div>
    </AuthShell>
  );
}
