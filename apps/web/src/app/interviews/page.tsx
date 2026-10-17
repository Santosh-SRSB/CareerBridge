'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { InterviewBotFace } from '@/components/interviews/InterviewBotFace';
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
import './candidate-interviews.css';

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

type PillTone = 'ok' | 'warn' | 'bad' | 'info' | 'muted';

function pillClass(tone: PillTone) {
  return tone === 'info' ? 'iv-pill' : `iv-pill iv-pill--${tone}`;
}

function interviewStatusBadge(item: ScheduledJobInterview): { label: string; tone: PillTone } {
  if (item.status === 'CONFIRMED') return { label: 'Confirmed ✓', tone: 'ok' };
  if (item.status === 'RESCHEDULE_NEEDED') return { label: 'Choose another time', tone: 'warn' };
  if (item.status === 'RESCHEDULE_REQUESTED') {
    return { label: 'Waiting for employer to schedule', tone: 'warn' };
  }
  if (item.status === 'COMPLETED') return { label: 'Completed', tone: 'info' };
  if (item.status === 'CANCELLED') return { label: 'Cancelled', tone: 'bad' };
  return { label: 'Awaiting confirmation', tone: 'muted' };
}

function outcomeBadge(outcome: ScheduledJobInterview['outcome']): { label: string; tone: PillTone } | null {
  if (outcome === 'SELECTED') return { label: 'Selected', tone: 'ok' };
  if (outcome === 'NOT_SELECTED') return { label: 'Not selected', tone: 'bad' };
  if (outcome === 'ON_HOLD') return { label: 'On hold', tone: 'warn' };
  if (outcome === 'WITHDRAWN') return { label: 'Withdrawn', tone: 'muted' };
  return null;
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

function ModeGlyph({ video }: { video: boolean }) {
  return video ? (
    <svg className="iv-ic" viewBox="0 0 24 24" aria-hidden>
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="m16 10 6-3v10l-6-3" />
    </svg>
  ) : (
    <svg className="iv-ic" viewBox="0 0 24 24" aria-hidden>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
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
    <CandidateAppShell activeTab="interviews" maxWidth="max-w-5xl">
      <div className="iv">
        <h1 className="iv-h1">My Interviews</h1>
        <p className="iv-sub">Upcoming employer interviews and mock practice in one place.</p>

        <section className="iv-sec" aria-labelledby="upcoming-interviews">
          <h2 id="upcoming-interviews" className="iv-sec-t">
            Upcoming
          </h2>
          {scheduled === null && !loadError ? (
            <SkeletonList rows={2} label="Loading interviews…" />
          ) : null}
          {loadError ? <ErrorState message={loadError} onRetry={() => void loadScheduled()} /> : null}
          {scheduled !== null && !loadError && upcoming.length === 0 ? (
            <div className="iv-card" role="status">
              <p className="iv-empty">
                No upcoming interviews scheduled yet. When an employer schedules an interview with you it
                will appear here.
              </p>
            </div>
          ) : null}
          {upcoming.map((interview) => {
            const badge = interviewStatusBadge(interview);
            return (
              <article key={interview.id} className="iv-card iv-up">
                <div className="iv-up-top">
                  <div className="min-w-0">
                    <h3 className="iv-title">{interview.jobTitle}</h3>
                    <p className="iv-co">{interview.companyName}</p>
                  </div>
                  <p className="iv-meta">
                    <span className="sr-only">Status: </span>
                    <span className={pillClass(badge.tone)}>{badge.label}</span>
                  </p>
                </div>

                <ul className="iv-facts">
                  <li>
                    <CalendarGlyph />
                    {formatInterviewDate(interview.scheduledDate)}
                  </li>
                  <li>
                    <ClockGlyph />
                    <b>{interview.scheduledTime}</b>
                  </li>
                  <li data-testid="interview-type-duration">
                    <ModeGlyph video={interview.mode === 'VIDEO'} />
                    {interview.mode === 'VIDEO' ? 'Online (video)' : 'In-person'}
                    {interview.durationMin ? ` · ${interview.durationMin} min` : ''}
                  </li>
                </ul>

                <div className="iv-actions">
                  <Link href={`/interviews/scheduled/${interview.id}`} className="iv-btn iv-btn--ghost">
                    View Details
                  </Link>
                  <button
                    type="button"
                    className="iv-btn"
                    onClick={() => router.push(mockInterviewSetupUrl(interview.jobTitle))}
                  >
                    Prepare for Interview
                  </button>
                </div>
                <WhatsAppInterviewNotice
                  interview={interview}
                  busy={busyId === interview.id}
                  onConfirm={() => void handleConfirm(interview.id)}
                  onRequestReschedule={() => void handleReschedule(interview.id)}
                  onSubmitAvailability={(payload) => void handleReschedule(interview.id, payload)}
                />
              </article>
            );
          })}
        </section>

        <section className="iv-cta" aria-labelledby="mock-interview-cta">
          <InterviewBotFace size="lg" />
          <div className="iv-cta-body">
            <h2 id="mock-interview-cta" className="iv-cta-title">
              AI Mock Interview
            </h2>
            <p className="iv-cta-text">Practise common and role-specific questions before your real interview.</p>
            <button type="button" className="iv-btn" onClick={() => router.push('/interviews/mock')}>
              Start Mock Interview
            </button>
          </div>
        </section>

        {scheduled !== null && !loadError ? (
          <section className="iv-sec" aria-labelledby="interview-history">
            <h2 id="interview-history" className="iv-sec-t">
              Interview history
            </h2>
            {history.length === 0 ? (
              <div className="iv-card" role="status">
                <p className="iv-empty">
                  No past employer interviews yet. Completed interviews will appear here with their outcome.
                </p>
              </div>
            ) : null}
            {history.map((item) => {
              const badge = interviewStatusBadge(item);
              const outcome = outcomeBadge(item.outcome);
              const feedback = item.candidateFeedback
                ? `Your feedback: ${item.candidateFeedback.rating}/5${
                    item.candidateFeedback.text ? ` — ${item.candidateFeedback.text}` : ''
                  }`
                : item.canSubmitFeedback
                  ? 'You have not shared feedback on this interview yet.'
                  : '';
              return (
                <article key={item.id} className="iv-card iv-hist">
                  <div className="iv-hist-top">
                    <div className="min-w-0">
                      <h3 className="iv-hist-title">{item.jobTitle}</h3>
                      <p className="iv-co">{item.companyName}</p>
                      <p className="iv-meta">
                        {formatInterviewDate(item.scheduledDate)} · {item.scheduledTime}
                      </p>
                    </div>
                    <div className="iv-pills">
                      <span className={pillClass(badge.tone)}>{badge.label}</span>
                      {outcome ? (
                        <span className={pillClass(outcome.tone)}>Outcome: {outcome.label}</span>
                      ) : null}
                    </div>
                  </div>
                  {feedback ? <p className="iv-meta">{feedback}</p> : null}
                  <Link href={`/interviews/scheduled/${item.id}`} className="iv-link">
                    View details →
                  </Link>
                </article>
              );
            })}
          </section>
        ) : null}

        <section className="iv-sec" aria-labelledby="completed-interviews">
          <div className="iv-sec-h">
            <h2 id="completed-interviews" className="iv-sec-t">
              Completed practice interviews
            </h2>
            <button
              type="button"
              className="iv-link"
              onClick={() => void loadCompleted()}
              disabled={completedLoading}
            >
              {completedLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          {completedError ? (
            <div className="iv-card iv-empty iv-empty--warn">{completedError}</div>
          ) : null}
          {!completedError && completed === null ? (
            <div className="iv-card">
              <p className="iv-empty">Loading completed interviews…</p>
            </div>
          ) : null}
          {!completedError && completed?.length === 0 ? (
            <div className="iv-card">
              <p className="iv-empty">
                No completed practice interviews yet. Finish a mock interview to see its report here.
              </p>
            </div>
          ) : null}
          {(completed || []).map((item) => {
            const score = completedScore(item);
            const endedAt = item.endAt || item.startAt;
            return (
              <Link key={item.id} href={completedHref(item)} className="iv-card iv-done">
                <div className="min-w-0">
                  <p className="iv-done-role">{item.jobRole}</p>
                  <p className="iv-meta">
                    {endedAt ? formatInterviewDate(endedAt) : 'Date unavailable'}
                    {item.report ? ` · ${item.report.answeredCount}/${item.report.totalPlanned} answered` : ''}
                  </p>
                </div>
                <div className="shrink-0">
                  <p className="iv-done-score">{score != null ? `${score}/100` : '—'}</p>
                  <p className="iv-done-cta">View report →</p>
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    </CandidateAppShell>
  );
}
