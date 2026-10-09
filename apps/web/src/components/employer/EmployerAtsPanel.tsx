'use client';

import type { JobMatch } from '@careerbridge/shared';
import { PROFILE_MATCH_LABEL, atsMatchBandInfo, toAtsMatchBreakdown } from '@careerbridge/shared';
import { EvPill } from '@/components/employer/ui';
import { matchBarTone, matchPillTone } from '@/lib/employer-ui-status';

type Props = {
  match: JobMatch;
  compact?: boolean;
  className?: string;
};

const RING_COLOR = { good: '#12936b', mid: '#1f23c4', low: '#e08a1e' } as const;

export function EmployerAtsBandChip({ score }: { score: number }) {
  const info = atsMatchBandInfo(score);
  return (
    <span title={PROFILE_MATCH_LABEL}>
      <EvPill tone={matchPillTone(info.color)}>
        {PROFILE_MATCH_LABEL} {score}/100 · {info.label}
      </EvPill>
    </span>
  );
}

/** Employer-facing ATS breakdown (PDF: score, factors, why / gaps). */
export function EmployerAtsPanel({ match, compact = false, className = '' }: Props) {
  const ats = toAtsMatchBreakdown(match);
  const color = RING_COLOR[matchBarTone(ats.band)];
  const pct = Math.max(0, Math.min(100, ats.score));

  return (
    <section className={`ev-ats ${className}`.trim()} aria-label={`${PROFILE_MATCH_LABEL} ${ats.score} out of 100`}>
      <div className="ev-ring" style={{ background: `conic-gradient(${color} ${pct}%, var(--ev-soft) 0)` }}>
        <div>
          <span>
            <b>{ats.score}</b>
            <br />
            <small>{ats.bandLabel}</small>
          </span>
        </div>
      </div>

      {ats.factors.map((factor) => (
        <div key={factor.key}>
          <div className="ev-mrow">
            <span>{factor.label}</span>
            <span>
              {factor.score}/{factor.max}
            </span>
          </div>
          <div className="ev-bar" aria-hidden>
            <i style={{ width: `${Math.min(100, Math.max(0, factor.pct))}%` }} />
          </div>
        </div>
      ))}

      {!compact && (ats.reasons.length > 0 || ats.gaps.length > 0) ? (
        <div className="ev-explain">
          {ats.reasons.length > 0 ? (
            <div>
              <h3>Why this candidate matches</h3>
              <ul className="ev-list ev-list--ok">
                {ats.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {ats.gaps.length > 0 ? (
            <div>
              <h3>Missing / weaker areas</h3>
              <ul className="ev-list ev-list--gap">
                {ats.gaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="ev-hint">Profile match supports your decision — it does not auto-reject or auto-hire.</p>
    </section>
  );
}
