'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { InterviewSession } from '@careerbridge/shared';
import { answerInterview, getInterview } from '@/lib/api';
import { CandidateShell } from '@/components/CandidatePortal';

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
        <p className="text-sm text-muted">Opening your typed interview…</p>
      </CandidateShell>
    );
  }

  const progress = ((session.currentQuestion.index + 1) / session.totalQuestions) * 100;

  return (
    <CandidateShell>
      <Link href="/interviews" className="text-sm font-bold text-teal hover:underline">
        ← Interviews
      </Link>
      <p className="mt-2 text-sm font-bold text-muted">
        Question {session.currentQuestion.index + 1} of {session.totalQuestions}
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-primary/10">
        <div className="h-full bg-teal" style={{ width: `${progress}%` }} />
      </div>
      <article className="cb-dash-card mt-4 p-4 sm:p-5">
        <h1 className="text-lg font-extrabold text-primary sm:text-xl">{session.currentQuestion.prompt}</h1>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <textarea
            name="answer"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="Type your answer here."
            className="min-h-40 w-full rounded-md border border-primary/15 px-3 py-2 text-sm"
          />
          {error ? <p className="text-sm font-semibold text-[#c2410c]">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-10 items-center rounded-full bg-teal px-4 text-sm font-extrabold text-primary"
          >
            {loading ? 'Saving…' : 'Submit answer'}
          </button>
        </form>
      </article>
    </CandidateShell>
  );
}
