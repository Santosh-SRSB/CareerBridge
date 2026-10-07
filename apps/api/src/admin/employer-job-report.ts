import { ACTIVE_JOB_STATUSES } from '../employers/employer-plan';
import {
  ADMIN_INTERVIEW_STATUS_LABELS,
  type AdminInterviewStatus,
  type AdminInterviewStatusInput,
  deriveAdminInterviewStatus,
} from './admin-interview-status';

/** Applications that reached the shortlist stage; the Reports funnel counts "Shortlisted" the same way. */
export const SHORTLIST_REACHED_APPLICATION_STATUSES = ['SHORTLISTED', 'ON_HOLD', 'INTERVIEW', 'SELECTED', 'HIRED'] as const;

/** Interview stages shown in the Employer Report, in display order. */
export const JOB_INTERVIEW_STATUS_ORDER: AdminInterviewStatus[] = [
  'INTERVIEW_SCHEDULED',
  'INTERVIEW_RESCHEDULED',
  'FEEDBACK_PENDING',
  'SELECTED',
  'REJECTED',
  'CANCELLED',
];

export const NO_INTERVIEW_LABEL = 'No Interview';

export const JOB_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Pending Review',
  PUBLISHED: 'Active',
  PAUSED: 'Paused',
  CLOSED: 'Closed',
};

const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

/** A job is a posted requirement once it has been published, or has left Draft. */
export const POSTED_JOB_WHERE = { OR: [{ publishedAt: { not: null } }, { status: { not: 'DRAFT' } }] } as const;

export type ReportJob = {
  status: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function isJobOpen(status: string): boolean {
  return (ACTIVE_JOB_STATUSES as readonly string[]).includes(status);
}

export function jobPostedAt(job: Pick<ReportJob, 'publishedAt' | 'createdAt'>): Date {
  return job.publishedAt ?? job.createdAt;
}

function validDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function istDayNumber(value: Date): number {
  return Math.floor((value.getTime() + IST_OFFSET_MS) / DAY_MS);
}

export function istDate(value: Date | null | undefined): string | null {
  return validDate(value) ? new Date(value.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10) : null;
}

/**
 * Whole India calendar days from the posted date. Open jobs count to `now`; a paused, closed or draft job
 * stops at its last update (the schema stores no closed date). Never negative; null for an unusable date.
 */
export function daysRequirementOpen(job: ReportJob, now = new Date()): number | null {
  const posted = jobPostedAt(job);
  if (!validDate(posted) || !validDate(now)) return null;
  let end = isJobOpen(job.status) ? now : job.updatedAt;
  if (!validDate(end) || end.getTime() > now.getTime()) end = now;
  return Math.max(0, istDayNumber(end) - istDayNumber(posted));
}

export type ReportInterview = NonNullable<AdminInterviewStatusInput['interview']> & {
  id: string;
  applicationId: string;
  createdAt: Date;
  applicationStatus: string | null;
};

/** Each candidate's latest interview on the job (an application can have a cancelled one and a new one). */
export function latestInterviewPerApplication<T extends ReportInterview>(interviews: T[]): T[] {
  const latest = new Map<string, T>();
  for (const iv of interviews) {
    const current = latest.get(iv.applicationId);
    if (
      !current ||
      iv.createdAt.getTime() > current.createdAt.getTime() ||
      (iv.createdAt.getTime() === current.createdAt.getTime() && iv.id > current.id)
    ) {
      latest.set(iv.applicationId, iv);
    }
  }
  return [...latest.values()];
}

export type JobInterviewSummary = {
  label: string;
  counts: Partial<Record<AdminInterviewStatus, number>>;
  interviewedCandidates: number;
};

/**
 * One Admin interview status per interviewed candidate (Phase 2 derivation on their latest interview),
 * summarised as counts in JOB_INTERVIEW_STATUS_ORDER, e.g. "2 Interview Scheduled, 1 Selected".
 */
export function summariseJobInterviews(
  interviews: ReportInterview[],
  rescheduledIds: Set<string>,
  now = new Date(),
): JobInterviewSummary {
  const counts: Partial<Record<AdminInterviewStatus, number>> = {};
  let interviewedCandidates = 0;
  for (const iv of latestInterviewPerApplication(interviews)) {
    const status = deriveAdminInterviewStatus({
      applicationStatus: iv.applicationStatus,
      interview: iv,
      employerRescheduled: rescheduledIds.has(iv.id),
      now,
    });
    if (!status) continue;
    interviewedCandidates += 1;
    counts[status] = (counts[status] ?? 0) + 1;
  }
  const parts = JOB_INTERVIEW_STATUS_ORDER.filter((s) => counts[s]).map(
    (s) => `${counts[s]} ${ADMIN_INTERVIEW_STATUS_LABELS[s]}`,
  );
  return { label: parts.length ? parts.join(', ') : NO_INTERVIEW_LABEL, counts, interviewedCandidates };
}

export type EmployerJobReportRow = {
  jobId: string;
  employerId: string;
  employerName: string;
  jobTitle: string;
  jobStatus: string;
  jobStatusLabel: string;
  postedDate: string | null;
  candidatesApplied: number;
  candidatesShortlisted: number;
  interviewStatus: string;
  interviewStatusCounts: Partial<Record<AdminInterviewStatus, number>>;
  daysOpen: number | null;
};

/** Newest posting first; ties broken by employer, job title and id so the order is stable. */
export function compareEmployerJobRows(a: EmployerJobReportRow, b: EmployerJobReportRow): number {
  return (
    (b.postedDate ?? '').localeCompare(a.postedDate ?? '') ||
    a.employerName.localeCompare(b.employerName) ||
    a.jobTitle.localeCompare(b.jobTitle) ||
    a.jobId.localeCompare(b.jobId)
  );
}
