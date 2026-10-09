'use client';

import { FormEvent, useState } from 'react';
import { timeSlots } from '@careerbridge/shared';
import type { ScheduledJobInterview } from '@/lib/candidate-marketplace-api';
import { DatePicker } from '@/features/candidate/passport/DatePicker';

export type CandidateAvailabilityPayload = {
  date: string;
  availableFrom: string;
  availableUntil: string;
  timezone?: string;
};

const AVAILABILITY_SLOTS = timeSlots(7, 22, 30);
const INDIA_TIME_ZONES = new Set(['Asia/Kolkata', 'Asia/Calcutta']);

function browserTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone || INDIA_TIME_ZONES.has(zone)) return 'Asia/Kolkata';
    return zone;
  } catch {
    return 'Asia/Kolkata';
  }
}

/** 'HH:MM' → '3:00 PM' */
function clockLabel(value: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return value;
  const hours = Number(match[1]);
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${match[2]} ${hours < 12 ? 'AM' : 'PM'}`;
}

/** '2026-04-03' → '3 April' */
function dayMonthLabel(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date);
}

function proposedTimeLabel(date: string, from: string, until: string): string | null {
  if (!date || !from || !until || from >= until) return null;
  return `${dayMonthLabel(date)}, ${clockLabel(from)} - ${clockLabel(until)}`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function validateAvailability(date: string, from: string, until: string): string {
  if (!date || !from || !until) return 'Select a date, an Available From time and an Available Until time.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Enter a valid date.';
  if (from >= until) return 'Available From must be earlier than Available Until.';
  if (date < todayIso()) return 'Choose today or a later date.';
  const start = new Date(`${date}T${from}:00`);
  if (!Number.isNaN(start.getTime()) && start.getTime() < Date.now()) {
    return 'Available From cannot be in the past.';
  }
  return '';
}

export function WhatsAppInterviewNotice({
  interview,
  onConfirm,
  onRequestReschedule,
  onSubmitAvailability,
  openAvailabilityForm = false,
  busy = false,
}: {
  interview: ScheduledJobInterview;
  onConfirm?: () => void;
  /** Candidate tapped Reschedule: records that another time is needed. */
  onRequestReschedule?: () => void;
  /** Candidate submitted the date and time range they are available. */
  onSubmitAvailability?: (payload: CandidateAvailabilityPayload) => void;
  /** Show the availability form immediately (reschedule link from WhatsApp / notification). */
  openAvailabilityForm?: boolean;
  busy?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableUntil, setAvailableUntil] = useState('');
  const [formError, setFormError] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const status = interview.status;
  const confirmed = status === 'CONFIRMED';
  const availabilitySent = status === 'RESCHEDULE_REQUESTED';
  const pendingConfirmation = status === 'PENDING_CONFIRMATION';
  const showForm =
    status === 'RESCHEDULE_NEEDED' ||
    editing ||
    (openAvailabilityForm && (pendingConfirmation || confirmed));

  const meetingUrl =
    interview.meetingUrl ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/interviews/scheduled/${interview.id}`
      : `/interviews/scheduled/${interview.id}`);

  const preview = proposedTimeLabel(date, availableFrom, availableUntil);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(meetingUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function submitAvailability(event: FormEvent) {
    event.preventDefault();
    const error = validateAvailability(date, availableFrom, availableUntil);
    setFormError(error);
    if (error) return;
    setConfirming(false);
    onSubmitAvailability?.({ date, availableFrom, availableUntil, timezone: browserTimeZone() });
    setEditing(false);
  }

  if (status === 'COMPLETED' || status === 'CANCELLED') return null;

  if (showForm) {
    return (
      <form
        onSubmit={submitAvailability}
        className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5"
        data-testid="reschedule-availability-form"
      >
        <div>
          <p className="text-sm font-extrabold text-amber-950">No problem. Please select another available time.</p>
          <p className="mt-1 text-sm text-amber-950/80">Select the date and time range when you are available.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-xs font-bold text-slate-700">
            Date
            <DatePicker
              value={date}
              onChange={(value) => {
                setDate(value);
                setFormError('');
              }}
              placeholder="Select date"
              confirmLabel="Set date"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-slate-700">
            Available From
            <select
              value={availableFrom}
              onChange={(e) => {
                setAvailableFrom(e.target.value);
                setFormError('');
              }}
              className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
            >
              <option value="">Select time</option>
              {AVAILABILITY_SLOTS.map((slot) => (
                <option key={slot.value} value={slot.value}>
                  {clockLabel(slot.value)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-slate-700">
            Available Until
            <select
              value={availableUntil}
              onChange={(e) => {
                setAvailableUntil(e.target.value);
                setFormError('');
              }}
              className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
            >
              <option value="">Select time</option>
              {AVAILABILITY_SLOTS.map((slot) => (
                <option key={slot.value} value={slot.value}>
                  {clockLabel(slot.value)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {preview ? (
          <p className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-800" data-testid="proposed-time-preview">
            Candidate proposed time: {preview}
          </p>
        ) : null}
        {formError ? (
          <p className="text-xs font-semibold text-red-600" role="alert">
            {formError}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy}
            aria-busy={busy || undefined}
            className="inline-flex min-h-12 items-center rounded-lg bg-[#1a1fc4] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {busy ? 'Sending...' : 'Submit Reschedule Request'}
          </button>
          {editing ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setFormError('');
              }}
              className="min-h-12 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    );
  }

  if (availabilitySent) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5" data-testid="availability-sent">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400" />
          <p className="text-sm font-extrabold text-amber-950">Your new availability has been sent to the employer.</p>
        </div>
        {interview.candidateAvailability?.label ? (
          <p className="mt-2 text-sm font-semibold text-amber-950">
            Candidate proposed time: {interview.candidateAvailability.label}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-amber-950/80">
          The employer will schedule the interview and you will be notified with the new time.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => setEditing(true)}
          className="mt-3 min-h-11 rounded-lg border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-950 disabled:opacity-60"
        >
          Change availability
        </button>
      </div>
    );
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
            className="inline-flex rounded-lg bg-[#1a1fc4] px-4 py-2 text-xs font-bold text-white"
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

  if (!pendingConfirmation) return null;

  return (
    <div className="rounded-2xl border border-[#d7e1fa] bg-[#eef1ff] p-4 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-[#10137c]">Interview response</p>
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

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            aria-busy={(busy && confirming) || undefined}
            onClick={() => {
              setConfirming(true);
              onConfirm?.();
            }}
            className="inline-flex min-h-12 items-center rounded-lg bg-[#1a1fc4] px-4 py-2 text-xs font-bold text-white hover:bg-[#10137c] disabled:opacity-70"
          >
            {busy && confirming ? (
              <>
                <span
                  aria-hidden
                  data-testid="button-spinner"
                  className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                />
                Confirming...
              </>
            ) : (
              'Confirm Interview'
            )}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setConfirming(false);
              onRequestReschedule?.();
            }}
            className="min-h-12 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 disabled:opacity-60"
          >
            Reschedule
          </button>
        </div>
      </div>
    </div>
  );
}
