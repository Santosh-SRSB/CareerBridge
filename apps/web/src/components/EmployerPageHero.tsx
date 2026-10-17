'use client';

import type { ReactNode } from 'react';
import { BrandMascot, type BrandMascotPose } from '@/components/BrandMascot';

export function EmployerPageHero({
  kicker,
  title,
  description,
  badge,
  action,
  pose = 'book',
}: {
  kicker: string;
  title: string;
  description: string;
  badge?: ReactNode;
  action?: ReactNode;
  pose?: BrandMascotPose;
}) {
  return (
    <header className="jd-hero">
      <div className="jd-hero__copy">
        <p className="jd-hero__kicker">{kicker}</p>
        <h1 className="jd-hero__title">{title}</h1>
        <p className="jd-hero__desc">{description}</p>
        {badge ? <div className="jd-hero__badge">{badge}</div> : null}
        {action ? <div className="jd-hero__action">{action}</div> : null}
      </div>
      <BrandMascot pose={pose} motion="float" size="md" priority className="jd-hero__mascot" />
    </header>
  );
}

export function EmployerPage({ children }: { children: ReactNode }) {
  return <div className="jd-page">{children}</div>;
}

export function EmployerPanel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`jd-panel ${className}`.trim()}>{children}</div>;
}
