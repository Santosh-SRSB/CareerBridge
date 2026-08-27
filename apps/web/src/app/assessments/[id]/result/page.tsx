'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { SkillAssessmentSession } from '@careerbridge/shared';
import { getSkillAssessment } from '@/lib/api';
import { CandidateShell } from '@/components/CandidatePortal';
import { SkillStudioLoader } from '@/components/SkillEntryCard';
import { SkillProgress } from '@/components/SkillProgress';

function useCountUp(value: number) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 900);
      setShown(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return shown;
}

export default function AssessmentResultPage() {
  const params = useParams<{ id: string }>();
  const [session, setSession] = useState<SkillAssessmentSession | null>(null);

  useEffect(() => {
    getSkillAssessment(params.id).then(setSession);
  }, [params.id]);

  if (!session?.feedback) {
    return (
      <CandidateShell studio scene="result">
        <SkillStudioLoader label="Preparing your result..." />
      </CandidateShell>
    );
  }

  return <ResultBoard session={session} />;
}

function ResultBoard({ session }: { session: SkillAssessmentSession }) {
  const feedback = session.feedback!;
  const score = useCountUp(feedback.score);

  return (
    <CandidateShell studio scene="result">
      <div className="cb-folio">
        <i className="cb-folio-tape a" />
        <i className="cb-folio-tape b" />
        <section className="cb-folio-cert">
          <span className="cb-folio-spine">RESULT SHEET</span>
          <div className="cb-folio-wax" aria-hidden>
            {score}
          </div>
          <Link href="/assessments" className="cb-folio-back">
            ← Skill check
          </Link>
          <p className="cb-folio-kicker">Your skill check</p>
          <h1>
            Score filed.
            <em>{score}</em>
          </h1>
          <p className="cb-folio-lead">
            {feedback.correct} of {feedback.total} strong answers.
            {feedback.score < 60 ? ' Silent clips and empty answers do not score.' : ''}
          </p>
          <div className="cb-folio-bar" aria-hidden>
            <i style={{ width: `${feedback.score}%` }} />
          </div>
          <div className="cb-folio-actions">
            <Link href="/assessments" className="cb-folio-btn">
              Another check
            </Link>
            <Link href="/interviews" className="cb-folio-ghost">
              Mock interview
            </Link>
          </div>
        </section>
        <SkillProgress total={session.totalQuestions} current={session.totalQuestions} revealAll compact />

        <div className="cb-folio-split">
          <section>
            <p className="cb-folio-kicker">Did well</p>
            <ul>
              {feedback.strengths.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section>
            <p className="cb-folio-kicker">Practise next</p>
            <ul>
              {feedback.improvements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>

        {feedback.results.length ? (
          <div className="cb-folio-results">
            {feedback.results.map((item, index) => (
              <div
                key={`${item.prompt}-${index}`}
                className={`cb-folio-row ${item.correct ? 'is-ok' : 'is-no'}`}
                style={{ '--d': `${0.08 + index * 0.05}s` } as CSSProperties}
              >
                <em>{String(index + 1).padStart(2, '0')}</em>
                <div>
                  <small>
                    {item.kind === 'SPOKEN' ? 'Camera' : 'Tick'} · {item.skill}
                  </small>
                  <p>{item.prompt}</p>
                </div>
                <b>{item.correct ? 'Strong' : 'Practise'}</b>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </CandidateShell>
  );
}
