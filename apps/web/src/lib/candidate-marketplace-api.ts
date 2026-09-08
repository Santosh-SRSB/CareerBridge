import type { ApplicationRecord, JobDetail, PagedJobs } from '@careerbridge/shared';
import {
  applyToJob,
  confirmCandidateScheduledInterview,
  getApplication,
  getCandidateScheduledInterview,
  getJob,
  listApplications,
  listCandidateScheduledInterviews,
  listJobs,
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
