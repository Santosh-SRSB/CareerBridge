'use client';

import type { ApplicationRecord } from '@careerbridge/shared';

const STEP_LABELS: Record<string, string> = {
  APPLIED: 'Applied',
  UNDER_REVIEW: 'Review',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW: 'Interview',
  SELECTED: 'Selected',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
  HIRED: 'Hired',
};

function buildSteps(application: ApplicationRecord) {
  if (application.status === 'REJECTED') {
    return [
      { key: 'APPLIED', label: 'Applied', done: true },
      { key: 'REJECTED', label: 'Rejected', done: true, failed: true },
    ];
  }

  const order = ['APPLIED', 'SHORTLISTED', 'INTERVIEW', 'SELECTED'];
  const timeline = application.timeline.length
    ? application.timeline
    : order.map((status) => ({ status, at: '', done: false }));

  const relevant = timeline.filter((item) => order.includes(item.status) || item.status === 'UNDER_REVIEW');
  const merged = order.map((status) => {
    const hit = relevant.find((item) => item.status === status);
    return {
      key: status,
      label: STEP_LABELS[status] || status,
      done: hit?.done ?? false,
      failed: false,
    };
  });

  return merged.filter((step) => step.key !== 'SELECTED' || application.status === 'SELECTED');
}

export function ApplicationProgressTrack({ application }: { application: ApplicationRecord }) {
  const steps = buildSteps(application);

  return (
    <div className="cb-app-progress" aria-label="Application status">
      {steps.map((step, index) => (
        <span key={step.key} className="cb-app-progress__item">
          <span
            className={`cb-app-progress__dot${step.done ? ' is-done' : ''}${step.failed ? ' is-failed' : ''}`}
            aria-hidden="true"
          >
            ●
          </span>
          <span className="cb-app-progress__label">{step.label}</span>
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
          color: #0a2e2c;
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
