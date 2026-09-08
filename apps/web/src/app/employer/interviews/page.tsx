'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { EmployerInterviewRecord } from '@careerbridge/shared';
import { employerInterviewAction, listEmployerInterviews } from '@/lib/api';
import { EmployerShellFallback, EmployerPageHeader } from '@/components/EmployerPortal';
import { Button } from '@/components/ui/Button';

function candidateName(row: EmployerInterviewRecord) {
  return [row.candidate.firstName, row.candidate.lastName].filter(Boolean).join(' ') || 'Candidate';
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

function statusTone(status: string) {
  if (status === 'CONFIRMED') return 'bg-emerald-100 text-emerald-800';
  if (status === 'COMPLETED') return 'bg-slate-200 text-slate-700';
  if (status === 'CANCELLED') return 'bg-rose-100 text-rose-800';
  if (status === 'RESCHEDULE_REQUESTED') return 'bg-amber-100 text-amber-900';
  return 'bg-primary-soft text-primary';
}

function toLocalInputValue(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function EmployerInterviewsPage() {
  const [items, setItems] = useState<EmployerInterviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [rescheduleId, setRescheduleId] = useState('');
  const [rescheduleAt, setRescheduleAt] = useState('');
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  async function load() {
    setError('');
    const rows = await listEmployerInterviews();
    setItems(rows);
    setNotesDraft(Object.fromEntries(rows.map((row) => [row.id, row.notes || ''])));
  }

  useEffect(() => {
    void load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load interviews.'))
      .finally(() => setLoading(false));
  }, []);

  const upcoming = useMemo(
    () => items.filter((item) => !['COMPLETED', 'CANCELLED'].includes(item.status)),
    [items],
  );

  async function act(
    id: string,
    action: 'confirm' | 'complete' | 'cancel' | 'reschedule',
    payload?: { scheduledAt?: string; notes?: string },
  ) {
    if (action === 'cancel' && !window.confirm('Cancel this interview?')) return;
    setBusyId(id);
    setError('');
    try {
      await employerInterviewAction(id, action, payload);
      setRescheduleId('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusyId('');
    }
  }

  async function saveNotes(id: string) {
    setBusyId(id);
    setError('');
    try {
      await employerInterviewAction(id, 'notes', { notes: notesDraft[id] || '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save notes.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <EmployerShellFallback title="Interviews">
      <div className="ep-desk">
        <EmployerPageHeader
          title="Interviews"
          subtitle="Schedule, confirm, reschedule, and track recruitment interviews."
          action={
            <Link href="/employer/interviews/schedule" className="ep-btn-gold inline-flex rounded-xl px-4 py-2 text-sm font-extrabold">
              + Schedule interview
            </Link>
          }
        />

        {error ? <p className="mb-4 text-sm font-semibold text-error">{error}</p> : null}
        {loading ? <p className="text-sm text-muted">Loading interviews…</p> : null}

        {!loading && items.length === 0 ? (
          <article className="ep-card">
            <p className="text-sm text-muted">No interviews scheduled yet.</p>
            <Link href="/employer/applications" className="ep-link mt-3 inline-block text-sm font-extrabold">
              Review applications →
            </Link>
          </article>
        ) : null}

        {!loading && upcoming.length > 0 ? (
          <article className="ep-card ep-list-card">
            <h2 className="px-5 pt-5 text-lg font-extrabold text-primary">Upcoming ({upcoming.length})</h2>
            <ul className="mt-2 divide-y divide-primary/10">
              {upcoming.map((item) => (
                <li key={item.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-extrabold text-primary">{candidateName(item)}</p>
                      <p className="text-sm text-muted">{item.job.title}</p>
                      <p className="mt-1 text-sm font-semibold text-primary">{formatWhen(item.scheduledAt)}</p>
                      <p className="text-xs text-muted">
                        {item.mode.replaceAll('_', ' ')} · {item.durationMin} min
                        {item.location ? ` · ${item.location}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${statusTone(item.status)}`}>
                        {item.status.replaceAll('_', ' ')}
                      </span>
                      <div className="flex flex-wrap justify-end gap-2">
                        {item.status === 'SCHEDULED' || item.status === 'RESCHEDULE_REQUESTED' ? (
                          <Button
                            type="button"
                            size="sm"
                            block={false}
                            variant="secondary"
                            loading={busyId === item.id}
                            onClick={() => void act(item.id, 'confirm')}
                          >
                            Confirm
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          block={false}
                          variant="secondary"
                          loading={busyId === item.id}
                          onClick={() => {
                            setRescheduleId(item.id);
                            setRescheduleAt(toLocalInputValue(item.scheduledAt));
                          }}
                        >
                          Reschedule
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          block={false}
                          loading={busyId === item.id}
                          onClick={() => void act(item.id, 'complete')}
                        >
                          Mark done
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          block={false}
                          variant="destructive"
                          loading={busyId === item.id}
                          onClick={() => void act(item.id, 'cancel')}
                        >
                          Cancel
                        </Button>
                        <Link
                          href={`/employer/candidates/${item.candidateId}?jobId=${encodeURIComponent(item.jobId)}`}
                          className="ep-link text-sm font-extrabold"
                        >
                          Profile
                        </Link>
                      </div>
                    </div>
                  </div>

                  {rescheduleId === item.id ? (
                    <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl bg-fog/70 p-3">
                      <label className="grid gap-1 text-xs font-bold text-muted">
                        New date & time
                        <input
                          type="datetime-local"
                          className="rounded-xl border border-primary/15 bg-white px-3 py-2 text-sm font-semibold text-primary"
                          value={rescheduleAt}
                          onChange={(e) => setRescheduleAt(e.target.value)}
                        />
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        block={false}
                        loading={busyId === item.id}
                        onClick={() =>
                          void act(item.id, 'reschedule', {
                            scheduledAt: new Date(rescheduleAt).toISOString(),
                          })
                        }
                      >
                        Save new time
                      </Button>
                      <button type="button" className="text-xs font-bold text-muted" onClick={() => setRescheduleId('')}>
                        Dismiss
                      </button>
                    </div>
                  ) : null}

                  <label className="mt-3 grid gap-1 text-xs font-bold text-muted">
                    Interview notes
                    <textarea
                      className="min-h-[64px] rounded-xl border border-primary/15 bg-white px-3 py-2 text-sm font-semibold text-primary"
                      value={notesDraft[item.id] || ''}
                      onChange={(e) => setNotesDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder="Outcome notes, feedback…"
                    />
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    block={false}
                    className="mt-2"
                    loading={busyId === item.id}
                    onClick={() => void saveNotes(item.id)}
                  >
                    Save notes
                  </Button>
                </li>
              ))}
            </ul>
          </article>
        ) : null}

        {!loading && items.some((item) => ['COMPLETED', 'CANCELLED'].includes(item.status)) ? (
          <article className="ep-card ep-list-card mt-6">
            <h2 className="px-5 pt-5 text-lg font-extrabold text-primary">Past</h2>
            <ul className="mt-2 divide-y divide-primary/10 px-5 pb-3">
              {items
                .filter((item) => ['COMPLETED', 'CANCELLED'].includes(item.status))
                .map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <span className="font-bold text-primary">
                      {candidateName(item)} — {item.job.title}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${statusTone(item.status)}`}>
                      {item.status}
                    </span>
                  </li>
                ))}
            </ul>
          </article>
        ) : null}
      </div>
    </EmployerShellFallback>
  );
}
