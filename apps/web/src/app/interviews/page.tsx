'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { InterviewBotFace } from '@/components/interviews/InterviewBotFace';
import { Button } from '@/components/ui/Button';
import {
  WhatsAppInterviewNotice,
  type CandidateAvailabilityPayload,
} from '@/components/marketplace/WhatsAppInterviewNotice';
import {
  candidateInterviewSections,
  confirmScheduledInterview,
  fetchScheduledInterviews,
  rescheduleScheduledInterview,
} from '@/lib/candidate-marketplace-api';
import { ErrorState, SkeletonList } from '@/components/ui/StateViews';
import { toast } from '@/components/ui/Toast';
import { LOAD_ERROR_MESSAGE, userFacingError } from '@/lib/client-errors';
import { mockInterviewSetupUrl } from '@/lib/mock-interview-url';
import type { ScheduledJobInterview } from '@/lib/candidate-marketplace-api';
import type { InterviewSession } from '@careerbridge/shared';
import { listInterviews } from '@/lib/api';

function completedHref(item: InterviewSession) {
  return item.mode === 'LIVE_AI' ? `/interviews/${item.id}/report` : `/interviews/${item.id}/feedback`;
}

function completedScore(item: InterviewSession) {
  return item.report?.overallScore ?? item.score ?? null;
}

