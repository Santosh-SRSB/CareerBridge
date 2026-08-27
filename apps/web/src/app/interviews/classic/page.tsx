'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { INTERVIEW_TYPES, type InterviewSession } from '@careerbridge/shared';
import { listInterviews, startInterview } from '@/lib/api';
import { CandidateShell } from '@/components/CandidatePortal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ScoreRing } from '@/components/ScoreRing';

export default function ClassicInterviewsPage() {
  const router = useRouter();
  const [jobRole, setJobRole] = useState('Customer Service Executive');
  const [interviewType, setInterviewType] = useState('CUSTOMER_SERVICE');
  const [history, setHistory] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listInterviews().then(setHistory).catch(() => router.replace('/login'));
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (jobRole.trim().length < 2) {
      setError('Enter the job role you want to practise.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const session = await startInterview(jobRole, interviewType);
      router.push(`/interviews/${session.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <CandidateShell>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">Text mock interview</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">Type your answers</h1>
      <form onSubmit={onSubmit} className="cb-dash-card mt-6 max-w-xl space-y-4 p-4 sm:p-5">
        <Input label="What are you preparing for?" name="jobRole" required value={jobRole} onChange={(event) => setJobRole(event.target.value)} />
        <div className="space-y-2">
          {INTERVIEW_TYPES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setInterviewType(item.value)}
              className={`w-full rounded-md border px-3 py-3 text-left text-sm font-bold ${
                interviewType === item.value ? 'border-primary bg-primary text-white' : 'border-primary/15 bg-surface text-primary'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {error ? <p className="text-sm text-error">{error}</p> : null}
        <Button type="submit" loading={loading} loadingLabel="Starting...">
          Start Mock Interview
        </Button>
      </form>
      <div className="mt-8 grid gap-3 md:grid-cols-2">
        {history.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() =>
              router.push(
                item.mode === 'LIVE_AI'
                  ? `/interviews/${item.id}/report`
                  : item.status === 'COMPLETED'
                    ? `/interviews/${item.id}/feedback`
                    : `/interviews/${item.id}`,
              )
            }
            className="cb-lift-card flex min-w-0 items-center gap-3 p-4 text-left"
          >
            <div className="min-w-0 flex-1">
              <p className="break-words font-bold text-primary">{item.jobRole}</p>
              <p className="mt-1 text-sm text-muted">{item.status === 'COMPLETED' ? 'View report' : 'In progress'}</p>
            </div>
            {item.status === 'COMPLETED' && item.score != null ? <ScoreRing value={item.score} size={64} /> : null}
          </button>
        ))}
      </div>
    </CandidateShell>
  );
}
