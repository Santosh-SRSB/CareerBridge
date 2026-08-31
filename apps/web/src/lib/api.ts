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
  CreateCertificationPayload,
  CreateProjectPayload,
  EmployerApplication,
  EmployerDashboard,
  EmployerJobSummary,
  EmployerProfile,
  EmployerKycPayload,
  EmployerAffiliationPayload,
  InterviewSession,
  JobDetail,
  PagedJobs,
  ProfileCompletion,
  RequestOtpResult,
  ResumeRecord,
  SkillAssessmentAccess,
  SkillAssessmentSession,
  HumanMockSession,
  UpdateCandidatePayload,
  SavePassportPayload,
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
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isFormData) headers.set('Content-Type', 'application/json');
  if (options.auth !== false) {
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  }).catch(() => {
    throw new Error('Cannot reach the CareerBridge API. Make sure it is running on port 3001.');
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

export async function savePassport(payload: SavePassportPayload) {
  return request<CandidateProfile>('/candidates/me/passport', {
    method: 'PUT',
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

export async function addCertification(payload: CreateCertificationPayload) {
  return request<CandidateProfile>('/candidates/me/certifications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function removeCertification(id: string) {
  return request<CandidateProfile>(`/candidates/me/certifications/${id}`, {
    method: 'DELETE',
  });
}

export async function addProject(payload: CreateProjectPayload) {
  return request<CandidateProfile>('/candidates/me/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function removeProject(id: string) {
  return request<CandidateProfile>(`/candidates/me/projects/${id}`, {
    method: 'DELETE',
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

export type RecommendedCourse = {
  id: string;
  title: string;
  provider: string;
  instructor: string | null;
  level: string;
  duration: string;
  blurb: string;
  imageUrl: string | null;
  instructorImageUrl: string | null;
  priceLabel: string;
  strikeLabel: string | null;
  currency: string | null;
  url: string;
  matchedSkill: string;
  source: 'impact' | 'fallback';
};

export async function recommendedCourses(limit = 12) {
  return request<{
    configured: boolean;
    skills: string[];
    items: RecommendedCourse[];
  }>(`/courses/recommendations?limit=${limit}`);
}

export async function getJob(id: string) {
  return request<JobDetail>(`/jobs/${id}`, { auth: Boolean(getAccessToken()) });
}

export async function applyToJob(
  jobId: string,
  resumeId?: string,
  screeningAnswers?: Array<{ questionId: string; answer: string }>,
) {
  return request<ApplicationRecord>(`/jobs/${jobId}/applications`, {
    method: 'POST',
    body: JSON.stringify({ resumeId, screeningAnswers }),
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

export async function deleteResume(id: string) {
  return request<{ deleted: boolean }>(`/resumes/${id}`, { method: 'DELETE' });
}

export async function createResume(payload: {
  targetJobTitle?: string;
  title?: string;
  template?: string;
  includePhoto?: boolean;
  blank?: boolean;
  content?: Record<string, unknown>;
}) {
  return request<ResumeRecord>('/resumes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadResume(payload: {
  fileName?: string;
  targetJobTitle?: string;
  content: ResumeRecord['content'];
  rawText?: string;
  template?: string;
  includePhoto?: boolean;
}) {
  return request<ResumeRecord>('/resumes/upload', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function enhanceResume(id: string) {
  return request<ResumeRecord & { plans?: Array<{ id: string; label: string; amount: number; minScore: number; maxScore: number }> }>(
    `/resumes/${id}/enhance`,
    { method: 'POST' },
  );
}

export async function analyzeResumeRole(payload: {
  resumeId?: string;
  targetRole: string;
  jobDescription?: string;
  templateId?: string;
  resume?: Record<string, unknown>;
}) {
  return request<Record<string, unknown>>('/resumes/ats/analyze', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function rewriteResumeRole(payload: {
  resumeId?: string;
  targetRole: string;
  jobDescription?: string;
  templateId?: string;
  resume?: Record<string, unknown>;
  analysis?: Record<string, unknown> | null;
}) {
  return request<Record<string, unknown>>('/resumes/ats/rewrite', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function careerGuidance(payload: {
  resumeId?: string;
  resume?: Record<string, unknown>;
}) {
  return request<Record<string, unknown>>('/resumes/career-guidance', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function startResumeOptimization(id: string, planId: string) {
  return request<{
    id: string;
    sourceResumeId: string;
    resultResumeId: string | null;
    beforeScore: number;
    afterScore: number | null;
    improvement: number | null;
    factPreservation: number | null;
    improvements: string[];
    changes: Array<{
      section: string;
      originalText: string;
      suggestedText: string;
      reason: string;
      validation: string;
    }>;
    targetLabel: string;
  }>(`/resumes/${id}/optimizations`, {
    method: 'POST',
    body: JSON.stringify({ planId }),
  });
}

export async function listResumeVersions(id: string) {
  return request<ResumeRecord[]>(`/resumes/${id}/versions`);
}

export async function getResume(id: string) {
  return request<ResumeRecord>(`/resumes/${id}`);
}

export async function updateResume(
  id: string,
  payload: {
    title?: string;
    summary?: string;
    template?: string;
    targetJobTitle?: string;
    content?: Record<string, unknown>;
  },
) {
  return request<ResumeRecord>(`/resumes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function downloadResume(id: string) {
  return request<{ html?: string; pdf?: string; fileName: string; mimeType?: string }>(`/resumes/${id}/download`);
}

export function saveBase64File(content: string, fileName: string, mimeType: string) {
  const isHtml = mimeType.includes('html') || fileName.endsWith('.html');
  const blob = isHtml
    ? new Blob([content], { type: mimeType || 'text/html' })
    : (() => {
        const binary = atob(content);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
        }
        return new Blob([bytes], { type: mimeType });
      })();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function startInterview(jobRole: string, interviewType: string) {
  return request<InterviewSession>('/interviews', {
    method: 'POST',
    body: JSON.stringify({ jobRole, interviewType }),
  });
}

export async function createLiveInterview(payload: {
  jobRole?: string;
  interviewType: string;
  difficulty?: string;
  durationLimitMin: number;
  source: 'PASSPORT' | 'UPLOAD';
  content?: ResumeRecord['content'];
}) {
  return request<InterviewSession>('/interviews/live', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function startLiveInterview(id: string) {
  return request<InterviewSession>(`/interviews/${id}/start`, { method: 'POST' });
}

export async function answerLiveInterview(id: string, answer: string, durationSec?: number) {
  return request<InterviewSession>(`/interviews/${id}/answers`, {
    method: 'POST',
    body: JSON.stringify({ answer, durationSec }),
  });
}

export async function warnLiveInterview(
  id: string,
  payload: { type: string; message: string; severity: 'INFO' | 'WARNING' | 'HIGH' },
) {
  return request<InterviewSession>(`/interviews/${id}/warnings`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function endLiveInterview(id: string) {
  return request<InterviewSession>(`/interviews/${id}/end`, { method: 'POST' });
}

export async function downloadInterviewReport(id: string) {
  return request<{ pdf: string; fileName: string; mimeType: string }>(`/interviews/${id}/download-report`);
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

export async function startSkillAssessment() {
  return request<SkillAssessmentSession>('/assessments', { method: 'POST' });
}

export async function getSkillAssessmentAccess() {
  return request<SkillAssessmentAccess>('/assessments/access');
}

export async function unlockSkillAssessments() {
  return request<SkillAssessmentAccess>('/assessments/unlock', { method: 'POST' });
}

export async function getSkillAssessment(id: string) {
  return request<SkillAssessmentSession>(`/assessments/${id}`);
}

export async function listSkillAssessments() {
  return request<SkillAssessmentSession[]>('/assessments');
}

export async function answerSkillAssessment(
  id: string,
  payload: {
    selectedIndex?: number;
    text?: string;
    hasAudio?: boolean;
    hasVoice?: boolean;
    durationMs?: number;
    recording?: Blob;
  },
) {
  if (payload.recording) {
    const form = new FormData();
    if (payload.text) form.append('text', payload.text);
    form.append('hasAudio', String(Boolean(payload.hasAudio)));
    form.append('hasVoice', String(Boolean(payload.hasVoice)));
    form.append('durationMs', String(payload.durationMs || 0));
    form.append('recording', payload.recording, 'answer.webm');
    return request<SkillAssessmentSession>(`/assessments/${id}/respond`, {
      method: 'POST',
      body: form,
    });
  }
  return request<SkillAssessmentSession>(`/assessments/${id}/respond`, {
    method: 'POST',
    body: JSON.stringify({
      selectedIndex: payload.selectedIndex,
      text: payload.text,
      hasAudio: payload.hasAudio,
      hasVoice: payload.hasVoice,
      durationMs: payload.durationMs,
    }),
  });
}

export async function scheduleHumanMock(payload: {
  candidateName: string;
  candidateEmail: string;
  scheduledAt: string;
  interviewTrack: 'TECHNICAL' | 'NON_TECHNICAL';
}) {
  return request<HumanMockSession & { emailSent: boolean }>('/human-mocks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listHumanMocks() {
  return request<HumanMockSession[]>('/human-mocks');
}

export async function getHumanMock(id: string, token?: string) {
  const query = token ? `?token=${encodeURIComponent(token)}` : '';
  return request<HumanMockSession>(`/human-mocks/${id}${query}`, { auth: token ? false : true });
}

export async function joinHumanMock(id: string, role: 'candidate' | 'interviewer', token?: string) {
  return request<HumanMockSession>(`/human-mocks/${id}/join`, {
    method: 'POST',
    auth: token ? false : true,
    body: JSON.stringify({ role, token }),
  });
}

export async function postHumanSignal(
  id: string,
  payload: { role: 'candidate' | 'interviewer'; kind: 'offer' | 'answer' | 'ice'; payload: unknown; token?: string },
) {
  return request<{ ok: boolean }>(`/human-mocks/${id}/signal`, {
    method: 'POST',
    auth: payload.token ? false : true,
    body: JSON.stringify(payload),
  });
}

export async function peekHumanSignal(id: string, role: 'candidate' | 'interviewer', token?: string) {
  const query = new URLSearchParams({ role });
  if (token) query.set('token', token);
  return request<{ offer: unknown; answer: unknown; ice: unknown[] }>(`/human-mocks/${id}/signal?${query}`, {
    auth: token ? false : true,
  });
}

export async function completeHumanMock(
  id: string,
  payload: { durationMs: number; hadVideo: boolean; hadVoice: boolean; interviewerJoined: boolean; transcript?: string },
) {
  return request<HumanMockSession>(`/human-mocks/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify(payload),
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

export async function saveEmployerKyc(payload: EmployerKycPayload) {
  return request<EmployerProfile>('/employers/me/kyc', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export type GstVerifyResult = {
  success: boolean;
  verified: boolean;
  status: 'ACTIVE' | 'NOT_ACTIVE' | 'UNKNOWN';
  message?: string;
  requestId?: string;
};

/**
 * GST verify returns a business payload that already includes `success`,
 * so the API interceptor passes it through (not nested under `data`).
 */
export async function verifyGstin(gstin: string): Promise<GstVerifyResult> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_URL}/gst/verify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ gstin }),
  }).catch(() => {
    throw new Error('Cannot reach the CareerBridge API. Make sure it is running on port 3001.');
  });

  const body = (await response.json()) as
    | GstVerifyResult
    | ApiResponse<GstVerifyResult>
    | { success: false; error: { code: string; message: string } };

  if ('error' in body && body.success === false && body.error) {
    if (response.status === 401 && getRefreshToken()) {
      const refreshed = await refreshSession();
      if (refreshed) return verifyGstin(gstin);
    }
    const error = new Error(body.error.message) as Error & { code: string };
    error.code = body.error.code;
    throw error;
  }

  // Passthrough business payload
  if ('verified' in body && 'status' in body) {
    return body as GstVerifyResult;
  }

  // Envelope shape (future-safe)
  if ('data' in body && body.success && body.data) {
    return body.data;
  }

  throw new Error('Unable to verify GSTIN right now. Please try again.');
}

export async function submitEmployerVerification(payload: EmployerAffiliationPayload) {
  return request<EmployerProfile>('/employers/me/verification', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getEmployerDashboard() {
  return request<EmployerDashboard>('/employers/me/dashboard');
}

export async function listEmployerJobs() {
  return request<EmployerJobSummary[]>('/employers/jobs');
}

export async function getEmployerJob(id: string) {
  return request<EmployerJobSummary & Record<string, unknown>>(`/employers/jobs/${id}`);
}

export async function createEmployerJob(payload: Record<string, unknown>) {
  return request<{ id: string; title: string }>('/employers/jobs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateEmployerJob(id: string, payload: Record<string, unknown>) {
  return request(`/employers/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function saveEmployerJobSkillProfile(
  jobId: string,
  payload: { requiredSkills: string[]; educationMin?: string },
) {
  return request(`/employers/jobs/${jobId}/skill-profile`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function publishEmployerJob(id: string) {
  return request(`/employers/jobs/${id}/publish`, { method: 'POST' });
}

export async function pauseEmployerJob(id: string) {
  return request(`/employers/jobs/${id}/pause`, { method: 'POST' });
}

export async function closeEmployerJob(id: string) {
  return request(`/employers/jobs/${id}/close`, { method: 'POST' });
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
