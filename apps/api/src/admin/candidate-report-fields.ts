import { resolveCandidateExperienceBand } from '@careerbridge/shared';

export const FRESHER_LABEL = 'Fresher';
export const REPORT_EMPTY_VALUE = '—';

/** A mock interview counts as taken once it is COMPLETED (AI or human); the Candidate Progress chart uses the same rule. */
export const COMPLETED_MOCK_INTERVIEW_STATUS = 'COMPLETED';

/** Stored by resume profile sync when a parsed role had no title or company. */
const PLACEHOLDER_JOB_TITLE = 'role';
const PLACEHOLDER_COMPANY = 'company';

export type ReportCandidateRole = {
  jobTitle: string;
  company: string;
  isInternship: boolean;
  stillInCompany: boolean;
  startDate: Date | null;
  createdAt: Date;
};

export type ReportCandidateExperience = {
  hasExperience: string | null;
  experienceLevel: string | null;
  totalExperienceYears: number | null;
  totalExperienceMonths: number | null;
  experiences: ReportCandidateRole[];
};

function isFresher(candidate: ReportCandidateExperience): boolean {
  return resolveCandidateExperienceBand(candidate) === 'fresher';
}

function usableTitle(title: string | null | undefined): string | null {
  const trimmed = (title || '').trim();
  return trimmed && trimmed.toLowerCase() !== PLACEHOLDER_JOB_TITLE ? trimmed : null;
}

const time = (value: Date | null) => (value instanceof Date && !Number.isNaN(value.getTime()) ? value.getTime() : -Infinity);

const hasRealCompany = (role: ReportCandidateRole) => {
  const company = (role.company || '').trim().toLowerCase();
  return Boolean(company) && company !== PLACEHOLDER_COMPANY;
};

/**
 * "Fresher" for a fresher; otherwise the title of the current paid role (still in company), else the most
 * recently started one; for the same start a role with a real company wins over a resume-sync placeholder.
 * Null when an experienced candidate has no titled paid role.
 */
export function candidateCurrentPosition(candidate: ReportCandidateExperience): string | null {
  if (isFresher(candidate)) return FRESHER_LABEL;
  const roles = candidate.experiences
    .filter((r) => !r.isInternship && usableTitle(r.jobTitle))
    .sort(
      (a, b) =>
        Number(b.stillInCompany) - Number(a.stillInCompany) ||
        time(b.startDate) - time(a.startDate) ||
        Number(hasRealCompany(b)) - Number(hasRealCompany(a)) ||
        time(b.createdAt) - time(a.createdAt) ||
        a.jobTitle.trim().localeCompare(b.jobTitle.trim()),
    );
  return roles.length ? usableTitle(roles[0]!.jobTitle) : null;
}

/**
 * "Fresher" for a fresher; otherwise the profile's stored years + months as years, one decimal (the same
 * rounding the candidate profile shows). Null when an experienced candidate has no stored experience.
 */
export function candidateYearsOfExperience(candidate: ReportCandidateExperience): number | string | null {
  if (isFresher(candidate)) return FRESHER_LABEL;
  const total = (Number(candidate.totalExperienceYears) || 0) + (Number(candidate.totalExperienceMonths) || 0) / 12;
  if (!(total > 0)) return null;
  return Math.round(total * 10) / 10;
}

export function mockInterviewTaken(completed: { interviews: number; humanMockInterviews: number }): 'Yes' | 'No' {
  return completed.interviews > 0 || completed.humanMockInterviews > 0 ? 'Yes' : 'No';
}
