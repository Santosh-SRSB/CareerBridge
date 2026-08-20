'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { SkillAssessmentSession } from '@careerbridge/shared';
import { getSkillAssessment } from '@/lib/api';
import { CandidateShell } from '@/components/CandidatePortal';
import { SkillMascot } from '@/components/SkillMascot';
import { SkillStudioLoader } from '@/components/SkillEntryCard';
import { SkillProgress } from '@/components/SkillProgress';

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

  const feedback = session.feedback;

  return (
    <CandidateShell studio scene="result">
      <section className="cb-arena">
        <span className="cb-arena-scan" />
        {feedback.score >= 70 ? (
          <div className="cb-arena-confetti" aria-hidden>
            <i /><i /><i /><i /><i /><i />
          </div>
        ) : null}
        <div className="cb-arena-body">
          <div className="cb-arena-copy cb-arena-rise">
            <Link href="/assessments" className="cb-arena-kicker hover:underline">
              ← Skill check
            </Link>
            <h1>
              Your score.
              <em className="cb-hero-accent">{feedback.score}</em>
            </h1>
            <p>
              {feedback.correct} of {feedback.total} strong answers.
              {feedback.score < 60 ? ' Silent clips and empty answers do not score.' : ''}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className={`cb-score-burst ${feedback.score < 60 ? 'is-low' : ''}`}>
                <span>{feedback.score}</span>
              </div>
              <div className={`cb-check-meter min-w-0 flex-1 ${feedback.score < 70 ? 'is-mid' : ''}`}>
                <i style={{ width: `${feedback.score}%` }} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/assessments"
                className="cb-studio-btn inline-flex h-9 items-center rounded-full bg-[#1ec8c0] px-3 text-xs font-extrabold text-[#0c3340]"
              >
                Another check
              </Link>
              <Link
                href="/interviews"
                className="cb-studio-btn inline-flex h-9 items-center rounded-full border border-white/25 px-3 text-xs font-bold text-white hover:bg-white/10"
              >
                Mock interview
              </Link>
            </div>
          </div>
          <div className="cb-arena-art">
            <div className="cb-arena-token">
              <i className="cb-arena-spinring" />
              <SkillMascot pose="graduate" className="cb-arena-float" alt="Skill graduate" />
            </div>
          </div>
        </div>
        <SkillProgress total={session.totalQuestions} current={session.totalQuestions} revealAll />
      </section>

      <div className="grid gap-2 sm:grid-cols-2">
        <section className="cb-check-sheet cb-arena-rise p-3" style={{ animationDelay: '120ms' }}>
          <p className="cb-check-kicker">Did well</p>
          <ul className="mt-2 space-y-1 text-xs text-success">
            {feedback.strengths.map((item) => (
              <li key={item}>✓ {item}</li>
            ))}
          </ul>
        </section>
        <section className="cb-check-sheet cb-arena-rise p-3" style={{ animationDelay: '180ms' }}>
          <p className="cb-check-kicker">Practise next</p>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {feedback.improvements.map((item) => (
              <li key={item}>→ {item}</li>
            ))}
          </ul>
        </section>
      </div>

      {feedback.results.length ? (
        <div className="cb-check-list cb-arena-rise" style={{ animationDelay: '240ms' }}>
          {feedback.results.map((item, index) => (
            <div key={`${item.prompt}-${index}`} className="cb-check-row cb-arena-rise" style={{ animationDelay: `${80 + index * 50}ms` }}>
              <span className="shrink-0 text-xs font-extrabold text-muted">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                  {item.kind === 'SPOKEN' ? 'Camera' : 'Objective'} · {item.skill}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-primary">{item.prompt}</p>
              </div>
              <span className={`cb-result-tag ${item.correct ? 'is-ok' : 'is-no'}`}>
                {item.correct ? 'Strong' : 'Practise'}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </CandidateShell>
  );
}
