'use client';

import { FormEvent, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { CancelledInterviewCard } from '@/components/marketplace/CancelledInterviewCard';
import {
  WhatsAppInterviewNotice,
  type CandidateAvailabilityPayload,
} from '@/components/marketplace/WhatsAppInterviewNotice';
import {
  confirmScheduledInterview,
  fetchScheduledInterview,
  rescheduleScheduledInterview,
  submitScheduledInterviewFeedback,
} from '@/lib/candidate-marketplace-api';
import { mockInterviewSetupUrl } from '@/lib/mock-interview-url';
import { userFacingError } from '@/lib/client-errors';
import { ErrorState, SkeletonList } from '@/components/ui/StateViews';
import type { ScheduledJobInterview } from '@/lib/candidate-marketplace-api';

export default function ScheduledInterviewDetailPage() {
  return (
    <Suspense fallback={null}>
      <ScheduledInterviewDetail />
    </Suspense>
  );
}

function InterviewDetailsCard({ interview, children }: { interview: ScheduledJobInterview; children: ReactNode }) {
  if (interview.status === 'CANCELLED') {
    return <CancelledInterviewCard interview={interview}>{children}</CancelledInterviewCard>;
  }
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{children}</article>;
}

function ScheduledInterviewDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rescheduleMode =
    pathname.startsWith('/interviews/reschedule/') || searchParams.get('reschedule') === '1';
  const [interview, setInterview] = useState<ScheduledJobInterview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [rating, setRating] = useState(5);
  const [feedbackText, setFeedbackText] = useState('');

  const [loadError, setLoadError] = useState('');

  const load = useCallback(() => {
    setLoadError('');
    fetchScheduledInterview(params.id)
      .then(setInterview)
      .catch((err) => {
        if ((err as { status?: number }).status === 401) {
          router.replace(`/login?role=candidate&next=${encodeURIComponent(pathname)}`);
          return;
        }
        setLoadError(userFacingError(err, 'load this interview'));
      });
  }, [params.id, pathname, router]);

  useEffect(() => {
    load();
  }, [load]);

  // The candidate may confirm or reschedule on WhatsApp, or the employer may cancel, while this tab is in the background.
  useEffect(() => {
    let lastRefresh = Date.now();
    const onReturn = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastRefresh < 2000) return;
      lastRefresh = Date.now();
      load();
    };
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, [load]);

  async function handleConfirm() {
    if (!interview) return;
    setBusy(true);
    setError('');
    try {
      const next = await confirmScheduledInterview(interview.id);
      setInterview(next);
      setMessage('Interview confirmed. WhatsApp and email confirmation were sent when available.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm interview.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestReschedule() {
    if (!interview) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      setInterview(await rescheduleScheduledInterview(interview.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not request reschedule.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitAvailability(payload: CandidateAvailabilityPayload) {
    if (!interview) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      setInterview(await rescheduleScheduledInterview(interview.id, payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your availability.');
    } finally {
      setBusy(false);
    }
  }

  async function handleFeedback(event: FormEvent) {
    event.preventDefault();
    if (!interview) return;
    setBusy(true);
    setError('');
    try {
      const next = await submitScheduledInterviewFeedback(interview.id, {
        rating,
        text: feedbackText.trim() || undefined,
      });
      setInterview(next);
      setMessage('Thank you. Your feedback was shared with the employer.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit feedback.');
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <CandidateAppShell activeTab="interviews" maxWidth="max-w-3xl">
        <ErrorState message={loadError} onRetry={load} />
      </CandidateAppShell>
    );
  }

  if (!interview) {
    return (
      <CandidateAppShell activeTab="interviews">
        <SkeletonList rows={1} label="Loading interview details…" />
      </CandidateAppShell>
    );
  }

  const statusCopy =
    interview.status === 'CONFIRMED'
      ? 'Confirmed ✓'
      : interview.status === 'RESCHEDULE_NEEDED'
        ? 'Choose another time'
        : interview.status === 'RESCHEDULE_REQUESTED'
        ? 'Waiting for employer to schedule'
        : interview.status === 'COMPLETED'
          ? 'Completed'
          : interview.status === 'CANCELLED'
            ? 'Cancelled'
            : 'Awaiting confirmation';

  return (
    <CandidateAppShell activeTab="interviews" maxWidth="max-w-3xl">
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <Link href="/interviews" className="text-sm font-bold text-[#0a2e2c] hover:underline">
          ← My Interviews
        </Link>

        <InterviewDetailsCard interview={interview}>
          <h1 className="text-xl font-extrabold text-slate-900">{interview.jobTitle}</h1>
          <p className="mt-1 text-sm font-semibold text-slate-600">{interview.companyName}</p>
          <p className="mt-4 text-sm text-slate-700">
            {new Date(interview.scheduledDate).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <p className="text-sm font-bold text-slate-800">{interview.scheduledTime}</p>
          <dl className="mt-3 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="font-semibold text-slate-600">Type</dt>
            <dd className="text-slate-800">{interview.mode === 'VIDEO' ? 'Online (video)' : 'In-person'}</dd>
            {interview.durationMin ? (
              <>
                <dt className="font-semibold text-slate-600">Duration</dt>
                <dd className="text-slate-800">{interview.durationMin} minutes</dd>
              </>
            ) : null}
            <dt className="font-semibold text-slate-600">{interview.mode === 'VIDEO' ? 'Link' : 'Location'}</dt>
            <dd className="break-words text-slate-800">
              {interview.status === 'CANCELLED' && interview.mode === 'VIDEO' ? (
                '—'
              ) : interview.mode === 'VIDEO' && interview.meetingUrl ? (
                <a href={interview.meetingUrl} className="font-semibold text-[#0a2e2c] underline">
                  Join interview
                </a>
              ) : (
                interview.location
              )}
            </dd>
            <dt className="font-semibold text-slate-600">Interviewer</dt>
            <dd className="text-slate-800">{interview.companyName} hiring team</dd>
            <dt className="font-semibold text-slate-600">Notes</dt>
            <dd className="whitespace-pre-line break-words text-slate-800">
              {interview.candidateNotes || 'No notes from the employer.'}
            </dd>
          </dl>
          <p
            className={`mt-2 text-sm font-semibold ${
              interview.status === 'CONFIRMED'
                ? 'text-emerald-700'
                : interview.status === 'RESCHEDULE_REQUESTED' || interview.status === 'RESCHEDULE_NEEDED'
                  ? 'text-amber-700'
                  : interview.status === 'COMPLETED'
                    ? 'text-slate-700'
                    : 'text-slate-700'
            }`}
          >
            Status: {statusCopy}
          </p>

          {interview.status !== 'CANCELLED' ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={() => router.push(mockInterviewSetupUrl(interview.jobTitle))}>
                Prepare for Interview
              </Button>
            </div>
          ) : null}
        </InterviewDetailsCard>

        <WhatsAppInterviewNotice
          interview={interview}
          busy={busy}
          openAvailabilityForm={rescheduleMode}
          onConfirm={() => void handleConfirm()}
          onRequestReschedule={() => void handleRequestReschedule()}
          onSubmitAvailability={(payload) => void handleSubmitAvailability(payload)}
        />

        {interview.candidateFeedback ? (
          <article className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
            <h2 className="text-base font-extrabold text-slate-900">Your feedback</h2>
            <p className="mt-2 text-sm font-semibold text-slate-800">
              Rating: {interview.candidateFeedback.rating}/5
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {interview.candidateFeedback.text || 'No written comments.'}
            </p>
          </article>
        ) : interview.canSubmitFeedback ? (
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-extrabold text-slate-900">Share feedback</h2>
            <p className="mt-1 text-sm text-slate-600">
              Tell {interview.companyName} how the interview went. This is stored for that employer only.
            </p>
            <form onSubmit={(event) => void handleFeedback(event)} className="mt-4 space-y-4">
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-slate-800">Rating</legend>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                        rating === value
                          ? 'bg-[#0c332c] text-white'
                          : 'border border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </fieldset>
              <Textarea
                  label="Comments (optional)"
                  value={feedbackText}
                  onChange={(event) => setFeedbackText(event.target.value)}
                  rows={4}
                  maxLength={2000}
                  placeholder="What went well? What could improve?"
                />
              <Button type="submit" loading={busy} loadingLabel="Sending…">
                Submit feedback
              </Button>
            </form>
          </article>
        ) : null}

        {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
      </div>
    </CandidateAppShell>
  );
}
