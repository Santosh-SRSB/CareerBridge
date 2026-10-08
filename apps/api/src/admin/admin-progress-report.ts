import { interviewEndsAt } from './admin-interview-status';
import { POSTED_JOB_WHERE, SHORTLIST_REACHED_APPLICATION_STATUSES } from './employer-job-report';

/**
 * Candidate and employer progress for the Reports page. Every stage counts distinct people or
 * companies who reached it at least once (cumulative, like the hiring funnel); stages are measured
 * independently, so an optional step (e.g. a mock interview) can be lower than a later stage.
 */

/** Offered or agreed slots: once the slot has ended, the interview is treated as having taken place. */
const TIMED_INTERVIEW_STATUSES = ['PROPOSED', 'SCHEDULED', 'CONFIRMED'] as const;
export const FINAL_SELECTION_APPLICATION_STATUSES = ['SELECTED', 'HIRED'] as const;
export const JOINED_APPLICATION_STATUS = 'HIRED';
const HAPPENED_INTERVIEW_BATCH = 1000;

export type ProgressStage = {
  key: string;
  label: string;
  count: number;
  /** Share of the registered population, one decimal; null when nobody is registered. */
  percentOfRegistered: number | null;
  definition: string;
  /** Supporting volume for employer stages (jobs, interviews, candidates). */
  detail?: string;
};

export type ProgressReport = {
  generatedAt: string;
  registered: number;
  stages: ProgressStage[];
};

export type HappenedInterviewInput = {
  status: string;
  scheduledAt: Date | string;
  scheduledEnd?: Date | string | null;
  durationMin?: number | null;
  applicationStatus?: string | null;
};

/** Completed interviews, or offered/agreed slots that have ended on an application the candidate did not withdraw. */
export function interviewHappened(interview: HappenedInterviewInput, now: Date): boolean {
  const status = String(interview.status || '').toUpperCase();
  if (status === 'COMPLETED') return true;
  if (!(TIMED_INTERVIEW_STATUSES as readonly string[]).includes(status)) return false;
  if (String(interview.applicationStatus || '').toUpperCase() === 'WITHDRAWN') return false;
  return interviewEndsAt(interview).getTime() <= now.getTime();
}