function formatInterviewDate(value: string) {
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function interviewStatusBadge(item: ScheduledJobInterview) {
  if (item.status === 'CONFIRMED') return { label: 'Confirmed ✓', tone: 'bg-emerald-100 text-emerald-800' };
  if (item.status === 'RESCHEDULE_NEEDED') return { label: 'Choose another time', tone: 'bg-amber-100 text-amber-900' };
  if (item.status === 'RESCHEDULE_REQUESTED') {
    return { label: 'Waiting for employer to schedule', tone: 'bg-amber-100 text-amber-900' };
  }
  if (item.status === 'COMPLETED') return { label: 'Completed', tone: 'bg-violet-100 text-violet-800' };
  if (item.status === 'CANCELLED') return { label: 'Cancelled', tone: 'bg-red-100 text-red-800' };
  return { label: 'Awaiting confirmation', tone: 'bg-slate-200 text-slate-800' };
}

function outcomeBadge(outcome: ScheduledJobInterview['outcome']) {
  if (outcome === 'SELECTED') return { label: 'Selected', tone: 'bg-emerald-100 text-emerald-800' };
  if (outcome === 'NOT_SELECTED') return { label: 'Not selected', tone: 'bg-red-100 text-red-800' };
  if (outcome === 'ON_HOLD') return { label: 'On hold', tone: 'bg-amber-100 text-amber-900' };
  if (outcome === 'WITHDRAWN') return { label: 'Withdrawn', tone: 'bg-slate-200 text-slate-800' };
  return null;
}

export default function InterviewsHubPage() {
  const router = useRouter();
  const [scheduled, setScheduled] = useState<ScheduledJobInterview[] | null>(null);
  const [busyId, setBusyId] = useState('');
  const [loadError, setLoadError] = useState('');
  const [completed, setCompleted] = useState<InterviewSession[] | null>(null);
  const [completedError, setCompletedError] = useState('');
  const [completedLoading, setCompletedLoading] = useState(false);

  const loadScheduled = useCallback(async () => {
    setLoadError('');
    setScheduled(null);
    try {
      setScheduled(await fetchScheduledInterviews());
    } catch {
      setLoadError(LOAD_ERROR_MESSAGE);
    }
  }, []);

  useEffect(() => {
    void loadScheduled();
  }, [loadScheduled]);

  const { upcoming, history } = candidateInterviewSections(scheduled || []);

  const loadCompleted = useCallback(async () => {
    setCompletedLoading(true);
    setCompletedError('');
    try {
      const rows = await listInterviews();
      setCompleted(rows.filter((item) => item.status === 'COMPLETED'));
    } catch {
      setCompletedError(LOAD_ERROR_MESSAGE);
    } finally {
      setCompletedLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCompleted();
  }, [loadCompleted]);

  const refreshScheduled = useCallback(async () => {
    try {
      setScheduled(await fetchScheduledInterviews());
      setLoadError('');
    } catch {
      /* the list keeps its previous state */
    }
  }, []);

  // Confirm / Reschedule / Cancel can happen on WhatsApp or by the employer while this tab is in the background.
  useEffect(() => {
    let lastRefresh = Date.now();
    const onReturn = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastRefresh < 2000) return;
      lastRefresh = Date.now();
      void refreshScheduled();
    };
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, [refreshScheduled]);

  async function handleConfirm(id: string) {
    setBusyId(id);
    try {
      await confirmScheduledInterview(id);
      toast.success('Interview confirmed successfully.');
      await refreshScheduled();
    } catch (err) {
      toast.error(userFacingError(err, 'confirm interview'));
    } finally {
      setBusyId('');
    }
  }

  async function handleReschedule(id: string, payload?: CandidateAvailabilityPayload) {
    setBusyId(id);
    try {
      await rescheduleScheduledInterview(id, payload);
      if (payload) toast.success('Your new availability has been sent to the employer.');
      await refreshScheduled();
    } catch (err) {
      toast.error(userFacingError(err, 'request reschedule'));
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

        <section className="space-y-3" aria-labelledby="upcoming-interviews">
          <h2 id="upcoming-interviews" className="text-xs font-bold uppercase tracking-wide text-slate-600">
            Upcoming
          </h2>
          {scheduled === null && !loadError ? (
            <SkeletonList rows={2} label="Loading interviews…" />
          ) : null}
          {loadError ? <ErrorState message={loadError} onRetry={() => void loadScheduled()} /> : null}
          {scheduled !== null && !loadError && upcoming.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700" role="status">
              No upcoming interviews scheduled yet. When an employer schedules an interview with you it
              will appear here.
            </div>
          ) : null}
          {upcoming.map((interview) => {
            const badge = interviewStatusBadge(interview);
            return (
              <article key={interview.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-extrabold text-slate-900">{interview.jobTitle}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-700">{interview.companyName}</p>
                <p className="mt-3 text-sm text-slate-700">{formatInterviewDate(interview.scheduledDate)}</p>
                <p className="text-sm font-bold text-slate-800">{interview.scheduledTime}</p>
                <p className="mt-1 text-sm text-slate-700" data-testid="interview-type-duration">
                  {interview.mode === 'VIDEO' ? 'Online (video)' : 'In-person'}
                  {interview.durationMin ? ` · ${interview.durationMin} min` : ''}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-800">
                  Status:{' '}
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.tone}`}>{badge.label}</span>
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
                    onRequestReschedule={() => void handleReschedule(interview.id)}
                    onSubmitAvailability={(payload) => void handleReschedule(interview.id, payload)}
                  />
                </div>
              </article>
            );
          })}
        </section>

        {scheduled !== null && !loadError ? (
          <section className="space-y-3" aria-labelledby="interview-history">
            <h2 id="interview-history" className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Interview history
            </h2>
            {history.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700" role="status">
                No past employer interviews yet. Completed interviews will appear here with their outcome.
              </div>
            ) : null}
            {history.map((item) => {
              const badge = interviewStatusBadge(item);
              const outcome = outcomeBadge(item.outcome);
              return (
                <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-extrabold text-slate-900">{item.jobTitle}</h3>
                      <p className="text-sm text-slate-700">{item.companyName}</p>
                      <p className="mt-1 text-xs text-slate-700">
                        {formatInterviewDate(item.scheduledDate)} · {item.scheduledTime}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.tone}`}>{badge.label}</span>
                      {outcome ? (
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${outcome.tone}`}>
                          Outcome: {outcome.label}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-700">
                    {item.candidateFeedback
                      ? `Your feedback: ${item.candidateFeedback.rating}/5${
                          item.candidateFeedback.text ? ` — ${item.candidateFeedback.text}` : ''
                        }`
                      : item.canSubmitFeedback
                        ? 'You have not shared feedback on this interview yet.'
                        : ''}
                  </p>
                  <Link
                    href={`/interviews/scheduled/${item.id}`}
                    className="mt-2 inline-flex min-h-12 items-center text-sm font-bold text-teal hover:underline"
                  >
                    View details →
                  </Link>
                </article>
              );
            })}
          </section>
        ) : null}

        <section className="space-y-3" aria-labelledby="completed-interviews">
          <div className="flex items-center justify-between gap-3">
            <p id="completed-interviews" className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Completed practice interviews
            </p>
            <button
              type="button"
              className="text-xs font-bold text-teal hover:underline disabled:opacity-50"
              onClick={() => void loadCompleted()}
              disabled={completedLoading}
            >
              {completedLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          {completedError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              {completedError}
            </div>
          ) : null}
          {!completedError && completed === null ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              Loading completed interviews…
            </div>
          ) : null}
          {!completedError && completed?.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              No completed practice interviews yet. Finish a mock interview to see its report here.
            </div>
          ) : null}
          {(completed || []).map((item) => {
            const score = completedScore(item);
            const endedAt = item.endAt || item.startAt;
            return (
              <Link
                key={item.id}
                href={completedHref(item)}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-teal"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-slate-900">{item.jobRole}</p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {endedAt ? formatInterviewDate(endedAt) : 'Date unavailable'}
                    {item.report ? ` · ${item.report.answeredCount}/${item.report.totalPlanned} answered` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-extrabold text-slate-900">{score != null ? `${score}/100` : '—'}</p>
                  <p className="text-xs font-bold text-teal">View report →</p>
                </div>
              </Link>
            );
          })}
        </section>

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
