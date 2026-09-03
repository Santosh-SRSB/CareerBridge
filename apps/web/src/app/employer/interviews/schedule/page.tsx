'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { EmployerApplication } from '@careerbridge/shared';
import { listEmployerApplications, listEmployerJobs, scheduleEmployerInterview } from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { Button } from '@/components/ui/Button';

const MODES = [
  { value: 'VIDEO', label: 'Video call', hint: 'Meet / Zoom link' },
  { value: 'IN_PERSON', label: 'In person', hint: 'Office venue' },
  { value: 'PHONE', label: 'Phone', hint: 'Dial-in number' },
] as const;

const DURATION_OPTIONS = [15, 30, 45, 60, 90];

function candidateName(app: EmployerApplication) {
  return [app.candidate.firstName, app.candidate.lastName].filter(Boolean).join(' ') || 'Candidate';
}

function todayISODate() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatTimingPreview(date: string, time: string) {
  if (!date || !time) return null;
  const when = new Date(`${date}T${time}`);
  if (Number.isNaN(when.getTime())) return null;
  return when.toLocaleString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function EmployerScheduleInterviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetApplicationId = searchParams.get('applicationId') || '';
  const presetJobId = searchParams.get('jobId') || '';

  const [jobs, setJobs] = useState<Array<{ id: string; title: string }>>([]);
  const [jobId, setJobId] = useState(presetJobId);
  const [applications, setApplications] = useState<EmployerApplication[]>([]);
  const [applicationId, setApplicationId] = useState(presetApplicationId);
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewTime, setInterviewTime] = useState('');
  const [durationMin, setDurationMin] = useState('30');
  const [mode, setMode] = useState<(typeof MODES)[number]['value']>('VIDEO');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listEmployerJobs()
      .then((rows) => {
        setJobs(rows.map((job) => ({ id: job.id, title: job.title })));
        if (!jobId && rows[0]) setJobId(rows[0].id);
      })
      .finally(() => setLoading(false));
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      setApplications([]);
      return;
    }
    listEmployerApplications(jobId)
      .then(setApplications)
      .catch(() => setApplications([]));
  }, [jobId]);

  const selectedApp = useMemo(
    () => applications.find((item) => item.id === applicationId) || null,
    [applications, applicationId],
  );

  const timingPreview = formatTimingPreview(interviewDate, interviewTime);
  const locationLabel =
    mode === 'IN_PERSON' ? 'Venue address' : mode === 'PHONE' ? 'Phone / dial-in' : 'Meeting link';
  const locationPlaceholder =
    mode === 'IN_PERSON' ? 'Office address, floor, landmark' : mode === 'PHONE' ? '+91 …' : 'https://meet.google.com/…';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!applicationId) {
      setError('Select a candidate.');
      return;
    }
    if (!interviewDate || !interviewTime) {
      setError('Select interview date and time.');
      return;
    }
    const scheduledAt = new Date(`${interviewDate}T${interviewTime}`);
    if (Number.isNaN(scheduledAt.getTime())) {
      setError('Invalid date or time.');
      return;
    }
    if (scheduledAt.getTime() < Date.now() - 60_000) {
      setError('Interview time must be in the future.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await scheduleEmployerInterview({
        applicationId,
        scheduledAt: scheduledAt.toISOString(),
        durationMin: Number(durationMin) || 30,
        mode,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        notifyWhatsApp,
        notifyEmail,
      });
      router.push('/employer/interviews');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not schedule interview.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <EmployerShellFallback title="Schedule interview">
      <div className="ep-schedule">
        <div className="ep-schedule__shell">
          <header className="ep-schedule__head">
            <Link href="/employer/interviews" className="ep-schedule__back">
              ← Interviews
            </Link>
            <h1 className="ep-schedule__title">Schedule interview</h1>
            <p className="ep-schedule__sub">
              Pick the candidate, select timing, and send the invite. They get a product notification with the details.
            </p>
          </header>

          <form onSubmit={(e) => void onSubmit(e)} className="ep-schedule__card">
            <section className="ep-schedule__section">
              <h2 className="ep-schedule__section-title">Who</h2>
              <div className="ep-schedule__fields">
                <label className="ep-schedule__field">
                  <span>Job</span>
                  <select
                    value={jobId}
                    onChange={(e) => {
                      setJobId(e.target.value);
                      setApplicationId('');
                    }}
                    disabled={loading}
                  >
                    {jobs.length === 0 ? <option value="">No jobs yet</option> : null}
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="ep-schedule__field">
                  <span>Candidate</span>
                  <select
                    value={applicationId}
                    onChange={(e) => setApplicationId(e.target.value)}
                    required
                  >
                    <option value="">Select applicant</option>
                    {applications.map((app) => (
                      <option key={app.id} value={app.id}>
                        {candidateName(app)} — {app.status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {selectedApp ? (
                <div className="ep-schedule__chip">
                  <strong>{candidateName(selectedApp)}</strong>
                  <span>· {selectedApp.job.title}</span>
                  <em>{selectedApp.status}</em>
                </div>
              ) : null}
            </section>

            <section className="ep-schedule__section">
              <h2 className="ep-schedule__section-title">Select timing</h2>
              <div className="ep-schedule__timing">
                <label className="ep-schedule__field">
                  <span>Date</span>
                  <input
                    type="date"
                    min={todayISODate()}
                    value={interviewDate}
                    onChange={(e) => setInterviewDate(e.target.value)}
                    required
                  />
                </label>
                <label className="ep-schedule__field">
                  <span>Time</span>
                  <input
                    type="time"
                    value={interviewTime}
                    onChange={(e) => setInterviewTime(e.target.value)}
                    required
                  />
                </label>
                <label className="ep-schedule__field">
                  <span>Duration</span>
                  <select value={durationMin} onChange={(e) => setDurationMin(e.target.value)}>
                    {DURATION_OPTIONS.map((mins) => (
                      <option key={mins} value={String(mins)}>
                        {mins} min
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {timingPreview ? (
                <p className="ep-schedule__preview">
                  Scheduled for <strong>{timingPreview}</strong>
                  <span> · {durationMin} minutes</span>
                </p>
              ) : (
                <p className="ep-schedule__hint">Choose a date and time for the interview.</p>
              )}
            </section>

            <section className="ep-schedule__section">
              <h2 className="ep-schedule__section-title">How & where</h2>
              <div className="ep-schedule__modes" role="radiogroup" aria-label="Interview mode">
                {MODES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`ep-schedule__mode ${mode === item.value ? 'is-active' : ''}`}
                    onClick={() => setMode(item.value)}
                    aria-pressed={mode === item.value}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.hint}</span>
                  </button>
                ))}
              </div>

              <label className="ep-schedule__field">
                <span>{locationLabel}</span>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={locationPlaceholder}
                />
              </label>

              <label className="ep-schedule__field">
                <span>Notes for candidate</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What to prepare, documents to bring, dress code…"
                  rows={3}
                />
              </label>

              <div className="ep-schedule__notify">
                <label>
                  <input
                    type="checkbox"
                    checked={notifyWhatsApp}
                    onChange={(e) => setNotifyWhatsApp(e.target.checked)}
                  />
                  Notify candidate on WhatsApp
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={notifyEmail}
                    onChange={(e) => setNotifyEmail(e.target.checked)}
                  />
                  Send email notification
                </label>
              </div>
            </section>

            {error ? <p className="ep-schedule__error">{error}</p> : null}

            <div className="ep-schedule__actions">
              <Link href="/employer/interviews" className="ep-schedule__cancel">
                Cancel
              </Link>
              <Button type="submit" loading={saving} loadingLabel="Scheduling…" block={false} className="ep-schedule__submit">
                Schedule interview
              </Button>
            </div>
          </form>
        </div>
      </div>
    </EmployerShellFallback>
  );
}