export function percentOf(count: number, base: number): number | null {
  if (!base) return null;
  return Math.round((count / base) * 1000) / 10;
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

type CountDelegate = { count(args?: unknown): Promise<number> };
type ProgressPrisma = {
  candidate: CountDelegate;
  employer: CountDelegate;
  job: CountDelegate;
  application: CountDelegate;
  employerInterview: { findMany(args: unknown): Promise<unknown[]> };
};

type HappenedRow = {
  id: string;
  candidateId: string;
  employerId: string;
  status: string;
  scheduledAt: Date;
  scheduledEnd: Date | null;
  durationMin: number | null;
  application: { status: string } | null;
};

export type HappenedInterviews = { interviews: number; candidateIds: Set<string>; employerIds: Set<string> };

/** Loads only interview timing fields (never candidate data) in id-ordered batches. */
export async function loadHappenedInterviews(prisma: ProgressPrisma, now: Date): Promise<HappenedInterviews> {
  const out: HappenedInterviews = { interviews: 0, candidateIds: new Set(), employerIds: new Set() };
  let cursor: string | undefined;
  for (;;) {
    const batch = (await prisma.employerInterview.findMany({
      where: {
        OR: [
          { status: 'COMPLETED' },
          { status: { in: [...TIMED_INTERVIEW_STATUSES] }, scheduledAt: { lte: now } },
        ],
      },
      select: {
        id: true,
        candidateId: true,
        employerId: true,
        status: true,
        scheduledAt: true,
        scheduledEnd: true,
        durationMin: true,
        application: { select: { status: true } },
      },
      orderBy: { id: 'asc' },
      take: HAPPENED_INTERVIEW_BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })) as HappenedRow[];
    for (const row of batch) {
      if (!interviewHappened({ ...row, applicationStatus: row.application?.status }, now)) continue;
      out.interviews += 1;
      out.candidateIds.add(row.candidateId);
      out.employerIds.add(row.employerId);
    }
    if (batch.length < HAPPENED_INTERVIEW_BATCH) break;
    cursor = batch[batch.length - 1]!.id;
  }
  return out;
}

const KYC_COMPLETE_WHERE = { OR: [{ verificationStatus: { not: 'UNVERIFIED' } }, { verified: true }] };

export async function buildCandidateProgress(prisma: ProgressPrisma, now = new Date()): Promise<ProgressReport> {
  const [registered, onboarded, mock, applied, shortlisted, finalShortlisted, joined, happened] = await Promise.all([
    prisma.candidate.count(),
    prisma.candidate.count({ where: { onboardingCompleted: true } }),
    prisma.candidate.count({
      where: {
        OR: [
          { interviews: { some: { status: 'COMPLETED' } } },
          { humanMockInterviews: { some: { status: 'COMPLETED' } } },
        ],
      },
    }),
    prisma.candidate.count({ where: { applications: { some: {} } } }),
    prisma.candidate.count({
      where: { applications: { some: { status: { in: [...SHORTLIST_REACHED_APPLICATION_STATUSES] } } } },
    }),
    prisma.candidate.count({
      where: { applications: { some: { status: { in: [...FINAL_SELECTION_APPLICATION_STATUSES] } } } },
    }),
    prisma.candidate.count({ where: { applications: { some: { status: JOINED_APPLICATION_STATUS } } } }),
    loadHappenedInterviews(prisma, now),
  ]);
  const stage = (key: string, label: string, count: number, definition: string): ProgressStage => ({
    key,
    label,
    count,
    percentOfRegistered: percentOf(count, registered),
    definition,
  });
  return {
    generatedAt: now.toISOString(),
    registered,
    stages: [
      stage('ONBOARDED', 'Candidate Onboarded', onboarded, 'Finished candidate onboarding.'),
      stage('MOCK_INTERVIEW', 'Took Mock Interview', mock, 'Completed at least one AI or human mock interview.'),
      stage('APPLIED', 'Applied for Job', applied, 'Applied to at least one job.'),
      stage(
        'SHORTLISTED',
        'Shortlisted',
        shortlisted,
        'At least one application shortlisted or further (Shortlisted, On hold, Interview, Selected, Hired).',
      ),
      stage(
        'INTERVIEWED',
        'Interviewed',
        happened.candidateIds.size,
        'At least one employer interview completed, or an offered/agreed slot that has ended.',
      ),
      stage(
        'FINAL_SHORTLISTED',
        'Shortlisted (Final)',
        finalShortlisted,
        'At least one application Selected (offer stage) or Hired.',
      ),
      stage('JOINED', 'Joined', joined, 'At least one application marked Hired.'),
    ],
  };
}

export async function buildEmployerProgress(prisma: ProgressPrisma, now = new Date()): Promise<ProgressReport> {
  const finalStatuses = { in: [...FINAL_SELECTION_APPLICATION_STATUSES] };
  const [registered, onboarded, posted, jobsPosted, selecting, selections, hiring, hires, happened] =
    await Promise.all([
      prisma.employer.count(),
      prisma.employer.count({ where: KYC_COMPLETE_WHERE }),
      prisma.employer.count({ where: { jobs: { some: POSTED_JOB_WHERE } } }),
      prisma.job.count({ where: POSTED_JOB_WHERE }),
      prisma.employer.count({ where: { jobs: { some: { applications: { some: { status: finalStatuses } } } } } }),
      prisma.application.count({ where: { status: finalStatuses } }),
      prisma.employer.count({
        where: { jobs: { some: { applications: { some: { status: JOINED_APPLICATION_STATUS } } } } },
      }),
      prisma.application.count({ where: { status: JOINED_APPLICATION_STATUS } }),
      loadHappenedInterviews(prisma, now),
    ]);
  const stage = (key: string, label: string, count: number, definition: string, detail?: string): ProgressStage => ({
    key,
    label,
    count,
    percentOfRegistered: percentOf(count, registered),
    definition,
    ...(detail ? { detail } : {}),
  });
  return {
    generatedAt: now.toISOString(),
    registered,
    stages: [
      stage('ONBOARDED', 'Employer Onboarded', onboarded, 'Completed company KYC (required before posting jobs).'),
      stage(
        'REQUIREMENTS_POSTED',
        'Requirements Posted',
        posted,
        'Posted at least one job.',
        plural(jobsPosted, 'job') + ' posted',
      ),
      stage(
        'INTERVIEW_HAPPENED',
        'Interview Happened',
        happened.employerIds.size,
        'At least one interview completed, or an offered/agreed slot that has ended.',
        plural(happened.interviews, 'interview') + ' held',
      ),
      stage(
        'SELECTION_DONE',
        'Selection Done',
        selecting,
        'At least one candidate Selected or Hired.',
        plural(selections, 'selection'),
      ),
      stage(
        'CANDIDATES_ONBOARDED',
        'Candidates Onboarded',
        hiring,
        'At least one candidate marked Hired.',
        plural(hires, 'hire'),
      ),
    ],
  };
}
