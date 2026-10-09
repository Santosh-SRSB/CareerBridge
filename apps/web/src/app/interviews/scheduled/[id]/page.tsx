'use client';

import { FormEvent, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CandidateAppShell } from '@/components/CandidateAppShell';
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
import '../../candidate-interviews.css';

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
  return <article className="iv-card iv-up">{children}</article>;
}

function statusPillClass(status: ScheduledJobInterview['status']) {
  if (status === 'CONFIRMED') return 'iv-pill iv-pill--ok';
  if (status === 'RESCHEDULE_REQUESTED' || status === 'RESCHEDULE_NEEDED') return 'iv-pill iv-pill--warn';
  if (status === 'CANCELLED') return 'iv-pill iv-pill--bad';
  if (status === 'COMPLETED') return 'iv-pill';
  return 'iv-pill iv-pill--muted';
}

function BackGlyph() {
  return (
    <svg className="iv-ic" viewBox="0 0 24 24" aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function CalendarGlyph() {
  return (
    <svg className="iv-ic" viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}

function ClockGlyph() {
  return (
    <svg className="iv-ic" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
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
      <div className="iv iv-detail">
        <Link href="/interviews" className="iv-back">
          <BackGlyph />
          My Interviews
        </Link>

        <InterviewDetailsCard interview={interview}>
          <div className="iv-up-top">
            <div className="min-w-0">
              <h1 className="iv-title">{interview.jobTitle}</h1>
              <p className="iv-co">{interview.companyName}</p>
            </div>
            <p className="iv-status">
              <span className="iv-status-k">Status:</span>{' '}
              <span className={statusPillClass(interview.status)}>{statusCopy}</span>
            </p>
          </div>

          <ul className="iv-facts">
            <li>
              <CalendarGlyph />
              {new Date(interview.scheduledDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </li>
            <li>
              <ClockGlyph />
              <b>{interview.scheduledTime}</b>
            </li>
          </ul>

          <dl className="iv-dl">
            <dt>Type</dt>
            <dd>{interview.mode === 'VIDEO' ? 'Online (video)' : 'In-person'}</dd>
            {interview.durationMin ? (
              <>
                <dt>Duration</dt>
                <dd>{interview.durationMin} minutes</dd>
              </>
            ) : null}
            <dt>{interview.mode === 'VIDEO' ? 'Link' : 'Location'}</dt>
            <dd>
              {interview.status === 'CANCELLED' && interview.mode === 'VIDEO' ? (
                '—'
              ) : interview.mode === 'VIDEO' && interview.meetingUrl ? (
                <a href={interview.meetingUrl} className="iv-inline-link">
                  Join interview
                </a>
              ) : (
                interview.location
              )}
            </dd>
            <dt>Interviewer</dt>
            <dd>{interview.companyName} hiring team</dd>
            <dt>Notes</dt>
            <dd className="iv-dl-notes">{interview.candidateNotes || 'No notes from the employer.'}</dd>
          </dl>

          {interview.status !== 'CANCELLED' ? (
            <div className="iv-actions">
              <button
                type="button"
                className="iv-btn"
                onClick={() => router.push(mockInterviewSetupUrl(interview.jobTitle))}
              >
                Prepare for Interview
              </button>
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
          <article className="iv-card iv-fb iv-fb--done">
            <h2 className="iv-fb-t">Your feedback</h2>
            <p className="iv-fb-rating">Rating: {interview.candidateFeedback.rating}/5</p>
            <p className="iv-meta">{interview.candidateFeedback.text || 'No written comments.'}</p>
          </article>
        ) : interview.canSubmitFeedback ? (
          <article className="iv-card iv-fb">
            <h2 className="iv-fb-t">Share feedback</h2>
            <p className="iv-meta">
              Tell {interview.companyName} how the interview went. This is stored for that employer only.
            </p>
            <form onSubmit={(event) => void handleFeedback(event)} className="iv-fb-form">
              <fieldset className="iv-rate">
                <legend className="iv-lbl">Rating</legend>
                <div className="iv-rate-row">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={rating === value}
                      onClick={() => setRating(value)}
                      className="iv-rate-btn"
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
              <button type="submit" className="iv-btn iv-fb-submit" disabled={busy} aria-busy={busy || undefined}>
                {busy ? (
                  <>
                    <span aria-hidden data-testid="button-spinner" className="iv-spin" />
                    Sending…
                  </>
                ) : (
                  'Submit feedback'
                )}
              </button>
            </form>
          </article>
        ) : null}

        {message ? (
          <p className="iv-msg" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="iv-err" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </CandidateAppShell>
  );
}
