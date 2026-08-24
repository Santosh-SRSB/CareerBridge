'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { InterviewSession } from '@careerbridge/shared';
import { getInterview } from '@/lib/api';
import { CandidateShell } from '@/components/CandidatePortal';
import { SkillEntryCard } from '@/components/SkillEntryCard';

export default function InterviewFeedbackPage() {
  const params = useParams<{ id: string }>();
  const [session, setSession] = useState<InterviewSession | null>(null);

  useEffect(() => {
    getInterview(params.id).then(setSession);
  }, [params.id]);

  if (!session?.feedback) {
    return (
      <CandidateShell>
        <p className="text-sm text-muted">Preparing your notes…</p>
      </CandidateShell>
    );
  }

  const feedback = session.feedback;
  const metrics = [
    { label: 'Talk', value: feedback.communication },
    { label: 'Shape', value: feedback.structure },
    { label: 'Fit', value: feedback.relevance },
    { label: 'Ease', value: feedback.confidence },
  ];

  return (
    <CandidateShell>
      <Link href="/interviews" className="text-sm font-bold text-teal hover:underline">
        ← Interviews
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">Score {feedback.score}</h1>
      <p className="mt-1 text-sm text-muted">{session.jobRole} · Typed AI interview</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {metrics.map((item) => (
          <div key={item.label} className="cb-dash-card p-4">
            <p className="flex justify-between text-sm font-bold text-primary">
              {item.label} <span>{item.value}</span>
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-primary/10">
              <div className="h-full bg-teal" style={{ width: `${item.value}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <section className="cb-dash-card p-4 sm:p-5">
          <h2 className="text-base font-bold text-primary">Did well</h2>
          <ul className="mt-2 space-y-1 text-sm text-primary">
            {feedback.strengths.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </section>
        <section className="cb-dash-card p-4 sm:p-5">
          <h2 className="text-base font-bold text-primary">Next</h2>
          <ul className="mt-2 space-y-1 text-sm text-primary">
            {feedback.improvements.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href="/interviews"
          className="inline-flex h-10 items-center rounded-full bg-teal px-4 text-sm font-extrabold text-primary"
        >
          Practice again
        </Link>
        <SkillEntryCard variant="teaser" />
      </div>
    </CandidateShell>
  );
}
