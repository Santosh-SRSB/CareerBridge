'use client';

import type { ApplicationRecord } from '@careerbridge/shared';

const PROGRESS_STEPS = [
  { key: 'APPLIED', label: 'Applied' },
  { key: 'SHORTLISTED', label: 'Shortlisted' },
  { key: 'INTERVIEW', label: 'Interview' },
] as const;

const OUTCOMES: Record<string, { label: string; failed: boolean }> = {
  SELECTED: { label: 'Selected', failed: false },
  HIRED: { label: 'Hired', failed: false },
  REJECTED: { label: 'Rejected', failed: true },
  WITHDRAWN: { label: 'Withdrawn', failed: true },
};

type Step = { key: string; label: string; done: boolean; failed: boolean };

function buildSteps(application: ApplicationRecord): Step[] {
  const reached = new Set(
    application.timeline.filter((item) => item.done).map((item) => item.status),
  );
  reached.add('APPLIED');
  const currentIndex = PROGRESS_STEPS.findIndex((step) => step.key === application.status);

  const steps: Step[] = PROGRESS_STEPS.map((step, index) => ({
    key: step.key,
    label: step.label,
    done: reached.has(step.key) || (currentIndex >= 0 && index <= currentIndex),
    failed: false,
  }));

  const outcome = OUTCOMES[application.status];
  steps.push({
    key: 'OUTCOME',
    label: outcome?.label ?? 'Outcome',
    done: Boolean(outcome),
    failed: outcome?.failed ?? false,
  });
  return steps;
}

export function ApplicationProgressTrack({ application }: { application: ApplicationRecord }) {
  const steps = buildSteps(application);

  return (
    <div className="cb-app-progress" role="group" aria-label="Application status">
      {steps.map((step, index) => (
        <span key={step.key} className="cb-app-progress__item" data-step={step.key} data-done={step.done}>
          <span
            className={`cb-app-progress__dot${step.done ? ' is-done' : ''}${step.failed ? ' is-failed' : ''}`}
            aria-hidden="true"
          >
            {step.failed ? '✕' : step.done ? '✓' : '○'}
          </span>
          <span className="cb-app-progress__label">{step.label}</span>
          <span className="sr-only">{step.done ? ' (done)' : ' (pending)'}</span>
          {index < steps.length - 1 ? <span className="cb-app-progress__arrow" aria-hidden="true">→</span> : null}
        </span>
      ))}
      <style jsx>{`
        .cb-app-progress {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
        }
        .cb-app-progress__item {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .cb-app-progress__dot {
          color: #cbd5e1;
          font-size: 10px;
        }
        .cb-app-progress__dot.is-done {
          color: var(--color-primary);
        }
        .cb-app-progress__dot.is-failed {
          color: #b91c1c;
        }
        .cb-app-progress__arrow {
          margin: 0 2px;
          color: #94a3b8;
        }
      `}</style>
    </div>
  );
}
