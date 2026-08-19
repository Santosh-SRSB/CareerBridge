import type {
  AdminDashboard,
  ApiResponse,
  ApplicationRecord,
  AuthSession,
  AuthUser,
  CandidateEducation,
  CandidateExperience,
  CandidateProfile,
  CandidateSkill,
  CreateEducationPayload,
  CreateExperiencePayload,
  CreateSkillPayload,
  EmployerApplication,
  EmployerDashboard,
  EmployerProfile,
  InterviewSession,
  JobDetail,
  PagedJobs,
  ProfileCompletion,
  RequestOtpResult,
  ResumeRecord,
  UpdateCandidatePayload,
  RequestOtpPayload,
  VerifyOtpResult,
} from '@careerbridge/shared';
import { getAccessToken, getRefreshToken, saveSession, clearSession } from './session';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

async function request<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (options.auth !== false) {
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const body = (await response.json()) as ApiResponse<T>;

  if (!body.success) {
    if (response.status === 401 && path !== '/auth/refresh' && getRefreshToken()) {
      const refreshed = await refreshSession();
      if (refreshed) {
        return request<T>(path, options);
      }
    }
    const error = new Error(body.error.message) as Error & { code: string };
    error.code = body.error.code;
    throw error;
  }

  return body.data;
}

export async function requestOtp(payload: RequestOtpPayload) {
  return request<RequestOtpResult>('/auth/otp/request', {
    method: 'POST',
    auth: false,
    body: JSON.stringify(payload),
  });
}

export async function loginWithPassword(
  identifier: string,
  password: string,
  accountType: 'CANDIDATE' | 'EMPLOYER' = 'CANDIDATE',
) {
  const session = await request<AuthSession>('/auth/login', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ identifier, password, accountType }),
  });
  saveSession(session);
  return session;
}

export async function verifyOtp(payload: {
  requestId: string;
  idToken?: string;
  otp?: string;
}) {
  const result = await request<VerifyOtpResult>('/auth/otp/verify', {
    method: 'POST',
    auth: false,
    body: JSON.stringify(payload),
  });
  if ('accessToken' in result) {
    saveSession(result);
  }
  return result;
}

export async function fetchMe() {
  return request<AuthUser & { type?: string; profileCompleted?: number; firstName?: string | null }>(
    '/auth/me',
  );
}

export async function getCandidateMe() {
  return request<CandidateProfile>('/candidates/me');
}

export async function getProfileCompletion() {
  return request<ProfileCompletion>('/candidates/me/completion');
}

