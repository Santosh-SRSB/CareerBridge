'use client';

import { FormEvent, useMemo, useState } from 'react';
import type { ScheduledJobInterview } from '@/lib/candidate-marketplace-api';

function todayInputValue() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function WhatsAppInterviewNotice({
  interview,
  onConfirm,
  onReschedule,
  busy = false,
}: {
  interview: ScheduledJobInterview;
  onConfirm?: () => void;
  onReschedule?: (payload: { preferredDate: string; preferredTime: string; reason?: string }) => void;
  busy?: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState('');
  const [copied, setCopied] = useState(false);

  const meetingUrl =
    interview.meetingUrl ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/interviews/scheduled/${interview.id}`
      : `/interviews/scheduled/${interview.id}`);

  const minDate = useMemo(() => todayInputValue(), []);
  const pending = interview.status === 'RESCHEDULE_REQUESTED';
  const confirmed = interview.status === 'CONFIRMED';

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(meetingUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function submitReschedule(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    if (!preferredDate || !preferredTime) {
      setFormError('Select both a preferred date and time.');
      return;
    }
    const when = new Date(`${preferredDate}T${preferredTime}`);
    if (Number.isNaN(when.getTime())) {
      setFormError('Enter a valid date and time.');
      return;
    }
    if (when.getTime() < Date.now() - 60_000) {
      setFormError('Preferred date and time cannot be in the past.');
      return;
    }
    onReschedule?.({
      preferredDate,
      preferredTime,
      reason: reason.trim() || undefined,
    });
    setShowForm(false);
  }

  if (confirmed) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <p className="text-sm font-extrabold text-emerald-900">Interview confirmed</p>
        </div>
        <p className="mt-2 text-sm text-emerald-900/80">
          You&apos;re all set for {interview.scheduledTime} on{' '}
          {new Date(interview.scheduledDate).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          .
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={meetingUrl}
            className="inline-flex rounded-lg bg-[#0a2e2c] px-4 py-2 text-xs font-bold text-white"
          >
            Start meeting
          </a>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-900"
          >
            {copied ? 'Link copied' : 'Copy link'}
          </button>
        </div>
        <p className="mt-3 break-all text-[11px] text-emerald-900/70">{meetingUrl}</p>
      </div>
    );
  }

  if (pending) {
    const preferredLabel = interview.preferredRescheduleAt
      ? new Date(interview.preferredRescheduleAt).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400" />
          <p className="text-sm font-extrabold text-amber-950">Reschedule request pending</p>
        </div>
        <p className="mt-2 text-sm text-amber-950/80">
          We will let you know once the employer approves
          {preferredLabel ? ` your preferred time (${preferredLabel})` : ''}.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#dcf8c6] bg-[#e7ffdb] p-4 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-[#075e54]">Interview response</p>
      <div className="mt-3 rounded-xl bg-white p-4 text-sm text-slate-800 shadow-sm">
        <p>
          <strong>{interview.companyName}</strong> has scheduled an interview for{' '}
          <strong>{interview.jobTitle}</strong>.
        </p>
        <p className="mt-2">
          Date:{' '}
          {new Date(interview.scheduledDate).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
        <p>Time: {interview.scheduledTime}</p>
        <p className="mt-2 text-slate-600">Please confirm your availability.</p>

        {!showForm ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className="rounded-lg bg-[#25d366] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              Confirm Interview
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowForm(true)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 disabled:opacity-60"
            >
              Request Reschedule
            </button>
          </div>
        ) : (
          <form onSubmit={submitReschedule} className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Preferred new slot</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-bold text-slate-600">
                Date
                <input
                  type="date"
                  min={minDate}
                  required
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                />
              </label>
              <label className="grid gap-1 text-xs font-bold text-slate-600">
                Time
                <input
                  type="time"
                  required
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                />
              </label>
            </div>
            <label className="grid gap-1 text-xs font-bold text-slate-600">
              Reason (optional)
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800"
                placeholder="Share a short reason for the employer"
              />
            </label>
            {formError ? <p className="text-xs font-semibold text-red-600">{formError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-[#0a2e2c] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
              >
                Submit reschedule request
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setShowForm(false);
                  setFormError('');
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
