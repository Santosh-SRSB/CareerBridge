import type { ApplicationRecord, JobDetail, NearbyJobsResponse, PagedJobs } from '@careerbridge/shared';
import {
  applyToJob,
  confirmCandidateScheduledInterview,
  getApplication,
  getCandidateScheduledInterview,
  getJob,
  listApplications,
  listCandidateScheduledInterviews,
  listJobs,
  listNearbyJobs,
  rescheduleCandidateScheduledInterview,
  submitCandidateInterviewFeedback,
  type CandidateScheduledInterview,
} from '@/lib/api';
import {
  applyJobFilters,
  toAnnualAmount,
  type JobSearchFilterValues,
  type SalaryPeriod,
} from '@/features/jobs/job-search';

export type ScheduledJobInterview = CandidateScheduledInterview;

export type JobSearchParams = {
  q?: string;
  state?: string;
  city?: string;
  location?: string;
  category?: string;
  page?: number;
  pageSize?: number;
  salaryMin?: string;
  salaryMax?: string;
  salaryPeriod?: SalaryPeriod;
  experience?: string;
  jobType?: string;
  skills?: string[];
  sort?: 'newest' | 'salary';
};

function toFilterValues(params: JobSearchParams): JobSearchFilterValues {
  return {
    q: params.q || '',
    state: params.state || '',
    city: params.city || '',
    salaryMin: params.salaryMin || '',
    salaryMax: params.salaryMax || '',
    salaryPeriod: params.salaryPeriod || 'monthly',
    experience: params.experience || '',
    jobType: params.jobType || '',
    skills: params.skills || [],
  };
}

/** Live employer-posted jobs only — no demo fallbacks. */
export async function searchJobs(params: JobSearchParams = {}): Promise<PagedJobs> {
  const filters = toFilterValues(params);
  const apiLocation = params.city?.trim() || params.location?.trim() || '';

  const period = filters.salaryPeriod;

  const result = await listJobs({
    q: params.q,
    location: apiLocation || undefined,
    type: params.jobType,
    category: params.category,
    experience: params.experience || undefined,
    salaryMin: toAnnualAmount(filters.salaryMin, period),
    salaryMax: toAnnualAmount(filters.salaryMax, period),
    sort: params.sort,
    page: params.page,
    pageSize: params.pageSize || 50,
  });

  const filtered = applyJobFilters(result.items, filters);
  const clientNarrowed = filtered.length !== result.items.length;

  return {
    items: filtered,
    page: result.page,
    pageSize: result.pageSize,
    total: clientNarrowed ? filtered.length : result.total,
  };
}

export type NearbySearchParams = JobSearchParams & {
  latitude: number;
  longitude: number;
  minDistanceKm: number;
  maxDistanceKm: number;
  page?: number;
  limit?: number;
  remoteOnly?: boolean;
};

export async function searchNearbyJobs(params: NearbySearchParams): Promise<NearbyJobsResponse> {
  const period = params.salaryPeriod || 'monthly';
  return listNearbyJobs({
    latitude: params.latitude,
    longitude: params.longitude,
    minDistanceKm: params.minDistanceKm,
    maxDistanceKm: params.maxDistanceKm,
    page: params.page || 1,
    limit: params.limit || 20,
    q: params.q || undefined,
    type: params.jobType || undefined,
    category: params.category || undefined,
    experience: params.experience || undefined,
    salaryMin: toAnnualAmount(params.salaryMin || '', period),
    salaryMax: toAnnualAmount(params.salaryMax || '', period),
    skills: params.skills?.length ? params.skills : undefined,
    remoteOnly: params.remoteOnly || undefined,
  });
}

export async function fetchJobDetails(id: string): Promise<JobDetail> {
  return getJob(id);
}

export async function submitApplication(jobId: string, resumeId?: string): Promise<ApplicationRecord> {
  return applyToJob(jobId, resumeId);
}

export async function fetchApplications(): Promise<ApplicationRecord[]> {
  return listApplications();
}

export async function fetchApplication(id: string): Promise<ApplicationRecord> {
  return getApplication(id);
}

export async function fetchScheduledInterviews(): Promise<ScheduledJobInterview[]> {
  return listCandidateScheduledInterviews();
}

function interviewStartMs(item: ScheduledJobInterview) {
  const at = item.scheduledAt ? Date.parse(item.scheduledAt) : Number.NaN;
  return Number.isNaN(at) ? Date.parse(`${item.scheduledDate}T00:00:00`) : at;
}

export function isUpcomingInterview(item: ScheduledJobInterview, now = Date.now()) {
  if (item.status === 'COMPLETED' || item.status === 'CANCELLED') return false;
  const start = interviewStartMs(item);
  if (Number.isNaN(start)) return true;
  return start + (item.durationMin || 60) * 60_000 > now;
}

/** Cancelled but its slot has not passed yet — still shown with the upcoming interviews, disabled. */
export function isCancelledUpcomingInterview(item: ScheduledJobInterview, now = Date.now()) {
  if (item.status !== 'CANCELLED') return false;
  const start = interviewStartMs(item);
  if (Number.isNaN(start)) return false;
  return start + (item.durationMin || 60) * 60_000 > now;
}

export function sortInterviewsByTime(items: ScheduledJobInterview[], direction: 'asc' | 'desc' = 'asc') {
  const sign = direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => sign * (interviewStartMs(a) - interviewStartMs(b)));
}

export async function fetchScheduledInterview(id: string): Promise<ScheduledJobInterview> {
  return getCandidateScheduledInterview(id);
}

export async function confirmScheduledInterview(id: string): Promise<ScheduledJobInterview> {
  return confirmCandidateScheduledInterview(id);
}

export async function rescheduleScheduledInterview(
  id: string,
  payload?: { date: string; availableFrom: string; availableUntil: string; timezone?: string },
): Promise<ScheduledJobInterview> {
  return rescheduleCandidateScheduledInterview(id, payload);
}

export async function submitScheduledInterviewFeedback(
  id: string,
  payload: { rating: number; text?: string },
): Promise<ScheduledJobInterview> {
  return submitCandidateInterviewFeedback(id, payload);
}

export async function startMockInterview(payload: {
  jobRole: string;
  interviewType: 'GENERAL' | 'ROLE';
  questionCount: number;
}) {
  const { createMockInterviewSession } = await import('@/features/mock-interview/session');
  const session = createMockInterviewSession(payload);
  return { id: session.id, mode: 'mvp' as const };
}

export async function submitMockInterviewAnswerApi(
  id: string,
  answer: { text: string; hasAudio: boolean; audioDurationSec?: number },
) {
  const { submitMockInterviewAnswer } = await import('@/features/mock-interview/session');
  return submitMockInterviewAnswer(id, answer);
}

export async function fetchMockInterviewResult(id: string) {
  const { getMockInterviewResult } = await import('@/features/mock-interview/session');
  return getMockInterviewResult(id);
}
