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
  type CandidateScheduledInterview,
} from '@/lib/api';
import {
  applyJobFilters,
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

  const result = await listJobs({
    q: params.q,
    location: apiLocation || undefined,
    type: params.jobType,
    category: params.category,
    page: params.page,
    pageSize: params.pageSize || 50,
  });

  const filtered = applyJobFilters(result.items, filters);

  return {
    items: filtered,
    page: params.page || 1,
    pageSize: params.pageSize || 20,
    total: filtered.length,
  };
}

function monthlyAmount(value: string, period: SalaryPeriod) {
  const amount = Number(value.replace(/,/g, '').trim());
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  return period === 'ctc' ? Math.round(amount / 12) : amount;
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
    salaryMin: monthlyAmount(params.salaryMin || '', period),
    salaryMax: monthlyAmount(params.salaryMax || '', period),
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

export async function fetchScheduledInterview(id: string): Promise<ScheduledJobInterview> {
  return getCandidateScheduledInterview(id);
}

export async function confirmScheduledInterview(id: string): Promise<ScheduledJobInterview> {
  return confirmCandidateScheduledInterview(id);
}

export async function rescheduleScheduledInterview(
  id: string,
  _payload?: { preferredDate?: string; preferredTime?: string; reason?: string },
): Promise<ScheduledJobInterview> {
  return rescheduleCandidateScheduledInterview(id);
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
