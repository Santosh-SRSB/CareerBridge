'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { EmployerInterviewRecord } from '@careerbridge/shared';
import {
  changeApplicationStatus,
  employerInterviewAction,
  listEmployerInterviews,
  recordHiringOutcome,
  requestEmployerInterviewFeedback,
} from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { Button } from '@/components/ui/Button';

type FilterTab = 'all' | 'upcoming' | 'completed';
type OutcomeChoice = 'SELECTED' | 'REJECTED' | 'FURTHER' | 'ON_HOLD';

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

function toLocalInputValue(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
  const [detailRow, setDetailRow] = useState<EmployerInterviewRecord | null>(null);
  const [rescheduleRow, setRescheduleRow] = useState<EmployerInterviewRecord | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState('');
  const [outcomeRow, setOutcomeRow] = useState<EmployerInterviewRecord | null>(null);
  const [outcome, setOutcome] = useState<OutcomeChoice>('SELECTED');
  const [outcomeNotes, setOutcomeNotes] = useState('');

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
    action: 'confirm' | 'complete' | 'cancel' | 'reschedule' | 'notes',
    payload?: { scheduledAt?: string; notes?: string },
  ) {
    if (action === 'cancel' && !window.confirm('Cancel this interview? The candidate will be notified.')) {
      return;
    }
    setBusyId(id);
    setError('');
    try {
      await employerInterviewAction(id, action, payload);
      await load();
      setMessage(
        action === 'reschedule'
          ? 'Interview rescheduled. Candidate will confirm the new time.'
          : action === 'cancel'
            ? 'Interview cancelled.'
            : action === 'complete'
              ? 'Interview marked complete.'
              : 'Interview updated.',
      );
      setRescheduleRow(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusyId('');
    }
  }

  async function saveOutcome() {
    if (!outcomeRow) return;
    setBusyId(`outcome-${outcomeRow.id}`);
    setError('');
    setMessage('');
    try {
      if (outcomeRow.status !== 'COMPLETED') {
        await employerInterviewAction(outcomeRow.id, 'complete', {
          notes: outcomeNotes.trim() || undefined,
        });
      }
      if (outcome === 'SELECTED') {
        await changeApplicationStatus(outcomeRow.applicationId, 'SELECT');
        await recordHiringOutcome(outcomeRow.applicationId, 'HIRED', outcomeNotes.trim() || undefined);
      } else if (outcome === 'REJECTED') {
        await changeApplicationStatus(outcomeRow.applicationId, 'REJECT');
        await recordHiringOutcome(outcomeRow.applicationId, 'REJECTED', outcomeNotes.trim() || undefined);
      } else if (outcome === 'FURTHER') {
        await changeApplicationStatus(outcomeRow.applicationId, 'INTERVIEW');
        if (outcomeNotes.trim()) {
          await employerInterviewAction(outcomeRow.id, 'notes', { notes: outcomeNotes.trim() });
        }
      } else if (outcomeNotes.trim()) {
        await employerInterviewAction(outcomeRow.id, 'notes', { notes: `On hold: ${outcomeNotes.trim()}` });
      }
      setOutcomeRow(null);
      setOutcomeNotes('');
      setMessage(
        outcome === 'SELECTED'
          ? 'Candidate selected.'
          : outcome === 'REJECTED'
            ? 'Candidate rejected.'
            : outcome === 'FURTHER'
              ? 'Marked for further interview.'
              : 'Candidate placed on hold.',
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record outcome.');
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
            <p className="ep-ivdesk__sub">View, reschedule, cancel, and record outcomes in one place.</p>
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
                  <th>Job</th>
                  <th>Date</th>
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
                          <span>
                            {formatMode(item.mode)} · {item.durationMin} min
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="ep-ivdesk__cell">{item.job.title}</span>
                      </td>
                      <td>
                        <span className="ep-ivdesk__cell">{formatWhen(item.scheduledAt)}</span>
                      </td>
                      <td>
                        <span className={`ep-ivdesk__status ep-ivdesk__status--${statusTone(item.status)}`}>
                          <i aria-hidden />
                          {statusLabel(item.status)}
                        </span>
                      </td>
                      <td>
                        <div className="ep-ivdesk__actions">
                          <Button
                            type="button"
                            size="sm"
                            block={false}
                            className="ep-ivdesk__btn ep-ivdesk__btn--ghost"
                            onClick={() => setDetailRow(item)}
                          >
                            View
                          </Button>
                          {upcoming ? (
                            <Button
                              type="button"
                              size="sm"
                              block={false}
                              className="ep-ivdesk__btn ep-ivdesk__btn--ghost"
                              onClick={() => {
                                setRescheduleRow(item);
                                setRescheduleAt(toLocalInputValue(item.scheduledAt));
                              }}
                            >
                              Reschedule
                            </Button>
                          ) : null}
                          {upcoming ? (
                            <Button
                              type="button"
                              size="sm"
                              block={false}
                              className="ep-ivdesk__btn ep-ivdesk__btn--ghost"
                              loading={busyId === item.id}
                              onClick={() => void act(item.id, 'cancel')}
                            >
                              Cancel
                            </Button>
                          ) : null}
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
                          {(item.status === 'COMPLETED' || item.status === 'CONFIRMED') &&
                          !['SELECTED', 'HIRED', 'REJECTED'].includes(item.applicationStatus) ? (
                            <Button
                              type="button"
                              size="sm"
                              block={false}
                              className="ep-ivdesk__btn ep-ivdesk__btn--solid"
                              onClick={() => {
                                setOutcomeRow(item);
                                setOutcome('SELECTED');
                                setOutcomeNotes('');
                              }}
                            >
                              Outcome
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

        {detailRow ? (
          <div className="ep-ivdesk__modal" role="dialog" aria-modal="true" aria-labelledby="ep-detail-title">
            <button
              type="button"
              className="ep-ivdesk__modal-backdrop"
              aria-label="Close details"
              onClick={() => setDetailRow(null)}
            />
            <div className="ep-ivdesk__modal-card">
              <header className="ep-ivdesk__modal-head">
                <div>
                  <p className="ep-ivdesk__eyebrow">Interview details</p>
                  <h2 id="ep-detail-title">{candidateName(detailRow)}</h2>
                  <p>{detailRow.job.title}</p>
                </div>
                <button type="button" className="ep-ivdesk__modal-close" onClick={() => setDetailRow(null)}>
                  ×
                </button>
              </header>
              <dl className="ep-ivdesk__detail">
                <div>
                  <dt>When</dt>
                  <dd>{formatWhen(detailRow.scheduledAt)}</dd>
                </div>
                <div>
                  <dt>Duration</dt>
                  <dd>{detailRow.durationMin} minutes</dd>
                </div>
                <div>
                  <dt>Format</dt>
                  <dd>{formatMode(detailRow.mode)}</dd>
                </div>
                <div>
                  <dt>Location / link</dt>
                  <dd>{detailRow.meetingUrl || detailRow.location || '—'}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{statusLabel(detailRow.status)}</dd>
                </div>
                <div>
                  <dt>Notes</dt>
                  <dd>{detailRow.notes || '—'}</dd>
                </div>
              </dl>
              <div className="ep-ivdesk__actions" style={{ marginTop: 14 }}>
                <Link
                  href={`/employer/candidates/${detailRow.candidateId}?jobId=${encodeURIComponent(detailRow.jobId)}`}
                  className="ep-ivdesk__btn ep-ivdesk__btn--ghost"
                >
                  Open profile
                </Link>
                <Button
                  type="button"
                  size="sm"
                  block={false}
                  className="ep-ivdesk__btn ep-ivdesk__btn--ghost"
                  onClick={() => {
                    setMessage('');
                    setFeedbackRow(detailRow);
                    setDetailRow(null);
                  }}
                >
                  Feedback
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {rescheduleRow ? (
          <div className="ep-ivdesk__modal" role="dialog" aria-modal="true" aria-labelledby="ep-reschedule-title">
            <button
              type="button"
              className="ep-ivdesk__modal-backdrop"
              aria-label="Close reschedule"
              onClick={() => setRescheduleRow(null)}
            />
            <div className="ep-ivdesk__modal-card">
              <header className="ep-ivdesk__modal-head">
                <div>
                  <p className="ep-ivdesk__eyebrow">Reschedule</p>
                  <h2 id="ep-reschedule-title">{candidateName(rescheduleRow)}</h2>
                  <p>{rescheduleRow.job.title}</p>
                </div>
                <button type="button" className="ep-ivdesk__modal-close" onClick={() => setRescheduleRow(null)}>
                  ×
                </button>
              </header>
              <label className="ep-modal__field" htmlFor="ep-reschedule-at">
                <span>New date &amp; time</span>
                <input
                  id="ep-reschedule-at"
                  type="datetime-local"
                  value={rescheduleAt}
                  onChange={(e) => setRescheduleAt(e.target.value)}
                />
              </label>
              <footer className="ep-modal__actions">
                <Button type="button" variant="secondary" block={false} onClick={() => setRescheduleRow(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  block={false}
                  loading={busyId === rescheduleRow.id}
                  disabled={!rescheduleAt}
                  onClick={() =>
                    void act(rescheduleRow.id, 'reschedule', {
                      scheduledAt: new Date(rescheduleAt).toISOString(),
                    })
                  }
                >
                  Save new time
                </Button>
              </footer>
            </div>
          </div>
        ) : null}

        {outcomeRow ? (
          <div className="ep-ivdesk__modal" role="dialog" aria-modal="true" aria-labelledby="ep-outcome-title">
            <button
              type="button"
              className="ep-ivdesk__modal-backdrop"
              aria-label="Close outcome"
              onClick={() => setOutcomeRow(null)}
            />
            <div className="ep-ivdesk__modal-card">
              <header className="ep-ivdesk__modal-head">
                <div>
                  <p className="ep-ivdesk__eyebrow">Record outcome</p>
                  <h2 id="ep-outcome-title">{candidateName(outcomeRow)}</h2>
                  <p>{outcomeRow.job.title}</p>
                </div>
                <button type="button" className="ep-ivdesk__modal-close" onClick={() => setOutcomeRow(null)}>
                  ×
                </button>
              </header>
              <fieldset className="ep-modal__field">
                <legend>Outcome</legend>
                {(
                  [
                    ['SELECTED', 'Selected'],
                    ['REJECTED', 'Rejected'],
                    ['FURTHER', 'Further interview'],
                    ['ON_HOLD', 'On hold'],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="ep-modal__radio">
                    <input
                      type="radio"
                      name="interview-outcome"
                      checked={outcome === value}
                      onChange={() => setOutcome(value)}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              <label className="ep-modal__field" htmlFor="ep-outcome-notes">
                <span>Notes (optional)</span>
                <textarea
                  id="ep-outcome-notes"
                  rows={3}
                  maxLength={500}
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                />
              </label>
              <footer className="ep-modal__actions">
                <Button type="button" variant="secondary" block={false} onClick={() => setOutcomeRow(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  block={false}
                  loading={busyId === `outcome-${outcomeRow.id}`}
                  onClick={() => void saveOutcome()}
                >
                  Save outcome
                </Button>
              </footer>
            </div>
          </div>
        ) : null}

        {feedbackRow ? (
          <div className="ep-ivdesk__modal" role="dialog" aria-modal="true" aria-labelledby="ep-feedback-title">
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
