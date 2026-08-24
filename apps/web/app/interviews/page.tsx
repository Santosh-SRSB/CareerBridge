'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HUMAN_INTERVIEW_PRICE_INR, INTERVIEW_TYPES, type HumanMockSession, type InterviewSession } from '@careerbridge/shared';
import { listHumanMocks, listInterviews, startInterview } from '@/lib/api';
import { CandidateShell } from '@/components/CandidatePortal';
import { SkillMascot } from '@/components/SkillMascot';

function whenLabel(value: string) {
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function InterviewsPage() {
  const router = useRouter();
  const [jobRole, setJobRole] = useState('Customer Service Executive');
  const [interviewType, setInterviewType] = useState('CUSTOMER_SERVICE');
  const [history, setHistory] = useState<InterviewSession[]>([]);
  const [human, setHuman] = useState<HumanMockSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let gone = false;
    listInterviews()
      .then((ai) => {
        if (!gone) setHistory(ai);
      })
      .catch((err) => {
        const code = (err as { code?: string }).code;
        if (code === 'UNAUTHORIZED') router.replace('/login');
      });
    listHumanMocks()
      .then((live) => {
        if (!gone) setHuman(live);
      })
      .catch(() => undefined);
    return () => {
      gone = true;
    };
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
      <h1 className="text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">Interviews</h1>
      <p className="mt-1 text-sm text-muted">Live with a CareerBridge interviewer, or typed with AI. Video is never stored.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link href="/interviews/human" className="cb-hire-pass">
          <SkillMascot pose="coach" className="cb-hire-eagle" alt="" />
          <p>Human interview</p>
          <b>Pay, then book a time</b>
          <span className="cb-hire-shimmer">₹{HUMAN_INTERVIEW_PRICE_INR} static checkout</span>
        </Link>
        <section className="cb-dash-card p-4 sm:p-5">
          <p className="text-sm font-bold text-orange">AI interview</p>
          <p className="mt-1 font-extrabold text-primary">Type your answers</p>
          <p className="mt-1 text-sm text-muted">Eight questions. About 10 minutes.</p>
        </section>
      </div>

      <section className="cb-dash-card mt-3 p-4 sm:p-5">
        <h2 className="text-base font-bold text-primary">Your live interviews</h2>
        {human.length ? (
          <div className="mt-3 space-y-2">
            {human.map((item) => (
              <button
                key={item.id}
                type="button"
                className="cb-hire-rowcard"
                onClick={() =>
                  router.push(
                    item.status === 'COMPLETED' ? `/interviews/human/${item.id}/score` : `/interviews/human/${item.id}`,
                  )
                }
              >
                <span>
                  <b>{item.jobRole}</b>
                  <span>
                    {item.interviewerName ? `${item.interviewerName} · ` : ''}
                    {item.status === 'COMPLETED' ? `Score ${item.score ?? '—'}` : whenLabel(item.scheduledAt)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">None yet.</p>
        )}
      </section>

      <form onSubmit={onSubmit} className="cb-dash-card mt-3 space-y-4 p-4 sm:p-5">
        <h2 className="text-base font-bold text-primary">Start a typed AI interview</h2>
        <label className="block text-sm font-bold text-primary">
          Role
          <input
            name="jobRole"
            required
            value={jobRole}
            onChange={(event) => setJobRole(event.target.value)}
            className="mt-1 w-full rounded-md border border-primary/15 px-3 py-2 text-sm font-semibold"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {INTERVIEW_TYPES.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                interviewType === item.value ? 'bg-primary text-white' : 'bg-[#eefaf8] text-primary'
              }`}
              onClick={() => setInterviewType(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {error ? <p className="text-sm font-semibold text-orange">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-10 items-center rounded-full bg-teal px-4 text-sm font-extrabold text-primary"
        >
          {loading ? 'Opening…' : 'Start typed interview'}
        </button>
      </form>

      <section className="cb-dash-card mt-3 p-4 sm:p-5">
        <h2 className="text-base font-bold text-primary">Earlier typed interviews</h2>
        {history.length ? (
          <div className="mt-3 space-y-2">
            {history.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-md border border-primary/10 bg-[#f7fbfb] px-3 py-3 text-left"
                onClick={() =>
                  router.push(item.status === 'COMPLETED' ? `/interviews/${item.id}/feedback` : `/interviews/${item.id}`)
                }
              >
                <span>
                  <span className="block font-bold text-primary">{item.jobRole}</span>
                  <span className="text-sm text-muted">
                    {item.status === 'COMPLETED' ? `Score ${item.score ?? '—'}` : 'In progress'}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">None yet.</p>
        )}
      </section>
    </CandidateShell>
  );
}
