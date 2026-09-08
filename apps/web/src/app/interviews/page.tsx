'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { InterviewSession } from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { Button } from '@/components/ui/Button';
import { WhatsAppInterviewNotice } from '@/components/marketplace/WhatsAppInterviewNotice';
import {
  confirmScheduledInterview,
  fetchScheduledInterviews,
  rescheduleScheduledInterview,
} from '@/lib/candidate-marketplace-api';
import { mockInterviewSetupUrl } from '@/lib/mock-interview-url';
import type { ScheduledJobInterview } from '@/lib/candidate-marketplace-api';
import { listInterviews } from '@/lib/api';

function formatInterviewDate(value: string) {
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function InterviewsHubPage() {
  const router = useRouter();
  const [upcoming, setUpcoming] = useState<ScheduledJobInterview[]>([]);
  const [history, setHistory] = useState<InterviewSession[]>([]);
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    setLoadError('');
    fetchScheduledInterviews()
      .then(setUpcoming)
      .catch((err) => {
        setUpcoming([]);
        setLoadError(err instanceof Error ? err.message : 'Could not load scheduled interviews.');
      });
    listInterviews()
      .then((rows) => setHistory(rows.filter((row) => row.status === 'COMPLETED').slice(0, 8)))
      .catch(() => setHistory([]));
  }, []);

  async function handleConfirm(id: string) {
    setBusyId(id);
    setMessage('');
    try {
      await confirmScheduledInterview(id);
      setUpcoming(await fetchScheduledInterviews());
      setMessage('Interview confirmed successfully.');
    } catch {
      setMessage('Could not confirm interview right now.');
    } finally {
      setBusyId('');
    }
  }

  async function handleReschedule(id: string) {
    setBusyId(id);
    setMessage('');
    try {
      await rescheduleScheduledInterview(id);
      setUpcoming(await fetchScheduledInterviews());
      setMessage('Reschedule request sent.');
    } catch {
      setMessage('Could not request reschedule right now.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <CandidateAppShell activeTab="interviews" maxWidth="max-w-3xl">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">My Interviews</h1>
          <p className="mt-1 text-sm text-slate-600">
            Upcoming employer interviews and mock practice in one place.
          </p>
        </div>

        <section className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Upcoming</p>
          {loadError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              {loadError}
            </div>
          ) : null}
          {!loadError && upcoming.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              No upcoming interviews scheduled yet. Employer interviews only appear for the candidate
              account that was selected when scheduling.
            </div>
          ) : null}
          {upcoming.map((interview) => (
              <article
                key={interview.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <h2 className="text-base font-extrabold text-slate-900">{interview.jobTitle}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">{interview.companyName}</p>
                <p className="mt-3 text-sm text-slate-700">{formatInterviewDate(interview.scheduledDate)}</p>
                <p className="text-sm font-bold text-slate-800">{interview.scheduledTime}</p>
                <p className="mt-2 text-sm font-semibold text-emerald-700">
                  Status:{' '}
                  {interview.status === 'CONFIRMED'
                    ? 'Confirmed ✓'
                    : interview.status.replace(/_/g, ' ')}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/interviews/scheduled/${interview.id}`}>
                    <Button type="button" variant="outline">
                      View Details
                    </Button>
                  </Link>
                  <Button
                    type="button"
                    onClick={() => router.push(mockInterviewSetupUrl(interview.jobTitle))}
                  >
                    Prepare for Interview
                  </Button>
                </div>

                <div className="mt-5">
                  <WhatsAppInterviewNotice
                    interview={interview}
                    busy={busyId === interview.id}
                    onConfirm={() => void handleConfirm(interview.id)}
                    onReschedule={() => void handleReschedule(interview.id)}
                  />
                </div>
              </article>
            ))}
        </section>

        {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-900">AI Mock Interview</h2>
          <p className="mt-2 text-sm text-slate-600">
            Practise common and role-specific questions before your real interview.
          </p>
          <Button type="button" className="mt-4" onClick={() => router.push('/interviews/mock')}>
            Start Mock Interview
          </Button>
        </section>

        <section className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Practice history</p>
          {history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-600">
              Completed mock interviews will appear here.
            </div>
          ) : (
            history.map((session) => (
              <article
                key={session.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-slate-900">
                    {session.jobRole || 'Mock interview'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {session.status}
                    {typeof session.score === 'number' ? ` · Score ${session.score}%` : ''}
                  </p>
                </div>
                <Link
                  href={
                    session.mode === 'LIVE_AI' || session.mode === 'CLASSIC'
                      ? `/interviews/${session.id}/report`
                      : `/interviews/mock/${session.id}/result`
                  }
                  className="shrink-0 text-xs font-bold text-[#0a2e2c] hover:underline"
                >
                  View result
                </Link>
              </article>
            ))
          )}
        </section>
      </div>
    </CandidateAppShell>
  );
}
