'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { EmployerInterviewRecord } from '@careerbridge/shared';
import {
  employerInterviewAction,
  listEmployerInterviews,
  requestEmployerInterviewFeedback,
} from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { Button } from '@/components/ui/Button';

type FilterTab = 'all' | 'upcoming' | 'completed';

function candidateName(row: EmployerInterviewRecord) {
  const raw = [row.candidate.firstName, row.candidate.lastName].filter(Boolean).join(' ').trim();
  if (!raw) return 'Candidate';
  return raw
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatMode(mode: string) {
  const label = mode.replaceAll('_', ' ').toLowerCase();
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function statusLabel(status: string) {
  if (status === 'RESCHEDULE_REQUESTED') return 'Reschedule requested';
  if (status === 'SCHEDULED' || status === 'PROPOSED') return 'Scheduled';
  return status.charAt(0) + status.slice(1).toLowerCase().replaceAll('_', ' ');
}

function statusTone(status: string) {
  if (status === 'CONFIRMED') return 'ok';
  if (status === 'COMPLETED') return 'done';
  if (status === 'CANCELLED') return 'off';
  if (status === 'RESCHEDULE_REQUESTED') return 'warn';
  return 'default';
}

function isUpcoming(status: string) {
  return !['COMPLETED', 'CANCELLED'].includes(status);
}

function isCompletedTab(status: string) {
  return status === 'COMPLETED' || status === 'CANCELLED';
}

function canRequestFeedback(row: EmployerInterviewRecord) {
  return ['CONFIRMED', 'COMPLETED'].includes(row.status) && !row.candidateFeedback;
}

export default function EmployerInterviewsPage() {
  const [items, setItems] = useState<EmployerInterviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [feedbackRow, setFeedbackRow] = useState<EmployerInterviewRecord | null>(null);

  async function load() {
    setError('');
    const rows = await listEmployerInterviews();
    setItems(rows);
  }

  useEffect(() => {
    void load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load interviews.'))
      .finally(() => setLoading(false));
  }, []);

  const upcomingCount = useMemo(() => items.filter((item) => isUpcoming(item.status)).length, [items]);
  const completedCount = useMemo(() => items.filter((item) => isCompletedTab(item.status)).length, [items]);

  const visible = useMemo(() => {
    if (filter === 'upcoming') return items.filter((item) => isUpcoming(item.status));
    if (filter === 'completed') return items.filter((item) => isCompletedTab(item.status));
    return items;
  }, [items, filter]);

  async function act(
    id: string,
    action: 'confirm' | 'complete' | 'cancel',
    payload?: { scheduledAt?: string },
  ) {
    if (action === 'cancel' && !window.confirm('Cancel this interview?')) return;
    setBusyId(id);
    setError('');
    try {
      await employerInterviewAction(id, action, payload);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusyId('');
    }
  }

  async function requestFeedback(id: string) {
    setBusyId(`fb-${id}`);
    setError('');
    setMessage('');
    try {
      const updated = await requestEmployerInterviewFeedback(id);
      setItems((prev) => prev.map((row) => (row.id === id ? updated : row)));
      setFeedbackRow(updated);
      setMessage('Feedback request sent to the candidate.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not request feedback.');
    } finally {
      setBusyId('');
    }
  }

  const tabs: Array<{ id: FilterTab; label: string; count: number }> = [
    { id: 'all', label: 'All', count: items.length },
    { id: 'upcoming', label: 'Upcoming', count: upcomingCount },
    { id: 'completed', label: 'Completed', count: completedCount },
  ];

  return (
    <EmployerShellFallback title="Interviews">
      <div className="ep-ivdesk ep-page ep-page--interviews">
        <header className="ep-ivdesk__head">
          <div className="ep-ivdesk__head-copy">
            <p className="ep-ivdesk__eyebrow">Scheduling</p>
            <h1 className="ep-ivdesk__title">Interviews</h1>
            <p className="ep-ivdesk__sub">Every scheduled conversation, in one operating table.</p>
          </div>
          <Link href="/employer/interviews/schedule" className="ep-ivdesk__cta">
            Schedule interview
          </Link>
        </header>

        {error ? <p className="ep-ivdesk__alert">{error}</p> : null}
        {message ? <p className="ep-ivdesk__alert ep-ivdesk__alert--ok">{message}</p> : null}

        {!loading && items.length > 0 ? (
          <div className="ep-ivdesk__tabs" role="tablist" aria-label="Interview filters">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={filter === tab.id}
                className={`ep-ivdesk__tab ${filter === tab.id ? 'is-active' : ''}`}
                onClick={() => setFilter(tab.id)}
              >
                {tab.label} · {tab.count}
              </button>
            ))}
          </div>
        ) : null}

        {loading ? <p className="ep-ivdesk__muted">Loading interviews…</p> : null}

        {!loading && items.length === 0 ? (
          <section className="ep-ivdesk__empty">
            <h2>No interviews yet</h2>
            <p>Shortlist an applicant, then book a time. Candidates get notified with the details.</p>
            <Link href="/employer/interviews/schedule" className="ep-ivdesk__cta">
              Schedule interview
            </Link>
          </section>
        ) : null}

        {!loading && items.length > 0 && visible.length === 0 ? (
          <section className="ep-ivdesk__empty">
            <h2>No {filter} interviews</h2>
            <p>Switch filters to see other conversations.</p>
          </section>
        ) : null}

        {!loading && visible.length > 0 ? (
          <div className="ep-ivdesk__table-wrap">
            <table className="ep-ivdesk__table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Role</th>
                  <th>When</th>
                  <th>Format</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const upcoming = isUpcoming(item.status);
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="ep-ivdesk__who">
                          <strong>{candidateName(item)}</strong>
                          <span>{item.job.title}</span>
                        </div>
                      </td>
                      <td>
                        <span className="ep-ivdesk__cell">{item.job.title}</span>
                      </td>
                      <td>
                        <span className="ep-ivdesk__cell">{formatWhen(item.scheduledAt)}</span>
                      </td>
                      <td>
                        <span className="ep-ivdesk__cell">
                          {formatMode(item.mode)} · {item.durationMin} min
                        </span>
                      </td>
                      <td>
                        <span className={`ep-ivdesk__status ep-ivdesk__status--${statusTone(item.status)}`}>
                          <i aria-hidden />
                          {statusLabel(item.status)}
                          {item.candidateFeedback ? ' · Feedback' : null}
                        </span>
                      </td>
                      <td>
                        <div className="ep-ivdesk__actions">
                          <Link
                            href={`/employer/candidates/${item.candidateId}?jobId=${encodeURIComponent(item.jobId)}`}
                            className="ep-ivdesk__btn ep-ivdesk__btn--ghost"
                          >
                            Profile
                          </Link>
                          <Button
                            type="button"
                            size="sm"
                            block={false}
                            className="ep-ivdesk__btn ep-ivdesk__btn--ghost"
                            onClick={() => {
                              setMessage('');
                              setFeedbackRow(item);
                            }}
                          >
                            Feedback
                          </Button>
                          {upcoming && item.status === 'RESCHEDULE_REQUESTED' ? (
                            <Button
                              type="button"
                              size="sm"
                              block={false}
                              className="ep-ivdesk__btn ep-ivdesk__btn--solid"
                              loading={busyId === item.id}
                              onClick={() =>
                                void act(item.id, 'confirm', {
                                  scheduledAt: item.preferredRescheduleAt || undefined,
                                })
                              }
                            >
                              Approve
                            </Button>
                          ) : null}
                          {upcoming && (item.status === 'SCHEDULED' || item.status === 'PROPOSED') ? (
                            <Button
                              type="button"
                              size="sm"
                              block={false}
                              className="ep-ivdesk__btn ep-ivdesk__btn--solid"
                              loading={busyId === item.id}
                              onClick={() => void act(item.id, 'confirm')}
                            >
                              Confirm
                            </Button>
                          ) : null}
                          {upcoming && item.status === 'CONFIRMED' ? (
                            <Button
                              type="button"
                              size="sm"
                              block={false}
                              className="ep-ivdesk__btn ep-ivdesk__btn--solid"
                              loading={busyId === item.id}
                              onClick={() => void act(item.id, 'complete')}
                            >
                              Mark done
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {feedbackRow ? (
          <div
            className="ep-ivdesk__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ep-feedback-title"
          >
            <button
              type="button"
              className="ep-ivdesk__modal-backdrop"
              aria-label="Close feedback"
              onClick={() => setFeedbackRow(null)}
            />
            <div className="ep-ivdesk__modal-card">
              <header className="ep-ivdesk__modal-head">
                <div>
                  <p className="ep-ivdesk__eyebrow">Candidate feedback</p>
                  <h2 id="ep-feedback-title">{candidateName(feedbackRow)}</h2>
                  <p>{feedbackRow.job.title}</p>
                </div>
                <button type="button" className="ep-ivdesk__modal-close" onClick={() => setFeedbackRow(null)}>
                  ×
                </button>
              </header>

              {feedbackRow.candidateFeedback ? (
                <div className="ep-ivdesk__feedback">
                  <p className="ep-ivdesk__feedback-rating">
                    Rating: <strong>{feedbackRow.candidateFeedback.rating}/5</strong>
                  </p>
                  <p className="ep-ivdesk__feedback-text">
                    {feedbackRow.candidateFeedback.text || 'No written comments.'}
                  </p>
                  <p className="ep-ivdesk__muted">
                    Submitted{' '}
                    {new Date(feedbackRow.candidateFeedback.submittedAt).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              ) : (
                <div className="ep-ivdesk__feedback">
                  <p>
                    {feedbackRow.feedbackRequestedAt
                      ? 'Waiting for the candidate to share feedback.'
                      : 'No feedback yet for this interview.'}
                  </p>
                  {canRequestFeedback(feedbackRow) ? (
                    <Button
                      type="button"
                      size="sm"
                      block={false}
                      className="ep-ivdesk__btn ep-ivdesk__btn--solid"
                      loading={busyId === `fb-${feedbackRow.id}`}
                      onClick={() => void requestFeedback(feedbackRow.id)}
                    >
                      {feedbackRow.feedbackRequestedAt ? 'Send reminder' : 'Request feedback'}
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </EmployerShellFallback>
  );
}
