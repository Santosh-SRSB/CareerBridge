'use client';

import { type ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/AuthShell';
import { BackButton } from '@/components/ui/BackButton';
import type { PassportSectionKey } from '@careerbridge/shared';
import { getProfileCompletion } from '@/lib/api';
import { PASSPORT_WIZARD_KEYS, passportStepHref, wizardStepIndex } from '@/lib/passport-flow';

const STEP_LABELS: Record<(typeof PASSPORT_WIZARD_KEYS)[number], string> = {
  personal: 'Personal',
  photo: 'Photo',
  education: 'Education',
  skills: 'Skills',
  experience: 'Experience',
  preferences: 'Preferences',
  languages: 'Languages',
  certifications: 'Certificates',
  projects: 'Projects',
  links: 'Links',
};

export function CandidateHeader({
  backHref,
  backLabel = '← Back',
}: {
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="flex items-center justify-between gap-3">
      <Logo />
      {backHref ? (
        <Link href={backHref} className="text-sm font-bold text-teal hover:underline">
          {backLabel}
        </Link>
      ) : null}
    </header>
  );
}

export function PassportFrame({
  title,
  subtitle,
  step,
  children,
}: {
  title: string;
  subtitle?: string;
  step?: PassportSectionKey;
  children: ReactNode;
}) {
  const index = step ? wizardStepIndex(step) : -1;
  const total = PASSPORT_WIZARD_KEYS.length;
  const [doneKeys, setDoneKeys] = useState<PassportSectionKey[]>([]);

  useEffect(() => {
    getProfileCompletion()
      .then((completion) => {
        setDoneKeys(completion.sections.filter((item) => item.done).map((item) => item.key));
      })
      .catch(() => setDoneKeys([]));
  }, [step]);

  if (index < 0 || !step) {
    return (
      <main className="cb-app">
        <CandidateHeader backHref="/dashboard" backLabel="← Back" />
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p> : null}
        <div className="mt-4">{children}</div>
      </main>
    );
  }

  return (
    <main className="cb-wizard">
      <div className="cb-wizard-inner">
        <BackButton fallback="/dashboard" className="cb-wizard-home" />
        <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-teal">Career Passport</p>
        <ol className="cb-wizard-steps" aria-label="Jump to any passport section">
          {PASSPORT_WIZARD_KEYS.map((key, stepIndex) => {
            const active = stepIndex === index;
            const done = doneKeys.includes(key);
            const state = active ? 'active' : done ? 'done' : 'todo';
            const label = STEP_LABELS[key];
            const body = (
              <>
                <span className="cb-wizard-dot">{done && !active ? '✓' : stepIndex + 1}</span>
                <span className="cb-wizard-step-label">{label}</span>
              </>
            );

            return (
              <li key={key} className={`cb-wizard-step is-${state}`}>
                {active ? (
                  <span className="cb-wizard-step-link" aria-current="step">
                    {body}
                  </span>
                ) : (
                  <Link
                    href={passportStepHref(key)}
                    className="cb-wizard-step-link"
                    aria-label={`Open ${label}, step ${stepIndex + 1} of ${total}`}
                  >
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-sm font-bold text-muted">
          Step {index + 1} of {total} · {STEP_LABELS[step]}
        </p>
        <p className="mt-1 text-xs font-semibold text-teal">Tap a section name to open it</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-lg text-sm leading-6 text-muted">{subtitle}</p> : null}
        <div className="cb-wizard-stage">{children}</div>
      </div>
    </main>
  );
}

export function WizardActions({ children }: { children: ReactNode }) {
  return <div className="cb-wizard-actions">{children}</div>;
}

export function Chip({
  selected,
  onClick,
  className = '',
  children,
}: {
  selected: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cb-chip ${selected ? 'is-on' : ''} ${className}`.trim()}
    >
      {children}
    </button>
  );
}
