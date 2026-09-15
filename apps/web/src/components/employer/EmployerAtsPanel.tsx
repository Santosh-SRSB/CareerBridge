'use client';

import type { JobMatch } from '@careerbridge/shared';
import { atsMatchBand, toAtsMatchBreakdown } from '@careerbridge/shared';

type Props = {
  match: JobMatch;
  compact?: boolean;
  className?: string;
};

export function EmployerAtsBandChip({ score }: { score: number }) {
  const band = atsMatchBand(score);
  return (
    <span className={`ep-ats-chip ep-ats-chip--${band.toLowerCase()}`}>
      {score}/100 · {band === 'EXCELLENT'
        ? 'Excellent Match'
        : band === 'STRONG'
          ? 'Strong Match'
          : band === 'GOOD'
            ? 'Good Match'
            : band === 'POTENTIAL'
              ? 'Potential Match'
              : 'Low Match'}
    </span>
  );
}

/** Employer-facing ATS breakdown (PDF: score, factors, why / gaps). */
export function EmployerAtsPanel({ match, compact = false, className = '' }: Props) {
  const ats = toAtsMatchBreakdown(match);

  return (
    <section className={`ep-ats-panel ${compact ? 'ep-ats-panel--compact' : ''} ${className}`.trim()}>
      <header className="ep-ats-panel__head">
        <div>
          <p className="ep-ats-panel__eyebrow">ATS score</p>
          <p className="ep-ats-panel__score">
            <strong>{ats.score}</strong>
            <span>/ 100</span>
          </p>
          <p className={`ep-ats-panel__band ep-ats-panel__band--${ats.band.toLowerCase()}`}>
            {ats.bandLabel}
          </p>
        </div>
        <div className="ep-ats-panel__ring" aria-hidden>
          <svg viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="30" fill="none" stroke="#e6e2d8" strokeWidth="6" />
            <circle
              cx="36"
              cy="36"
              r="30"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${(ats.score / 100) * 188} 188`}
              transform="rotate(-90 36 36)"
              className={`ep-ats-panel__ring-arc ep-ats-panel__ring-arc--${ats.band.toLowerCase()}`}
            />
          </svg>
        </div>
      </header>

      <ul className="ep-ats-panel__factors">
        {ats.factors.map((factor) => (
          <li key={factor.key}>
            <div className="ep-ats-panel__factor-row">
              <span>{factor.label}</span>
              <strong>
                {factor.score}/{factor.max}
              </strong>
            </div>
            <div className="ep-ats-panel__bar" aria-hidden>
              <span style={{ width: `${Math.min(100, Math.max(0, factor.pct))}%` }} />
            </div>
          </li>
        ))}
      </ul>

      {!compact ? (
        <div className="ep-ats-panel__explain">
          {ats.reasons.length > 0 ? (
            <div>
              <h3>Why this candidate matches</h3>
              <ul>
                {ats.reasons.map((reason) => (
                  <li key={reason} className="ep-ats-panel__ok">
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {ats.gaps.length > 0 ? (
            <div>
              <h3>Missing / weaker areas</h3>
              <ul>
                {ats.gaps.map((gap) => (
                  <li key={gap} className="ep-ats-panel__gap">
                    {gap}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="ep-ats-panel__note">
        ATS supports your decision — it does not auto-reject or auto-hire.
      </p>
    </section>
  );
}
