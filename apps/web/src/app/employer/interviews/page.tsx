'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatTimeSlotLabel, timeSlots, type EmployerInterviewRecord } from '@careerbridge/shared';
import {
  changeApplicationStatus,
  employerInterviewAction,
  listEmployerInterviews,
  recordHiringOutcome,
  requestEmployerInterviewFeedback,
} from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { Button } from '@/components/ui/Button';
import { ErrorState, SkeletonList } from '@/components/ui/StateViews';
import { toast } from '@/components/ui/Toast';
import { userFacingError } from '@/lib/client-errors';

type FilterTab = 'all' | 'upcoming' | 'completed';
type StatusFilter =
  | 'ALL'
  | 'AWAITING'
  | 'CONFIRMED'
  | 'RESCHEDULE_NEEDED'
  | 'RESCHEDULE_REQUESTED'
  | 'COMPLETED'
  | 'CANCELLED';

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'AWAITING', label: 'Awaiting Confirmation' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'RESCHEDULE_NEEDED', label: 'Waiting for candidate availability' },
  { value: 'RESCHEDULE_REQUESTED', label: 'Candidate proposed new time' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function matchesStatusFilter(status: string, filter: StatusFilter) {
  if (filter === 'ALL') return true;
  if (filter === 'AWAITING') return status === 'SCHEDULED' || status === 'PROPOSED';
  return status === filter;
}

/** Calendar day (YYYY-MM-DD) of an instant in India time, matching how interviews are scheduled. */
function istDay(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

type CancelDelivery = { inApp?: string; email?: string; whatsapp?: string };

function cancelDeliveryMessage(delivery?: CancelDelivery) {
  if (!delivery) return 'Interview cancelled.';
  const parts = ['Interview cancelled.'];
  parts.push(delivery.inApp === 'CREATED' ? 'Candidate notified in the app.' : 'In-app notification could not be created.');
  if (delivery.email === 'SENT') parts.push('Email sent.');
  else if (delivery.email === 'NOT_CONFIGURED') parts.push('Email was not sent: email delivery is not set up on this server.');
  else if (delivery.email === 'NO_EMAIL') parts.push('Email was not sent: the candidate has no email address.');
  else if (delivery.email === 'FAILED') parts.push('Email could not be sent.');
  return parts.join(' ');
}
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

const RESCHEDULE_TIME_SLOTS = timeSlots(7, 22);

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
  if (status === 'RESCHEDULE_NEEDED') return 'Waiting for candidate availability';
  if (status === 'RESCHEDULE_REQUESTED') return 'Candidate proposed new time';
  if (status === 'SCHEDULED' || status === 'PROPOSED') return 'Awaiting Confirmation';
  return status.charAt(0) + status.slice(1).toLowerCase().replaceAll('_', ' ');
}

function statusTone(status: string) {
  if (status === 'CONFIRMED') return 'ok';
  if (status === 'COMPLETED') return 'done';
  if (status === 'CANCELLED') return 'off';
  if (status === 'RESCHEDULE_REQUESTED' || status === 'RESCHEDULE_NEEDED') return 'warn';
  return 'default';
}

function proposedTimeLine(row: EmployerInterviewRecord) {
  if (row.status === 'RESCHEDULE_REQUESTED' && row.candidateAvailability?.label) {
    return `Candidate proposed time: ${row.candidateAvailability.label}`;
  }
  if (row.status === 'RESCHEDULE_NEEDED') return 'Waiting for the candidate to share another available time.';
  return '';
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
  const [detailNotes, setDetailNotes] = useState('');
  const [rescheduleRow, setRescheduleRow] = useState<EmployerInterviewRecord | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState('');
  const [rescheduleLink, setRescheduleLink] = useState('');
  const [outcomeRow, setOutcomeRow] = useState<EmployerInterviewRecord | null>(null);
  const [outcome, setOutcome] = useState<OutcomeChoice>('SELECTED');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [cancelRow, setCancelRow] = useState<EmployerInterviewRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  async function load() {
    setError('');
    const rows = await listEmployerInterviews();
    setItems(rows);
  }

  const [loadFailed, setLoadFailed] = useState(false);

  function initialLoad() {
    setLoading(true);
    setLoadFailed(false);
    void load()
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    initialLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('scheduled') === '1') {
      const wa = params.get('wa');
      const email = params.get('email');
      const parts = ['Interview scheduled.'];
      if (wa === 'queued') parts.push('WhatsApp notification queued.');
      if (wa === 'failed') parts.push('WhatsApp notification could not be queued.');
      if (wa === 'skipped_no_opt_in') parts.push('WhatsApp not sent: the candidate has not opted in to WhatsApp updates.');
      if (email === 'sent') parts.push('Email sent.');
      if (email === 'not_configured') parts.push('Email was not sent: email delivery is not set up on this server.');
      if (email === 'failed') parts.push('Email could not be sent.');
      if (email === 'no_email') parts.push('Email was not sent: the candidate has no email address.');
      setMessage(parts.join(' '));
      window.history.replaceState({}, '', '/employer/interviews');
    }
  }, []);

  const upcomingCount = useMemo(() => items.filter((item) => isUpcoming(item.status)).length, [items]);
  const completedCount = useMemo(() => items.filter((item) => isCompletedTab(item.status)).length, [items]);

  const visible = useMemo(() => {
    return items.filter((item) => {
      if (filter === 'upcoming' && !isUpcoming(item.status)) return false;
      if (filter === 'completed' && !isCompletedTab(item.status)) return false;
      if (!matchesStatusFilter(item.status, statusFilter)) return false;
      const day = istDay(item.scheduledAt);
      if (fromDate && day < fromDate) return false;
      if (toDate && day > toDate) return false;
      return true;
    });
  }, [items, filter, statusFilter, fromDate, toDate]);

  const dateRangeInvalid = Boolean(fromDate && toDate && fromDate > toDate);

  async function act(
    id: string,
    action: 'confirm' | 'complete' | 'cancel' | 'reschedule' | 'notes',
    payload?: { scheduledAt?: string; notes?: string; meetingUrl?: string },
  ) {
    setBusyId(id);
    setError('');
    setMessage('');
    try {
      const result = (await employerInterviewAction(id, action, payload)) as EmployerInterviewRecord & {
        delivery?: CancelDelivery;
      };
      toast.success(
        action === 'reschedule'
          ? 'Interview rescheduled. Candidate will confirm the new time.'
          : action === 'cancel'
            ? cancelDeliveryMessage(result?.delivery)
            : action === 'complete'
              ? 'Interview marked complete.'
              : action === 'confirm'
                ? 'Interview confirmed.'
                : 'Interview updated.',
      );
      setRescheduleRow(null);
      setCancelRow(null);
      setCancelReason('');
      await load().catch(() => undefined);
    } catch (err) {
      const text = userFacingError(
        err,
        action === 'reschedule'
          ? 'reschedule interview'
          : action === 'cancel'
            ? 'cancel interview'
            : action === 'complete'
              ? 'complete interview'
              : 'update interview',
      );
      setError(text);
      toast.error(text);
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
      } else {
        await changeApplicationStatus(outcomeRow.applicationId, 'HOLD');
        if (outcomeNotes.trim()) {
          await employerInterviewAction(outcomeRow.id, 'notes', { notes: `On hold: ${outcomeNotes.trim()}` });
        }
      }
      setOutcomeRow(null);
      setOutcomeNotes('');
      toast.success(
        `Interview outcome recorded: ${
          outcome === 'SELECTED'
            ? 'candidate selected.'
            : outcome === 'REJECTED'
              ? 'candidate rejected.'
              : outcome === 'FURTHER'
                ? 'further interview needed.'
                : 'candidate on hold.'
        }`,
      );
      await load().catch(() => undefined);
    } catch (err) {
      const text = userFacingError(err, 'record outcome');
      setError(text);
      toast.error(text);
    } finally {
      setBusyId('');
    }
  }

  function openReschedule(row: EmployerInterviewRecord) {
    const proposedStart = row.status === 'RESCHEDULE_REQUESTED' ? row.candidateAvailability?.from : null;
    setRescheduleRow(row);
    setRescheduleAt(toLocalInputValue(proposedStart || row.scheduledAt));
    setRescheduleLink('');
  }

  function openDetails(row: EmployerInterviewRecord) {
    setDetailRow(row);
    setDetailNotes(row.notes || '');
  }

  async function saveDetailNotes() {
    if (!detailRow) return;
    setBusyId(`notes-${detailRow.id}`);
    setError('');
    try {
      const updated = await employerInterviewAction(detailRow.id, 'notes', { notes: detailNotes.trim() });
      setItems((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setDetailRow(updated);
      setDetailNotes(updated.notes || '');
      toast.success('Interview notes saved.');
    } catch (err) {
      toast.error(userFacingError(err, 'save notes'));
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
      setError(userFacingError(err, 'request feedback'));
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

        {error ? (
          <p className="ep-ivdesk__alert" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && loadFailed ? <ErrorState onRetry={initialLoad} /> : null}
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

        {!loading && items.length > 0 ? (
          <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Status and date filters">
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-800" htmlFor="ep-iv-status">
              Status
              <select
                id="ep-iv-status"
                className="min-h-12 rounded-lg border border-slate-300 bg-white px-3"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                {STATUS_FILTERS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-800" htmlFor="ep-iv-from">
              From
              <input
                id="ep-iv-from"
                type="date"
                className="min-h-12 rounded-lg border border-slate-300 bg-white px-3"
                value={fromDate}
                max={toDate || undefined}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-800" htmlFor="ep-iv-to">
              To
              <input
                id="ep-iv-to"
                type="date"
                className="min-h-12 rounded-lg border border-slate-300 bg-white px-3"
                value={toDate}
                min={fromDate || undefined}
                aria-invalid={dateRangeInvalid || undefined}
                aria-describedby={dateRangeInvalid ? 'ep-iv-range-error' : undefined}
                onChange={(e) => setToDate(e.target.value)}
              />
            </label>
            {statusFilter !== 'ALL' || fromDate || toDate ? (
              <button
                type="button"
                className="min-h-12 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800"
                onClick={() => {
                  setStatusFilter('ALL');
                  setFromDate('');
                  setToDate('');
                }}
              >
                Clear filters
              </button>
            ) : null}
            {dateRangeInvalid ? (
              <p id="ep-iv-range-error" className="w-full text-sm font-semibold text-red-700" role="alert">
                The end date must be on or after the start date.
              </p>
            ) : null}
          </div>
        ) : null}

        {loading ? <SkeletonList rows={3} label="Loading interviews…" /> : null}

        {!loading && !loadFailed && items.length === 0 ? (
          <section className="ep-ivdesk__empty">
            <h2>No interviews yet</h2>
            <p>Shortlist an applicant, then book a time. Candidates get notified with the details.</p>
            <Link href="/employer/interviews/schedule" className="ep-ivdesk__cta">
              Schedule interview
            </Link>
          </section>
        ) : null}

        {!loading && items.length > 0 && visible.length === 0 ? (
          <section className="ep-ivdesk__empty" role="status">
            <h2>No interviews match these filters</h2>
            <p>Change the status, dates or tab to see other interviews.</p>
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
                        {proposedTimeLine(item) ? (
                          <span className="ep-ivdesk__cell" style={{ display: 'block', fontWeight: 600 }}>
                            {proposedTimeLine(item)}
                          </span>
                        ) : null}
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
                            onClick={() => openDetails(item)}
                          >
                            View
                          </Button>
                          {upcoming ? (
                            <Button
                              type="button"
                              size="sm"
                              block={false}
                              className="ep-ivdesk__btn ep-ivdesk__btn--ghost"
                              onClick={() => openReschedule(item)}
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
                              disabled={busyId === item.id}
                              onClick={() => {
                                setCancelReason('');
                                setCancelRow(item);
                              }}
                            >
                              Cancel
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
                {proposedTimeLine(detailRow) ? (
                  <div>
                    <dt>Candidate availability</dt>
                    <dd>{proposedTimeLine(detailRow)}</dd>
                  </div>
                ) : null}
              </dl>
              <label className="ep-modal__field" htmlFor="ep-detail-notes">
                <span>Notes</span>
                <textarea
                  id="ep-detail-notes"
                  rows={3}
                  maxLength={1000}
                  value={detailNotes}
                  onChange={(e) => setDetailNotes(e.target.value)}
                />
                <em>{detailNotes.length}/1000</em>
              </label>
              <div className="ep-ivdesk__actions" style={{ marginTop: 8 }}>
                <Button
                  type="button"
                  size="sm"
                  block={false}
                  className="ep-ivdesk__btn ep-ivdesk__btn--solid"
                  loading={busyId === `notes-${detailRow.id}`}
                  loadingLabel="Saving…"
                  disabled={detailNotes.trim() === (detailRow.notes || '').trim()}
                  onClick={() => void saveDetailNotes()}
                >
                  Save notes
                </Button>
                {isUpcoming(detailRow.status) ? (
                  <Button
                    type="button"
                    size="sm"
                    block={false}
                    className="ep-ivdesk__btn ep-ivdesk__btn--ghost"
                    onClick={() => {
                      openReschedule(detailRow);
                      setDetailRow(null);
                    }}
                  >
                    Reschedule
                  </Button>
                ) : null}
                {isUpcoming(detailRow.status) ? (
                  <Button
                    type="button"
                    size="sm"
                    block={false}
                    className="ep-ivdesk__btn ep-ivdesk__btn--ghost"
                    onClick={() => {
                      setCancelReason('');
                      setCancelRow(detailRow);
                      setDetailRow(null);
                    }}
                  >
                    Cancel interview
                  </Button>
                ) : null}
              </div>
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
              {(() => {
                const date = rescheduleAt.slice(0, 10);
                const time = rescheduleAt.slice(11, 16);
                const slots = RESCHEDULE_TIME_SLOTS.some((slot) => slot.value === time) || !time
                  ? RESCHEDULE_TIME_SLOTS
                  : [{ value: time, label: formatTimeSlotLabel(time) }, ...RESCHEDULE_TIME_SLOTS];
                return (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="ep-modal__field" htmlFor="ep-reschedule-date">
                      <span>New date</span>
                      <input
                        id="ep-reschedule-date"
                        type="date"
                        value={date}
                        onChange={(e) => setRescheduleAt(e.target.value ? `${e.target.value}T${time || '10:00'}` : '')}
                      />
                    </label>
                    <label className="ep-modal__field" htmlFor="ep-reschedule-time">
                      <span>New time</span>
                      <select
                        id="ep-reschedule-time"
                        value={time}
                        disabled={!date}
                        onChange={(e) => setRescheduleAt(`${date}T${e.target.value}`)}
                      >
                        {slots.map((slot) => (
                          <option key={slot.value} value={slot.value}>
                            {slot.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                );
              })()}
              {proposedTimeLine(rescheduleRow) ? (
                <p className="text-sm font-semibold text-slate-800" style={{ margin: '14px 0 6px' }}>
                  {proposedTimeLine(rescheduleRow)}
                </p>
              ) : null}
              {rescheduleRow.mode === 'VIDEO' ? (
                <label className="ep-modal__field" htmlFor="ep-reschedule-link">
                  <span>New meeting link (optional)</span>
                  <input
                    id="ep-reschedule-link"
                    type="url"
                    inputMode="url"
                    maxLength={500}
                    placeholder="https://meet.google.com/..."
                    value={rescheduleLink}
                    onChange={(e) => setRescheduleLink(e.target.value)}
                  />
                  <em>The link is shared with the candidate only after they confirm the new time.</em>
                </label>
              ) : null}
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
                      meetingUrl: rescheduleLink.trim() || undefined,
                    })
                  }
                >
                  Save new time
                </Button>
              </footer>
            </div>
          </div>
        ) : null}

        {cancelRow ? (
          <div className="ep-ivdesk__modal" role="dialog" aria-modal="true" aria-labelledby="ep-cancel-title">
            <button
              type="button"
              className="ep-ivdesk__modal-backdrop"
              aria-label="Close cancel dialog"
              onClick={() => setCancelRow(null)}
            />
            <div className="ep-ivdesk__modal-card">
              <header className="ep-ivdesk__modal-head">
                <div>
                  <p className="ep-ivdesk__eyebrow">Cancel interview</p>
                  <h2 id="ep-cancel-title">Cancel the interview with {candidateName(cancelRow)}?</h2>
                  <p>
                    {cancelRow.job.title} · {formatWhen(cancelRow.scheduledAt)}. The candidate will be notified.
                  </p>
                </div>
                <button type="button" className="ep-ivdesk__modal-close" onClick={() => setCancelRow(null)}>
                  ×
                </button>
              </header>
              <label className="ep-modal__field" htmlFor="ep-cancel-reason">
                <span>Reason (optional, shared with the candidate)</span>
                <textarea
                  id="ep-cancel-reason"
                  rows={3}
                  maxLength={500}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
                <em>{cancelReason.length}/500</em>
              </label>
              <footer className="ep-modal__actions">
                <Button type="button" variant="secondary" block={false} onClick={() => setCancelRow(null)}>
                  Keep interview
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  block={false}
                  loading={busyId === cancelRow.id}
                  loadingLabel="Cancelling…"
                  onClick={() =>
                    void act(cancelRow.id, 'cancel', { notes: cancelReason.trim() || undefined })
                  }
                >
                  Cancel interview
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
