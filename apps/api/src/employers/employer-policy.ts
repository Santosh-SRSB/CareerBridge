import { ForbiddenException } from '@nestjs/common';
import { ErrorCode, normalizeHttpUrl } from '@careerbridge/shared';

/* ---------- Employer verification (single source of truth: verificationStatus) ---------- */

export type EmployerVerificationFields = { verificationStatus: string; verified: boolean };

/**
 * `verificationStatus` is authoritative. Rows written before the status enum existed carry only
 * `verified=true` (seed / admin verify) with the default UNVERIFIED status; those are VERIFIED.
 */
export function effectiveVerificationStatus(employer: EmployerVerificationFields): string {
  if (employer.verified && employer.verificationStatus === 'UNVERIFIED') return 'VERIFIED';
  return employer.verificationStatus;
}

export function withEffectiveVerification<T extends EmployerVerificationFields>(employer: T): T {
  const verificationStatus = effectiveVerificationStatus(employer);
  return { ...employer, verificationStatus, verified: verificationStatus === 'VERIFIED' };
}

export function hasCompletedKyc(employer: EmployerVerificationFields): boolean {
  return effectiveVerificationStatus(employer) !== 'UNVERIFIED';
}

export function assertKycComplete(employer: EmployerVerificationFields, message: string) {
  if (!hasCompletedKyc(employer)) {
    throw new ForbiddenException({ code: ErrorCode.BUSINESS_RULE_VIOLATION, message });
  }
}

/* ---------- Company website ---------- */

const SCHEME_RE = /^([a-z][a-z0-9+.-]*):(?!\d)/i;

export type WebsiteParseResult = { ok: true; value: string | null } | { ok: false; message: string };

/** Only http(s) URLs with a real hostname; `javascript:`, `data:`, `file:` and other schemes are rejected. */
export function parseCompanyWebsite(raw: string | null | undefined): WebsiteParseResult {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return { ok: true, value: null };
  const invalid = { ok: false as const, message: 'Enter a valid website starting with http:// or https://.' };
  if (trimmed.length > 2048 || /\s/.test(trimmed)) return invalid;
  const scheme = trimmed.match(SCHEME_RE)?.[1]?.toLowerCase();
  if (scheme && scheme !== 'http' && scheme !== 'https') return invalid;
  const normalized = normalizeHttpUrl(trimmed);
  if (!normalized) return invalid;
  const url = new URL(normalized);
  if (url.username || url.password) return invalid;
  return { ok: true, value: normalized };
}

/* ---------- Job salary ---------- */

export function salaryRangeError(salaryMin?: number | null, salaryMax?: number | null): string | null {
  if (salaryMin != null && salaryMax != null && salaryMin > salaryMax) {
    return 'Minimum salary cannot be greater than maximum salary.';
  }
  return null;
}

/* ---------- Application status transitions ---------- */

/** Final outcomes: once hired, rejected, or withdrawn by the candidate, the employer cannot move the application. */
export const TERMINAL_APPLICATION_STATUSES = ['HIRED', 'REJECTED', 'WITHDRAWN'] as const;

