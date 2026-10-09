'use client';

import { toast } from '@/components/ui/Toast';
import { userFacingError } from '@/lib/client-errors';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { EmployerApplication } from '@careerbridge/shared';
import { normalizeHttpUrl, timeSlots } from '@careerbridge/shared';
import { listEmployerApplications, listEmployerJobs, scheduleEmployerInterview } from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import {
  EvAlert,
  EvApplicationPill,
  EvAvatar,
  EvPageHead,
  EvStepHead,
  EvSwitch,
} from '@/components/employer/ui';
import { DatePicker } from '@/features/candidate/passport/DatePicker';

const MODES = [
  { value: 'VIDEO', label: 'Video call', hint: 'Meet / Zoom link' },
  { value: 'IN_PERSON', label: 'In person', hint: 'Office venue' },
  { value: 'PHONE', label: 'Phone', hint: 'Dial-in number' },
] as const;

const MODE_ICONS: Record<(typeof MODES)[number]['value'], string> = {
  VIDEO: '▶',
  IN_PERSON: '⌂',
  PHONE: '☏',
};

const DURATION_OPTIONS = [15, 30, 45, 60, 90];
const INTERVIEW_TIME_SLOTS = timeSlots(7, 22);

function candidateName(app: EmployerApplication) {
  return [app.candidate.firstName, app.candidate.lastName].filter(Boolean).join(' ') || 'Candidate';
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
  const [appsLoadedFor, setAppsLoadedFor] = useState('');
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
      .catch(() => setApplications([]))
      .finally(() => setAppsLoadedFor(jobId));
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

    const locationTrimmed = location.trim();
    if (mode === 'VIDEO') {
      if (!normalizeHttpUrl(locationTrimmed)) {
        setError('Enter a valid meeting link (Google Meet, Zoom, etc.) before continuing.');
        return;
      }
    } else if (!locationTrimmed) {
      setError(
        mode === 'IN_PERSON'
          ? 'Enter the venue address before continuing.'
          : 'Enter the phone / dial-in details before continuing.',
      );
      return;
    }

    setSaving(true);
    setError('');
    try {
      const created = await scheduleEmployerInterview({
        applicationId,
        scheduledAt: scheduledAt.toISOString(),
        durationMin: Number(durationMin) || 30,
        mode,
        location: mode === 'VIDEO' ? normalizeHttpUrl(locationTrimmed)! : locationTrimmed,
        notes: notes.trim() || undefined,
        notifyWhatsApp,
        notifyEmail,
      });
      const params = new URLSearchParams({ scheduled: '1' });
      if (created.delivery?.whatsapp) params.set('wa', created.delivery.whatsapp.toLowerCase());
      if (created.delivery?.email) params.set('email', created.delivery.email.toLowerCase());
      router.push(`/employer/interviews?${params.toString()}`);
    } catch (err) {
      const text = userFacingError(err, 'schedule interview');
      setError(text);
      toast.error(text);
    } finally {
      setSaving(false);
    }
  }

  const selectedName = selectedApp ? candidateName(selectedApp) : '';
  const notifyLabel = [notifyWhatsApp ? 'WhatsApp' : '', notifyEmail ? 'Email' : ''].filter(Boolean).join(', ') || 'None';
  const timeLabel = INTERVIEW_TIME_SLOTS.find((slot) => slot.value === interviewTime)?.label || '—';
  const modeLabel = MODES.find((item) => item.value === mode)?.label || mode;

  return (
    <EmployerShellFallback title="Schedule interview">
      <EvPageHead
        eyebrow="Scheduling"
        title="Schedule interview"
        subtitle="Pick a candidate, set a time, and we notify them with the details."
        actions={
          <Link href="/employer/interviews" className="ev-btn ev-btn--ghost">
            ← Interviews
          </Link>
        }
      />

      <form onSubmit={(e) => void onSubmit(e)} className="ev-sch ev-mt">
        <div className="ev-sch-col">
          <section className="ev-card ev-form">
            <EvStepHead n={1} title="Who" hint="Choose the role and an applicant to interview" />
            <div className="ev-f">
              <label>
                Job
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

              <label>
                Candidate
                <select value={applicationId} onChange={(e) => setApplicationId(e.target.value)} required>
                  <option value="">
                    {applications.length || appsLoadedFor !== jobId ? 'Select applicant' : 'No applicants yet'}
                  </option>
                  {applications.map((app) => (
                    <option key={app.id} value={app.id}>
                      {candidateName(app)} — {app.status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {jobId && appsLoadedFor === jobId && !applications.length ? (
              <p className="ev-hint">This job has no applicants yet. Shortlist someone from Candidates first.</p>
            ) : null}
            {selectedApp ? (
              <p className="ev-hint">
                <b>{selectedName}</b> · {selectedApp.job.title} · <EvApplicationPill status={selectedApp.status} />
              </p>
            ) : null}
          </section>

          <section className="ev-card ev-form">
            <EvStepHead n={2} title="When" hint="Select a date, a start time and how long it runs" />
            <div className="ev-f">
              <label>
                Date
                <DatePicker
                  value={interviewDate}
                  onChange={setInterviewDate}
                  placeholder="Select date"
                  confirmLabel="Set interview date"
                />
              </label>
              <label>
                Start time
                <select value={interviewTime} onChange={(e) => setInterviewTime(e.target.value)} required>
                  <option value="">Select time</option>
                  {INTERVIEW_TIME_SLOTS.map((slot) => (
                    <option key={slot.value} value={slot.value}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="ev-sub2">DURATION</div>
            <div className="ev-chips2" role="radiogroup" aria-label="Duration">
              {DURATION_OPTIONS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  role="radio"
                  aria-checked={durationMin === String(mins)}
                  className={`ev-chipbtn${durationMin === String(mins) ? ' on' : ''}`}
                  onClick={() => setDurationMin(String(mins))}
                >
                  {mins} min
                </button>
              ))}
            </div>
            {timingPreview ? (
              <p className="ev-hint">
                Scheduled for <b>{timingPreview}</b> · {durationMin} minutes
              </p>
            ) : (
              <p className="ev-hint">Choose a date and time for the interview.</p>
            )}
          </section>

          <section className="ev-card ev-form">
            <EvStepHead n={3} title="How and where" hint="The candidate sees this in their invite" />
            <div className="ev-seg" role="radiogroup" aria-label="Interview mode">
              {MODES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`ev-mcard${mode === item.value ? ' on' : ''}`}
                  onClick={() => setMode(item.value)}
                  aria-pressed={mode === item.value}
                >
                  <i aria-hidden>{MODE_ICONS[item.value]}</i>
                  <span>
                    <b>{item.label}</b>
                    <small>{item.hint}</small>
                  </span>
                </button>
              ))}
            </div>
            <label>
              {locationLabel}
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={locationPlaceholder}
              />
            </label>
          </section>

          <section className="ev-card ev-form">
            <EvStepHead n={4} title="Message and alerts" hint="Tell them what to prepare and how to reach them" />
            <label style={{ marginTop: 0 }}>
              Notes for candidate
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What to prepare, documents to bring, dress code…"
                rows={3}
              />
            </label>
            <div className="ev-mt-sm">
              <EvSwitch checked={notifyWhatsApp} onChange={setNotifyWhatsApp}>
                Notify candidate on WhatsApp
              </EvSwitch>
              <EvSwitch checked={notifyEmail} onChange={setNotifyEmail}>
                Send email notification
              </EvSwitch>
            </div>
          </section>
        </div>

        <aside className="ev-card ev-sum" aria-label="Interview summary">
          <h2>Interview summary</h2>
          <div className="ev-sum-who">
            <EvAvatar name={selectedName || null} />
            <div>
              <b>{selectedName || 'No candidate yet'}</b>
              <span className="ev-sub ev-block">
                {selectedApp?.job.title || jobs.find((job) => job.id === jobId)?.title || 'Select a job'}
              </span>
            </div>
          </div>
          <div className="ev-r">
            <span>Date</span>
            <b>
              {interviewDate
                ? new Date(`${interviewDate}T00:00`).toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : '—'}
            </b>
          </div>
          <div className="ev-r">
            <span>Time</span>
            <b>{timeLabel}</b>
          </div>
          <div className="ev-r">
            <span>Duration</span>
            <b>{durationMin} min</b>
          </div>
          <div className="ev-r">
            <span>Mode</span>
            <b>{modeLabel}</b>
          </div>
          <div className="ev-r">
            <span>Notify</span>
            <b>{notifyLabel}</b>
          </div>

          {error ? (
            <div className="ev-mt-sm">
              <EvAlert tone="error">{error}</EvAlert>
            </div>
          ) : null}

          <div className="ev-sum-actions">
            <button type="submit" className="ev-btn ev-btn--block" disabled={saving} aria-busy={saving || undefined}>
              {saving ? 'Scheduling…' : 'Schedule interview'}
            </button>
            <Link href="/employer/interviews" className="ev-btn ev-btn--ghost ev-btn--block">
              Cancel
            </Link>
          </div>
        </aside>
      </form>
    </EmployerShellFallback>
  );
}
