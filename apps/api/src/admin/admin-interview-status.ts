/**
 * Admin-only display status for the Interviews page. Derived from Application.status,
 * EmployerInterview.status/timing and the employer reschedule audit trail; never stored.
 */
export const ADMIN_INTERVIEW_STATUSES = [
  'PROFILE_SHORTLISTED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW_RESCHEDULED',
  'FEEDBACK_PENDING',
  'SELECTED',
  'REJECTED',
  'CANCELLED',
] as const;

export type AdminInterviewStatus = (typeof ADMIN_INTERVIEW_STATUSES)[number];

export const ADMIN_INTERVIEW_STATUS_LABELS: Record<AdminInterviewStatus, string> = {
  PROFILE_SHORTLISTED: 'Profile Shortlisted',
  INTERVIEW_SCHEDULED: 'Interview Scheduled',
  INTERVIEW_RESCHEDULED: 'Interview Rescheduled',
  FEEDBACK_PENDING: 'Feedback Pending',
  SELECTED: 'Selected',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

/** Raw EmployerInterview statuses, still accepted by the list filter for API back-compat. */
export const RAW_EMPLOYER_INTERVIEW_STATUSES = [
  'PROPOSED',
  'SCHEDULED',
  'CONFIRMED',
  'RESCHEDULE_NEEDED',
  'RESCHEDULE_REQUESTED',
  'COMPLETED',
  'CANCELLED',
] as const;

const SELECTED_APPLICATION_STATUSES = new Set(['SELECTED', 'HIRED']);
/** Application statuses where the employer still owes an outcome after the interview. */
const AWAITING_OUTCOME_APPLICATION_STATUSES = new Set(['INTERVIEW', 'ON_HOLD']);
const CANDIDATE_RESCHEDULE_STATUSES = new Set(['RESCHEDULE_NEEDED', 'RESCHEDULE_REQUESTED']);
/** Statuses where a time is agreed or offered, so the slot passing means the interview should have happened. */
const TIMED_INTERVIEW_STATUSES = new Set(['PROPOSED', 'SCHEDULED', 'CONFIRMED']);
const DEFAULT_DURATION_MIN = 30;

export type AdminInterviewStatusInput = {
  applicationStatus: string | null | undefined;
  interview?: {
    status: string;
    scheduledAt: Date | string;
    scheduledEnd?: Date | string | null;
    durationMin?: number | null;
    candidateRescheduleRequestedAt?: Date | string | null;
  } | null;
  /** An INTERVIEW_RESCHEDULED audit row exists for this interview. */
  employerRescheduled?: boolean;
  now?: Date;
};

export function isAdminInterviewStatus(value: unknown): value is AdminInterviewStatus {
  return typeof value === 'string' && (ADMIN_INTERVIEW_STATUSES as readonly string[]).includes(value);
}

export function isRawEmployerInterviewStatus(value: unknown): boolean {
  return typeof value === 'string' && (RAW_EMPLOYER_INTERVIEW_STATUSES as readonly string[]).includes(value);
}

export function interviewEndsAt(interview: NonNullable<AdminInterviewStatusInput['interview']>): Date {
  if (interview.scheduledEnd) return new Date(interview.scheduledEnd);
  const start = new Date(interview.scheduledAt).getTime();
  const duration = interview.durationMin && interview.durationMin > 0 ? interview.durationMin : DEFAULT_DURATION_MIN;
  return new Date(start + duration * 60_000);
}

/**
 * Cancelled is kept apart from the flow. Otherwise priority is
 * Rejected > Selected > Feedback Pending > Interview Rescheduled > Interview Scheduled;
 * Profile Shortlisted applies only to a shortlisted application without an interview.
 * Returns null when the record does not belong on the Interviews page.
 */
export function deriveAdminInterviewStatus(input: AdminInterviewStatusInput): AdminInterviewStatus | null {
  const app = String(input.applicationStatus || '').toUpperCase();
  const interview = input.interview;

  if (!interview) {
    if (app === 'SHORTLISTED') return 'PROFILE_SHORTLISTED';
    if (app === 'REJECTED') return 'REJECTED';
    if (SELECTED_APPLICATION_STATUSES.has(app)) return 'SELECTED';
    return null;
  }

  const status = String(interview.status || '').toUpperCase();
  // A withdrawn application leaves its interview row untouched; the interview will not go ahead.
  if (status === 'CANCELLED' || app === 'WITHDRAWN') return 'CANCELLED';
  if (app === 'REJECTED') return 'REJECTED';
  if (SELECTED_APPLICATION_STATUSES.has(app)) return 'SELECTED';

  const now = input.now ?? new Date();
  const slotPassed = TIMED_INTERVIEW_STATUSES.has(status) && interviewEndsAt(interview).getTime() <= now.getTime();
  if (status === 'COMPLETED' || (slotPassed && AWAITING_OUTCOME_APPLICATION_STATUSES.has(app))) {
    return 'FEEDBACK_PENDING';
  }

  if (
    CANDIDATE_RESCHEDULE_STATUSES.has(status) ||
    input.employerRescheduled ||
    interview.candidateRescheduleRequestedAt
  ) {
    return 'INTERVIEW_RESCHEDULED';
  }
  return 'INTERVIEW_SCHEDULED';
}

export function adminInterviewStatusLabel(status: AdminInterviewStatus | null): string | null {
  return status ? ADMIN_INTERVIEW_STATUS_LABELS[status] : null;
}