/** Allowed employer moves. Stages cannot be skipped (e.g. APPLIED -> HIRED, SHORTLISTED -> SELECTED). */
export const APPLICATION_TRANSITIONS: Record<string, readonly string[]> = {
  APPLIED: ['UNDER_REVIEW', 'SHORTLISTED', 'ON_HOLD', 'REJECTED'],
  UNDER_REVIEW: ['SHORTLISTED', 'ON_HOLD', 'REJECTED'],
  SHORTLISTED: ['UNDER_REVIEW', 'INTERVIEW', 'ON_HOLD', 'REJECTED'],
  INTERVIEW: ['SELECTED', 'HIRED', 'ON_HOLD', 'REJECTED'],
  ON_HOLD: ['UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'SELECTED', 'REJECTED'],
  SELECTED: ['HIRED', 'INTERVIEW', 'REJECTED'],
};

const APPLICATION_STATUS_LABELS: Record<string, string> = {
  APPLIED: 'Applied',
  UNDER_REVIEW: 'Under review',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW: 'Interview',
  ON_HOLD: 'On hold',
  SELECTED: 'Selected',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

export function applicationTransitionError(from: string, to: string): string | null {
  if (from === to) return null;
  if (from === 'WITHDRAWN') return 'The candidate withdrew this application; its status can no longer be changed.';
  if ((TERMINAL_APPLICATION_STATUSES as readonly string[]).includes(from)) {
    return `This application is already ${from.toLowerCase()}; its status can no longer be changed.`;
  }
  if (!(APPLICATION_TRANSITIONS[from] || []).includes(to)) {
    const fromLabel = APPLICATION_STATUS_LABELS[from] || from;
    const toLabel = APPLICATION_STATUS_LABELS[to] || to;
    if (to === 'INTERVIEW') return 'Shortlist the candidate before scheduling an interview.';
    return `An application cannot move from ${fromLabel} to ${toLabel}. Complete the earlier stages first.`;
  }
  return null;
}

/* ---------- Employer interview lifecycle ---------- */

export const ACTIVE_INTERVIEW_STATUSES = [
  'PROPOSED',
  'SCHEDULED',
  'CONFIRMED',
  'RESCHEDULE_NEEDED',
  'RESCHEDULE_REQUESTED',
] as const;

/** Candidate asked for another time; the current scheduledAt is no longer agreed. */
export function isReschedulePending(status: string) {
  return status === 'RESCHEDULE_NEEDED' || status === 'RESCHEDULE_REQUESTED';
}

export type InterviewAction = 'confirm' | 'reschedule' | 'complete' | 'cancel' | 'notes';

const ACTION_TARGET: Record<Exclude<InterviewAction, 'notes' | 'reschedule' | 'confirm'>, string> = {
  complete: 'COMPLETED',
  cancel: 'CANCELLED',
};

/**
 * COMPLETED and CANCELLED are final: only notes may change. Repeating the same final action is a no-op.
 * Returns `'noop'` for an idempotent repeat, an error message for an invalid move, or null when allowed.
 */
export function interviewActionCheck(status: string, action: InterviewAction): 'noop' | string | null {
  if (action === 'notes') return null;
  if (action === 'confirm' && isReschedulePending(status)) {
    return 'The candidate asked for another time. Use Reschedule to set a new time within their availability.';
  }
  const isFinal = status === 'COMPLETED' || status === 'CANCELLED';
  if (!isFinal) return null;
  if ((action === 'complete' || action === 'cancel') && ACTION_TARGET[action] === status) return 'noop';
  return status === 'CANCELLED'
    ? 'This interview was cancelled and can no longer be changed. Schedule a new interview instead.'
    : 'This interview is already completed and can no longer be changed.';
}

export function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

const NAIVE_LOCAL_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/;

/** Timestamps without an offset are wall-clock times in India (Asia/Kolkata), not the server's UTC. */
export function parseInterviewInstant(raw: string | null | undefined): Date | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  const date = new Date(NAIVE_LOCAL_DATETIME_RE.test(value) ? `${value}+05:30` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/* ---------- Candidate reschedule availability (date + time window) ---------- */

export const DEFAULT_INTERVIEW_TIMEZONE = 'Asia/Kolkata';
const AVAILABILITY_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const AVAILABILITY_TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_AVAILABILITY_DAYS_AHEAD = 180;

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

function zoneOffsetMs(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - instant;
}

/** Wall-clock date + HH:MM in `timeZone` → UTC instant. */
export function zonedWallTimeToDate(date: string, time: string, timeZone: string) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - zoneOffsetMs(guess, timeZone);
  return new Date(guess - zoneOffsetMs(first, timeZone));
}

export type CandidateAvailability = {
  proposedDate: Date;
  availableFrom: Date;
  availableUntil: Date;
  timezone: string;
};

export function parseCandidateAvailability(
  input: { date?: unknown; availableFrom?: unknown; availableUntil?: unknown; timezone?: unknown },
  now = new Date(),
): { ok: true; value: CandidateAvailability } | { ok: false; message: string } {
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const date = text(input.date);
  const from = text(input.availableFrom);
  const until = text(input.availableUntil);
  if (!date || !from || !until) {
    return { ok: false, message: 'Select a date, an Available From time and an Available Until time.' };
  }
  const dateMatch = date.match(AVAILABILITY_DATE_RE);
  if (!dateMatch) return { ok: false, message: 'Enter a valid date.' };
  const [y, m, d] = [Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3])];
  const calendar = new Date(Date.UTC(y, m - 1, d));
  if (calendar.getUTCFullYear() !== y || calendar.getUTCMonth() !== m - 1 || calendar.getUTCDate() !== d) {
    return { ok: false, message: 'Enter a valid date.' };
  }
  if (!AVAILABILITY_TIME_RE.test(from) || !AVAILABILITY_TIME_RE.test(until)) {
    return { ok: false, message: 'Enter valid times for Available From and Available Until.' };
  }
  if (from >= until) {
    return { ok: false, message: 'Available From must be earlier than Available Until.' };
  }
  const timezone = text(input.timezone) || DEFAULT_INTERVIEW_TIMEZONE;
  if (!isValidTimeZone(timezone)) return { ok: false, message: 'Unsupported time zone.' };

  const availableFrom = zonedWallTimeToDate(date, from, timezone);
  const availableUntil = zonedWallTimeToDate(date, until, timezone);
  if (availableFrom.getTime() < now.getTime() - 60_000) {
    return { ok: false, message: 'Available From cannot be in the past.' };
  }
  if (availableFrom.getTime() > now.getTime() + MAX_AVAILABILITY_DAYS_AHEAD * 86_400_000) {
    return { ok: false, message: `Choose a date within the next ${MAX_AVAILABILITY_DAYS_AHEAD} days.` };
  }
  return { ok: true, value: { proposedDate: calendar, availableFrom, availableUntil, timezone } };
}

