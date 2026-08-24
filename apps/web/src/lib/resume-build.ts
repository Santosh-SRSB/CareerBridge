import type { CandidateProfile, ResumeContent } from '@careerbridge/shared';
import type { PassportDraft } from '@/types/passport';

export const RESUME_BUILD_KEY = 'cb.resumeBuild';

export type PendingResumeBuild = {
  template: string;
  photo: '0' | '1';
};

export function setPendingResumeBuild(payload: PendingResumeBuild) {
  sessionStorage.setItem(RESUME_BUILD_KEY, JSON.stringify(payload));
}

export function getPendingResumeBuild(): PendingResumeBuild | null {
  try {
    const raw = sessionStorage.getItem(RESUME_BUILD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingResumeBuild;
    if (!parsed?.template) return null;
    return { template: parsed.template, photo: parsed.photo === '1' ? '1' : '0' };
  } catch {
    return null;
  }
}

export function clearPendingResumeBuild() {
  sessionStorage.removeItem(RESUME_BUILD_KEY);
}

export function resumeBuildHref(payload: PendingResumeBuild) {
  return `/resume/build?template=${encodeURIComponent(payload.template)}&photo=${payload.photo}`;
}

export function profileToResumeContent(profile: CandidateProfile): ResumeContent {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || '';
  const interest = profile.careerInterests[0];
  const topSkill = profile.skills[0]?.name;
  const summaryBits = [
    fullName ? `${fullName} is building a career` : 'This candidate is building a career',
    interest ? `in ${interest}` : '',
    profile.city ? `from ${profile.city}` : '',
    topSkill ? `with strengths in ${topSkill}` : '',
  ].filter(Boolean);

  return {
    fullName,
    city: profile.city,
    phone: profile.phone,
    summary: summaryBits.join(' ') + '.',
    skills: profile.skills.map((item) => item.name),
    education: profile.education.map((item) => ({
      qualification: item.qualification,
      institution: item.institution,
      yearCompleted: item.yearCompleted,
    })),
    experiences: profile.experiences.map((item) => ({
      company: item.company,
      jobTitle: item.jobTitle,
      description: item.description,
      isInternship: item.isInternship,
    })),
    languages: profile.preferredLanguage ? [profile.preferredLanguage] : [],
  };
}

export function draftToResumeContent(draft: PassportDraft, extras?: { phone?: string | null; city?: string | null }): ResumeContent {
  const fullName = [draft.firstName, draft.lastName].filter(Boolean).join(' ');
  const interest = draft.careerInterests[0];
  const summary =
    draft.about ||
    [fullName ? `${fullName} is building a career` : '', interest ? `in ${interest}` : '', draft.city ? `from ${draft.city}` : '']
      .filter(Boolean)
      .join(' ');

  return {
    fullName,
    city: draft.city || extras?.city || null,
    phone: extras?.phone || null,
    summary,
    skills: draft.skills,
    education: draft.education
      .filter((item) => item.qualification)
      .map((item) => ({
        qualification: item.qualification,
        institution: item.institution || null,
        yearCompleted: Number.parseInt(item.yearCompleted, 10) || null,
      })),
    experiences: draft.experience
      .filter((item) => item.company || item.jobTitle || item.description)
      .map((item) => ({
        company: item.company,
        jobTitle: item.jobTitle,
        description: item.description || null,
        isInternship: item.isInternship,
      })),
    languages: [],
  };
}
