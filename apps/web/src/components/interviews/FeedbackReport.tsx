'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import { SRSB_LOGO_SRC } from '@/components/Logo';
import './FeedbackReport.css';

export type FeedbackReportSkill = {
  name: string;
  /** Score on a 1–10 scale */
  score: number;
};

export type FeedbackReportPoint = {
  type: 'good' | 'improve';
  text: string;
};

export type FeedbackReportQuestion = {
  number: number;
  /** Score typically 0–100 */
  score: number;
  question: string;
  answer: string;
  analysis: {
    summary: string;
    missing: string[];
    tip: string;
  };
  improvedAnswer: string;
};

export type FeedbackReportData = {
  candidate: string;
  role: string;
  date: string;
  time: string;
  duration: string;
  questionsAnswered: string;
  assessedBy: string;
  overallScore: number;
  status: string;
  joiningTime?: string;
  leavingTime?: string;
  actualDuration?: string;
  skills: FeedbackReportSkill[];
  feedbackPoints: FeedbackReportPoint[];
  questions: FeedbackReportQuestion[];
};

function clamp10(score: number) {
  return Math.max(0, Math.min(10, score));
}

/** Map 1–10 skill score to legend color. */
export function skillScoreColor(score: number): string {
  const s = clamp10(score);
  if (s <= 2) return 'var(--fr-poor)';
  if (s <= 5) return 'var(--fr-average)';
  if (s < 7) return 'var(--fr-above)';
  if (s <= 8) return 'var(--fr-good)';
  return 'var(--fr-excellent)';
}

function RatingGauge({ score }: { score: number }) {
  const s = clamp10(score);
  // Semicircle needle: -90deg (left/poor) → +90deg (right/excellent)
  const angle = -90 + (s / 10) * 180;

  return (
    <svg
      className="fr-gauge"
      viewBox="0 0 200 120"
      role="img"
      aria-label={`Overall rating ${s.toFixed(1)} out of 10`}
    >
      {/* Colored arc segments */}
      <path d="M20 100 A80 80 0 0 1 52 35" fill="none" stroke="var(--fr-poor)" strokeWidth="14" strokeLinecap="butt" />
      <path d="M52 35 A80 80 0 0 1 100 20" fill="none" stroke="var(--fr-average)" strokeWidth="14" strokeLinecap="butt" />
      <path d="M100 20 A80 80 0 0 1 140 32" fill="none" stroke="var(--fr-above)" strokeWidth="14" strokeLinecap="butt" />
      <path d="M140 32 A80 80 0 0 1 168 55" fill="none" stroke="var(--fr-good)" strokeWidth="14" strokeLinecap="butt" />
      <path d="M168 55 A80 80 0 0 1 180 100" fill="none" stroke="var(--fr-excellent)" strokeWidth="14" strokeLinecap="butt" />
      {/* Needle */}
      <g transform={`rotate(${angle} 100 100)`}>
        <line x1="100" y1="100" x2="100" y2="38" stroke="var(--fr-ink)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="100" cy="38" r="3.5" fill="var(--fr-ink)" />
      </g>
      <circle cx="100" cy="100" r="7" fill="var(--fr-ink)" />
      <circle cx="100" cy="100" r="3.5" fill="var(--fr-card)" />
    </svg>
  );
}

function Chip({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="fr-chip">
      <p className="fr-chip__label">
        <span aria-hidden>{icon}</span> {label}
      </p>
      <p className="fr-chip__value">{value || '—'}</p>
    </div>
  );
}