/** "3 April, 3:00 PM - 6:00 PM" */
export function formatAvailabilityWindow(from: Date, until: Date, timeZone = DEFAULT_INTERVIEW_TIMEZONE) {
  const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone }).format(from);
  const time = (value: Date) =>
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone })
      .format(value)
      .replace(/\s/g, ' ');
  const zoneSuffix = timeZone === DEFAULT_INTERVIEW_TIMEZONE || timeZone === 'Asia/Calcutta' ? '' : ` (${timeZone})`;
  return `${day}, ${time(from)} - ${time(until)}${zoneSuffix}`;
}

/* ---------- Employer notification preferences stored with the interview ---------- */

export type InterviewNotifyPrefs = { whatsapp: boolean; email: boolean };

const NOTIFY_MARKER_RE = /\[\[NOTIFY:whatsapp=(yes|no);email=(yes|no)\]\]/;
const LEGACY_WA_LINE_RE = /^WhatsApp notify: (yes|no)$/m;
const LEGACY_EMAIL_LINE_RE = /^Email notify: (yes|no)$/m;

export function parseNotifyPrefs(notes: string | null | undefined): InterviewNotifyPrefs {
  const text = notes || '';
  const marker = text.match(NOTIFY_MARKER_RE);
  if (marker) return { whatsapp: marker[1] === 'yes', email: marker[2] === 'yes' };
  return {
    whatsapp: text.match(LEGACY_WA_LINE_RE)?.[1] !== 'no',
    email: text.match(LEGACY_EMAIL_LINE_RE)?.[1] !== 'no',
  };
}

export function stripNotifyMarkers(notes: string | null | undefined): string {
  return (notes || '')
    .replace(NOTIFY_MARKER_RE, '')
    .replace(new RegExp(LEGACY_WA_LINE_RE.source, 'gm'), '')
    .replace(new RegExp(LEGACY_EMAIL_LINE_RE.source, 'gm'), '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function withNotifyPrefs(notes: string | null | undefined, prefs: InterviewNotifyPrefs): string {
  const base = stripNotifyMarkers(notes);
  const marker = `[[NOTIFY:whatsapp=${prefs.whatsapp ? 'yes' : 'no'};email=${prefs.email ? 'yes' : 'no'}]]`;
  return base ? `${base}\n${marker}` : marker;
}
