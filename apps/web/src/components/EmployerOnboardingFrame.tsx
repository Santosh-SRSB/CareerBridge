'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

function KycHeroArt() {
  return (
    <svg viewBox="0 0 300 240" className="ep-onboard__art" aria-hidden>
      <defs>
        <linearGradient id="epProGlow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1f6f66" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#c4b896" stopOpacity="0.12" />
        </linearGradient>
      </defs>
      <circle cx="150" cy="120" r="96" fill="url(#epProGlow)" className="ep-art-pulse" />
        <g className="ep-art-float">
        <circle cx="128" cy="118" r="58" fill="#fff" stroke="#0d2826" strokeWidth="3" />
        <circle cx="110" cy="110" r="4" fill="#0d2826" />
        <circle cx="146" cy="110" r="4" fill="#0d2826" />
        <path
          d="M108 132c8 13 32 13 40 0"
          fill="none"
          stroke="#0d2826"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M88 94c10-16 28-24 40-20"
          fill="none"
          stroke="#0d2826"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <path
          d="M168 94c-8-14-20-22-34-20"
          fill="none"
          stroke="#0d2826"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <g transform="translate(178 52)">
          <circle cx="28" cy="28" r="24" fill="#fff" stroke="#0d2826" strokeWidth="3" />
          <circle className="ep-art-pulse" cx="28" cy="28" r="11" fill="none" stroke="#1f6f66" strokeWidth="3" />
          <path d="M45 45 64 64" stroke="#0d2826" strokeWidth="4" strokeLinecap="round" />
        </g>
        <g transform="translate(42 56)">
          <rect x="0" y="10" width="48" height="58" rx="7" fill="#fff" stroke="#0d2826" strokeWidth="3" />
          <path d="M12 26h24M12 38h24M12 50h16" stroke="#0d2826" strokeWidth="2.3" strokeLinecap="round" />
          <circle cx="48" cy="12" r="14" fill="#1f6f66" />
          <path d="M42 12h12M48 6v12" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}

export function EmployerOnboardingFrame({
  step,
  title,
  subtitle,
  backHref,
  sideTitle,
  children,
}: {
  step: 1 | 2;
  title: string;
  subtitle: string;
  backHref?: string;
  sideTitle?: string;
  children: ReactNode;
}) {
  const side =
    sideTitle ||
    (step === 1 ? "Let's verify your GSTIN!" : "Let's confirm your company!");

  return (
    <main className="ep-onboard-page">
      {backHref ? (
        <Link href={backHref} className="ep-onboard-page__back">
          Back ←
        </Link>
      ) : null}

      <div className="ep-onboard-page__shell">
        <aside className="ep-onboard-page__aside" aria-hidden={false}>
          <div className="ep-onboard-page__aside-inner">
            <KycHeroArt />
            <p className="ep-onboard-page__aside-copy">{side}</p>
          </div>
        </aside>

        <section className="ep-onboard-page__panel">
          <div className="ep-onboard">
            <div className="ep-onboard__meta">
              <p className="ep-onboard__hint">{step === 1 ? 'Company KYC' : 'Affiliation'}</p>
              <p className="ep-onboard__step">Step {step} of 2</p>
            </div>
            <h1 className="ep-onboard__title">{title}</h1>
            {subtitle ? <p className="ep-onboard__sub">{subtitle}</p> : null}
            <div className="ep-onboard__track" aria-hidden>
              <div
                className="ep-onboard__fill"
                style={{ width: `${(step / 2) * 100}%` }}
              />
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
