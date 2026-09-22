'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { InterviewBotFace } from '@/components/interviews/InterviewBotFace';
import { Button } from '@/components/ui/Button';
import { WhatsAppInterviewNotice } from '@/components/marketplace/WhatsAppInterviewNotice';
import {
  confirmScheduledInterview,
  fetchScheduledInterviews,
  rescheduleScheduledInterview,
} from '@/lib/candidate-marketplace-api';
import { mockInterviewSetupUrl } from '@/lib/mock-interview-url';
import type { ScheduledJobInterview } from '@/lib/candidate-marketplace-api';

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

  async function handleReschedule(
    id: string,
    payload: { preferredDate: string; preferredTime: string; reason?: string },
  ) {
    setBusyId(id);
    setMessage('');
    try {
      await rescheduleScheduledInterview(id, payload);
      setUpcoming(await fetchScheduledInterviews());
      setMessage('Reschedule request sent. Waiting for employer approval.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not request reschedule right now.');
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
                <p className={`mt-2 text-sm font-semibold ${
                  interview.status === 'CONFIRMED'
                    ? 'text-emerald-700'
                    : interview.status === 'RESCHEDULE_REQUESTED'
                      ? 'text-amber-700'
                      : 'text-slate-700'
                }`}>
                  Status:{' '}
                  {interview.status === 'CONFIRMED'
                    ? 'Confirmed ✓'
                    : interview.status === 'RESCHEDULE_REQUESTED'
                      ? 'Reschedule pending'
                      : 'Awaiting confirmation'}
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
                    onReschedule={(payload) => void handleReschedule(interview.id, payload)}
                  />
                </div>
              </article>
            ))}
        </section>

        {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}

        <section
          className="overflow-hidden rounded-[22px] border border-[#d7eef6] p-4 shadow-[0_10px_28px_rgba(47,143,173,0.10)] sm:p-5"
          style={{
            background:
              'radial-gradient(ellipse 70% 80% at 12% 50%, rgba(159, 217, 236, 0.45), transparent 55%), linear-gradient(135deg, #f4fbfd 0%, #ffffff 48%, #f7faf9 100%)',
          }}
        >
          <div className="flex items-center gap-4 sm:gap-5">
            <InterviewBotFace size="lg" className="shrink-0" />

            <div className="relative min-w-0 flex-1 rounded-2xl border border-[#d7eef6] bg-white px-4 pb-4 pt-5 shadow-[0_6px_18px_rgba(47,143,173,0.10)]">
              <span className="absolute left-4 top-0 -translate-y-1/2 drop-shadow-sm" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="6.5" r="3.2" fill="#5bb8d4" stroke="#2f8fad" strokeWidth="1.2" />
                  <path d="M12 9.5v8.5" stroke="#2f8fad" strokeWidth="2" strokeLinecap="round" />
                  <path
                    d="M9.2 12.2h5.6l-.7 3.6H9.9l-.7-3.6Z"
                    fill="#7ec8e3"
                    stroke="#2f8fad"
                    strokeWidth="1.1"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <h2 className="text-base font-extrabold text-[#0a2e2c]">AI Mock Interview</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[#35565f]">
                Practise common and role-specific questions before your real interview.
              </p>
              <div className="mt-3 flex justify-center">
                <Button
                  type="button"
                  size="md"
                  block={false}
                  className="!bg-[#0a2e2c] px-4 text-white hover:!bg-[#0a2e2c]/90 sm:px-5"
                  onClick={() => router.push('/interviews/mock')}
                >
                  Start Mock Interview
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </CandidateAppShell>
  );
}