export function FeedbackReport({
  data,
  footer,
}: {
  data: FeedbackReportData;
  footer?: ReactNode;
}) {
  const overall = clamp10(Number(data.overallScore) || 0);
  const overallDisplay = Number.isInteger(overall) ? String(overall) : overall.toFixed(1);

  return (
    <div className="fr-page">
      <article className="fr-card">
        {/* Top bar */}
        <header className="fr-topbar">
          <div className="fr-brand">
            <Image
              src={SRSB_LOGO_SRC}
              alt="Career Bridge"
              width={40}
              height={40}
              className="fr-brand__mark"
              unoptimized
              priority
            />
            <span className="fr-brand__name">Career Bridge</span>
          </div>
          <p className="fr-topbar__label">Feedback Report</p>
        </header>

        <h1 className="fr-candidate">{data.candidate || 'Candidate'}</h1>

        {/* Meta + gauge */}
        <div className="fr-header-grid">
          <div className="fr-chips">
            <Chip icon="📅" label="Interview Date" value={data.date} />
            <Chip icon="💼" label="Role" value={data.role} />
            <Chip icon="✅" label="Questions Answered" value={data.questionsAnswered} />
            <Chip icon="🕐" label="Interview Time" value={data.time} />
            <Chip icon="👤" label="Assessed By" value={data.assessedBy} />
            <Chip icon="⏱" label="Duration" value={data.duration} />
          </div>

          <div className="fr-gauge-box">
            <RatingGauge score={overall} />
            <p className="fr-gauge-box__label">Overall Rating</p>
            <p className="fr-gauge-box__score">
              {overallDisplay} <span>/ 10</span>
            </p>
            <span className="fr-status-pill">{data.status || 'Reviewed'}</span>
          </div>
        </div>

        {/* Session summary */}
        {(data.joiningTime || data.leavingTime || data.actualDuration) && (
          <section className="fr-section">
            <h2 className="fr-section__title">Interviewer Session Summary</h2>
            <p className="fr-session-line">
              Joining Time: <strong>{data.joiningTime || '—'}</strong>
              {' · '}
              Leaving Time: <strong>{data.leavingTime || '—'}</strong>
              {' · '}
              Actual Duration: <strong>{data.actualDuration || data.duration || '—'}</strong>
            </p>
          </section>
        )}

        {/* Skill rating */}
        <section className="fr-section">
          <h2 className="fr-section__title">★ Skill Rating (1–10)</h2>
          <div className="fr-legend" aria-hidden>
            <span>
              <i style={{ background: 'var(--fr-poor)' }} /> 1–2 Poor
            </span>
            <span>
              <i style={{ background: 'var(--fr-average)' }} /> 3–5 Average
            </span>
            <span>
              <i style={{ background: 'var(--fr-above)' }} /> 6 Above Average
            </span>
            <span>
              <i style={{ background: 'var(--fr-good)' }} /> 7–8 Good
            </span>
            <span>
              <i style={{ background: 'var(--fr-excellent)' }} /> 9–10 Excellent
            </span>
          </div>
          <table className="fr-skills">
            <thead>
              <tr>
                <th>Skill</th>
                <th>Interviewer Rating</th>
              </tr>
            </thead>
            <tbody>
              {data.skills.map((skill) => (
                <tr key={skill.name}>
                  <td>{skill.name}</td>
                  <td style={{ color: skillScoreColor(skill.score), fontWeight: 700 }}>
                    {clamp10(skill.score).toFixed(skill.score % 1 ? 1 : 0)}
                  </td>
                </tr>
              ))}
              <tr className="fr-skills__total">
                <td>Overall Rating</td>
                <td style={{ color: skillScoreColor(overall) }}>{overallDisplay}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Feedback points */}
        {data.feedbackPoints.length > 0 ? (
          <section className="fr-section">
            <h2 className="fr-section__title">Interviewer Feedback</h2>
            <div className="fr-feedback-list">
              {data.feedbackPoints.map((point, idx) => (
                <div
                  key={`${point.type}-${idx}`}
                  className={
                    point.type === 'good' ? 'fr-feedback fr-feedback--good' : 'fr-feedback fr-feedback--improve'
                  }
                >
                  <span className="fr-feedback__icon" aria-hidden>
                    {point.type === 'good' ? '✓' : '!'}
                  </span>
                  <p>
                    <strong>{point.type === 'good' ? 'Good — ' : 'Need Improvement — '}</strong>
                    {point.text}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Question-wise */}
        {data.questions.length > 0 ? (
          <section className="fr-section">
            <h2 className="fr-section__title">Question Wise Analysis</h2>
            <p className="fr-section__sub">Practice only — recruiters make hiring decisions.</p>
            <div className="fr-q-list">
              {data.questions.map((q) => (
                <article key={q.number} className="fr-q-card">
                  <div className="fr-q-card__head">
                    <p className="fr-q-card__title">
                      <span aria-hidden>💬</span> Question {q.number}
                    </p>
                    <span className="fr-q-card__score">{Math.round(q.score)}/100</span>
                  </div>
                  <p className="fr-q-card__question">{q.question}</p>

                  <div className="fr-q-block fr-q-block--answer">
                    <div className="fr-q-block__label">
                      <span className="fr-q-block__badge" aria-hidden>
                        A
                      </span>
                      Your Answer
                    </div>
                    <p className="fr-q-block__body">{q.answer || '—'}</p>
                  </div>

                  <div className="fr-q-block fr-q-block--analysis">
                    <div className="fr-q-block__label">
                      <span className="fr-q-block__badge" aria-hidden>
                        !
                      </span>
                      AI Analysis &amp; Improvement Tips
                    </div>
                    {q.analysis.summary ? <p className="fr-q-block__body">{q.analysis.summary}</p> : null}
                    {q.analysis.missing?.length ? (
                      <ul className="fr-q-missing">
                        {q.analysis.missing.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : null}
                    {q.analysis.tip ? <p className="fr-q-tip">{q.analysis.tip}</p> : null}
                  </div>

                  {q.improvedAnswer ? (
                    <div className="fr-q-block fr-q-block--improved">
                      <div className="fr-q-block__label">
                        <span className="fr-q-block__badge" aria-hidden>
                          ✓
                        </span>
                        AI Improved Answer
                      </div>
                      <p className="fr-q-block__body">{q.improvedAnswer}</p>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {footer ? <div className="fr-footer">{footer}</div> : null}
      </article>
    </div>
  );
}
