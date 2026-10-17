'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { InterviewSession } from '@careerbridge/shared';
import { getInterview } from '@/lib/api';
import { CandidateShell } from '@/components/CandidatePortal';
import { ScoreRing } from '@/components/ScoreRing';

export default function InterviewFeedbackPage() {
  const params = useParams<{ id: string }>();
  const [session, setSession] = useState<InterviewSession | null>(null);

  useEffect(() => {
    getInterview(params.id).then(setSession);
  }, [params.id]);

  if (!session?.feedback) {
    return (
      <CandidateShell>
        <p className="text-muted">Preparing your feedback...</p>
      </CandidateShell>
    );
  }

  const feedback = session.feedback;
  const metrics = [
    { label: 'Communication', value: feedback.communication },
    { label: 'Answer structure', value: feedback.structure },
    { label: 'Relevance', value: feedback.relevance },
    { label: 'Confidence', value: feedback.confidence },
  ];

  return (
    <CandidateShell>
      <Link href="/interviews" className="text-sm font-bold text-teal hover:underline">
        ← Interviews
      </Link>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">Interview complete</p>
      <h1 className="mt-1 break-words text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">{session.jobRole}</h1>
      <div className="grid items-start gap-4 sm:gap-6 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
        <section className="cb-dash-card flex min-w-0 items-center gap-3 p-4 sm:gap-4 sm:p-5">
          <ScoreRing value={feedback.score} size={64} label="Score" />
          <div className="min-w-0">
            <p className="text-lg font-bold text-primary">{feedback.score} / 100</p>
            <p className="mt-1 text-sm text-muted">You&apos;re improving. Here&apos;s what you can practice next.</p>
          </div>
        </section>
        <section className="cb-dash-card min-w-0 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {metrics.map((item) => (
              <div key={item.label} className="min-w-0">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 font-semibold text-primary">{item.label}</span>
                  <span className="shrink-0 font-bold text-primary">{item.value}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-pill bg-primary-soft">
                  <div className="h-full rounded-pill bg-teal" style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="cb-dash-card p-4 sm:p-5">
          <p className="font-bold text-primary">What you did well</p>
          <ul className="mt-3 space-y-2">
            {feedback.strengths.map((item) => (
              <li key={item} className="text-success">✓ {item}</li>
            ))}
          </ul>
        </section>
        <section className="cb-dash-card p-4 sm:p-5">
          <p className="font-bold text-primary">Improve</p>
          <ul className="mt-3 space-y-2 text-muted">
            {feedback.improvements.map((item) => (
              <li key={item}>→ {item}</li>
            ))}
          </ul>
        </section>
      </div>
      <Link
        href="/interviews"
        className="inline-flex h-8 items-center rounded-full bg-[#1ec8c0] px-3.5 text-xs font-extrabold text-[#0c3340]"
      >
        Practice Again
      </Link>
    </CandidateShell>
  );
}