export async function updateCandidateMe(payload: UpdateCandidatePayload) {
  return request<CandidateProfile>('/candidates/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function updatePreferences(payload: {
  careerInterests?: string[];
  openToRelocating?: boolean;
  preferredLanguage?: string;
}) {
  return request<CandidateProfile>('/candidates/me/preferences', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function addEducation(payload: CreateEducationPayload) {
  return request<CandidateProfile>('/candidates/me/education', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function removeEducation(id: string) {
  return request<CandidateProfile>(`/candidates/me/education/${id}`, {
    method: 'DELETE',
  });
}

export async function addSkill(payload: CreateSkillPayload) {
  return request<CandidateProfile>('/candidates/me/skills', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function removeSkill(id: string) {
  return request<CandidateProfile>(`/candidates/me/skills/${id}`, {
    method: 'DELETE',
  });
}

export async function addExperience(payload: CreateExperiencePayload) {
  return request<CandidateProfile>('/candidates/me/experience', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function removeExperience(id: string) {
  return request<CandidateProfile>(`/candidates/me/experience/${id}`, {
    method: 'DELETE',
  });
}

export async function listEducation() {
  return request<CandidateEducation[]>('/candidates/me/education');
}

export async function listSkills() {
  return request<CandidateSkill[]>('/candidates/me/skills');
}

export async function listExperience() {
  return request<CandidateExperience[]>('/candidates/me/experience');
}

export async function registerEmployer(payload: {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  industry: string;
  city: string;
  password: string;
}) {
  const session = await request<AuthSession>('/auth/employer/register', {
    method: 'POST',
    auth: false,
    body: JSON.stringify(payload),
  });
  saveSession(session);
  return session;
}

export async function listJobs(params: Record<string, string | number | undefined> = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const suffix = query.toString() ? `?${query}` : '';
  return request<PagedJobs>(`/jobs${suffix}`, { auth: Boolean(getAccessToken()) });
}

export async function recommendedJobs() {
  return request<PagedJobs>('/jobs/recommended');
}

export async function getJob(id: string) {
  return request<JobDetail>(`/jobs/${id}`, { auth: Boolean(getAccessToken()) });
}

export async function applyToJob(jobId: string, resumeId?: string) {
  return request<ApplicationRecord>(`/jobs/${jobId}/applications`, {
    method: 'POST',
    body: JSON.stringify({ resumeId }),
  });
}

export async function listApplications() {
  return request<ApplicationRecord[]>('/applications');
}

export async function getApplication(id: string) {
  return request<ApplicationRecord>(`/applications/${id}`);
}

export async function listResumes() {
  return request<ResumeRecord[]>('/resumes');
}

export async function createResume(payload: { targetJobTitle?: string; template?: string }) {
  return request<ResumeRecord>('/resumes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getResume(id: string) {
  return request<ResumeRecord>(`/resumes/${id}`);
}

export async function updateResume(id: string, payload: { title?: string; summary?: string; template?: string }) {
  return request<ResumeRecord>(`/resumes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function downloadResume(id: string) {
  return request<{ html: string; fileName: string }>(`/resumes/${id}/download`);
}

export async function startInterview(jobRole: string, interviewType: string) {
  return request<InterviewSession>('/interviews', {
    method: 'POST',
    body: JSON.stringify({ jobRole, interviewType }),
  });
}

export async function getInterview(id: string) {
  return request<InterviewSession>(`/interviews/${id}`);
}

export async function listInterviews() {
  return request<InterviewSession[]>('/interviews');
}

export async function answerInterview(id: string, answer: string) {
  return request<InterviewSession>(`/interviews/${id}/respond`, {
    method: 'POST',
    body: JSON.stringify({ answer }),
  });
}

export async function getEmployerMe() {
  return request<EmployerProfile>('/employers/me');
}

export async function updateEmployerMe(payload: Partial<EmployerProfile>) {
  return request<EmployerProfile>('/employers/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function getEmployerDashboard() {
  return request<EmployerDashboard>('/employers/me/dashboard');
}

export async function listEmployerJobs() {
  return request<Array<{ id: string; title: string; city: string; status: string }>>('/employers/jobs');
}

export async function createEmployerJob(payload: Record<string, unknown>) {
  return request('/employers/jobs', { method: 'POST', body: JSON.stringify(payload) });
}

export async function publishEmployerJob(id: string) {
  return request(`/employers/jobs/${id}/publish`, { method: 'POST' });
}

export async function listEmployerApplications(jobId: string) {
  return request<EmployerApplication[]>(`/employers/jobs/${jobId}/applications`);
}

export async function changeApplicationStatus(id: string, action: string) {
  return request(`/employers/applications/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}

export async function getAdminDashboard() {
  return request<AdminDashboard>('/admin/dashboard');
}

export async function getAdminList(path: string) {
  return request<unknown[]>(`/admin/${path}`);
}

export async function logout() {
  try {
    await request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: getRefreshToken() }),
    });
  } finally {
    clearSession();
  }
}

async function refreshSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearSession();
    return false;
  }
  try {
    const session = await request<AuthSession>('/auth/refresh', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ refreshToken }),
    });
    saveSession(session);
    return true;
  } catch {
    clearSession();
    return false;
  }
}
