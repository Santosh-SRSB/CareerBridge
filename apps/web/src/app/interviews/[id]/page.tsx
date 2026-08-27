'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { InterviewSession } from '@careerbridge/shared';
import { answerInterview, getInterview } from '@/lib/api';
import { CandidateShell } from '@/components/CandidatePortal';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';

export default function InterviewSessionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getInterview(params.id).then((item) => {
      setSession(item);
      if (item.mode === 'LIVE_AI') {
        router.replace(item.status === 'COMPLETED' ? `/interviews/${item.id}/report` : `/interviews/live/${item.id}`);
        return;
      }
      if (item.status === 'COMPLETED') router.replace(`/interviews/${item.id}/feedback`);
    });
  }, [params.id, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (answer.trim().length < 8) {
      setError('Type your answer. You can take your time.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const next = await answerInterview(params.id, answer.trim());
      setAnswer('');
      if (next.status === 'COMPLETED') {
        router.replace(`/interviews/${next.id}/feedback`);
        return;
      }
      setSession(next);
    } finally {
      setLoading(false);
    }
  }

  if (!session?.currentQuestion) {
    return (
      <CandidateShell>
        <p className="text-muted">Loading your practice interview...</p>
      </CandidateShell>
    );
  }

  const progress = ((session.currentQuestion.index + 1) / session.totalQuestions) * 100;

  return (
    <CandidateShell>
      <Link href="/interviews" className="text-sm font-bold text-teal hover:underline">
        ← Interviews
      </Link>
      <p className="text-sm font-bold text-muted">
        Question {session.currentQuestion.index + 1} of {session.totalQuestions}
      </p>
      <div className="h-2.5 max-w-xl overflow-hidden rounded-pill bg-primary-soft">
        <div className="h-full rounded-pill bg-teal" style={{ width: `${progress}%` }} />
      </div>
      <article className="cb-dash-card max-w-3xl p-4 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal">Question card</p>
        <h1 className="mt-3 text-xl font-extrabold leading-snug text-primary sm:text-2xl">{session.currentQuestion.prompt}</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Textarea
            label="Type your answer"
            name="answer"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            hint="You can take your time. This is practice, not an examination."
            className="min-h-40 rounded-md bg-[#faf8f3] leading-7"
          />
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <Button type="submit" loading={loading} loadingLabel="Saving...">
            Submit Answer
          </Button>
        </form>
      </article>
    </CandidateShell>
  );
}
