import type { CandidateProfile, ResumeRecord } from '@careerbridge/shared';
import { parseLanguageSkills } from '@careerbridge/shared';
import type { ResumeWizardDraft } from './resume-wizard-draft';
import { mapResumeRecordToWizardSeed } from './resume-record-to-wizard';
import { splitProjectFields } from './project-fields';

const LANGUAGE_POOL = [
  'English',
  'Hindi',
  'Tamil',
  'Telugu',
  'Malayalam',
  'Kannada',
  'Bengali',
  'Marathi',
  'Gujarati',
  'Punjabi',
];

function newId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toMonthValue(value: string | null | undefined) {
  if (!value?.trim()) return '';
  const iso = value.trim();
  const monthMatch = iso.match(/^(\d{4})-(\d{2})/);
  if (monthMatch) return `${monthMatch[1]}-${monthMatch[2]}`;
  const yearMatch = iso.match(/^(\d{4})/);
  if (yearMatch) return `${yearMatch[1]}-01`;
  return '';
}

function splitBullets(text: string | null | undefined) {
  if (!text?.trim()) return [];
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
}

function locationFromProfile(profile: CandidateProfile) {
  return (
    [profile.city, profile.state].filter(Boolean).join(', ').trim() ||
    profile.preferredWorkCity?.trim() ||
    ''
  );
}

export function mapCandidateProfileToResumeWizard(
  profile: CandidateProfile,
): Omit<ResumeWizardDraft, 'savedAt' | 'flowPhase' | 'wizardIndex'> {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
  const location = locationFromProfile(profile);

  const educationList =
    profile.education.length > 0
      ? profile.education.map((edu) => ({
          id: edu.id || newId('edu'),
          degree: edu.qualification || '',
          field: edu.fieldOfStudy || '',
          institution: edu.institution || '',
          location: '',
          startDate: toMonthValue(edu.startDate),
          endDate: toMonthValue(edu.endDate) || (edu.yearCompleted ? `${edu.yearCompleted}-06` : ''),
          isCurrent: !edu.endDate && !edu.yearCompleted,
          grade: '',
          gradeType: '',
        }))
      : profile.highestEducation
        ? [
            {
              id: newId('edu'),
              degree: profile.highestEducation,
              field: '',
              institution: '',
              location: '',
              startDate: toMonthValue(profile.educationStart),
              endDate: toMonthValue(profile.educationEnd),
              isCurrent: Boolean(profile.stillInCollege),
              grade: '',
              gradeType: '',
            },
          ]
        : [];

  const experienceList = profile.experiences.map((exp) => ({
    id: exp.id || newId('exp'),
    role: exp.jobTitle || '',
    company: exp.company || '',
    location: '',
    startDate: toMonthValue(exp.startDate),
    endDate: toMonthValue(exp.endDate),
    isCurrent: Boolean(exp.stillInCompany || !exp.endDate),
    responsibilities: splitBullets(exp.description),
  }));

  const projectList = (profile.projects || []).map((project) => {
    const { description, bullets } = splitProjectFields({
      description: project.description,
      bullets: undefined,
    });
    return {
      id: project.id || newId('proj'),
      name: project.title || '',
      description,
      technologies: project.role ? [project.role] : [],
      bullets: [...bullets],
    };
  });

  const certificationList = (profile.certifications || []).map((cert) => ({
    id: cert.id || newId('cert'),
    name: cert.name || '',
    issuer: cert.issuer || '',
    date: cert.year ? `${cert.year}-01` : '',
  }));

  const parsedLanguages = parseLanguageSkills(profile.preferredLanguage);
  const languages =
    parsedLanguages.length > 0
      ? parsedLanguages.map((item) =>
          item.level ? `${item.name} (${item.level})` : item.name,
        )
      : profile.preferredLanguage?.trim()
        ? [profile.preferredLanguage.trim()]
        : [];

  const languageNames = new Set(
    languages.map((entry) => parseLanguageSkills(entry)[0]?.name || entry),
  );
  const availableLanguages = LANGUAGE_POOL.filter((name) => !languageNames.has(name));

  const skills = profile.skills.map((item) => item.name.trim()).filter(Boolean);

  return {
    fullName,
    location,
    email: profile.email || '',
    phone: profile.phone || '',
    summary: profile.about?.trim() || '',
    skills,
    educationList,
    experienceList,
    projectList,
    certificationList,
    achievementList: [],
    languages,
    availableLanguages,
    preferredRole: profile.careerInterests?.filter(Boolean).join(', ') || '',
    preferredLocation: profile.preferredWorkCity?.trim() || profile.city?.trim() || '',
    expectedSalary: '',
  };
}

function pickString(draftValue: string, profileValue: string) {
  return draftValue.trim() ? draftValue : profileValue;
}

function pickList<T>(draftList: T[], profileList: T[]) {
  return draftList.length > 0 ? draftList : profileList;
}

/** Fill empty resume wizard fields from profile without overwriting in-progress edits. */
export function mergeProfileSeedWithDraft(
  draft: Omit<ResumeWizardDraft, 'savedAt'>,
  profile: CandidateProfile,
): Omit<ResumeWizardDraft, 'savedAt'> {
  const seed = mapCandidateProfileToResumeWizard(profile);

  return {
    flowPhase: draft.flowPhase,
    wizardIndex: draft.wizardIndex,
    fullName: pickString(draft.fullName, seed.fullName),
    location: pickString(draft.location, seed.location),
    email: pickString(draft.email, seed.email),
    phone: pickString(draft.phone, seed.phone),
    summary: pickString(draft.summary, seed.summary),
    skills: pickList(draft.skills, seed.skills),
    educationList: pickList(draft.educationList, seed.educationList),
    experienceList: pickList(draft.experienceList, seed.experienceList),
    projectList: pickList(draft.projectList, seed.projectList),
    certificationList: pickList(draft.certificationList, seed.certificationList),
    achievementList: pickList(draft.achievementList, seed.achievementList),
    languages: pickList(draft.languages, seed.languages),
    availableLanguages:
      draft.languages.length > 0
        ? draft.availableLanguages.length > 0
          ? draft.availableLanguages
          : LANGUAGE_POOL.filter((name) => !draft.languages.includes(name))
        : seed.availableLanguages,
    preferredRole: pickString(draft.preferredRole, seed.preferredRole),
    preferredLocation: pickString(draft.preferredLocation, seed.preferredLocation),
    expectedSalary: pickString(draft.expectedSalary, seed.expectedSalary),
  };
}

function isSparseResumeSeed(seed: ReturnType<typeof mapResumeRecordToWizardSeed>) {
  return !(
    seed.educationList.length > 0 ||
    seed.experienceList.length > 0 ||
    seed.projectList.length > 0 ||
    seed.skills.length > 0 ||
    Boolean(seed.summary.trim())
  );
}

/**
 * Build wizard fields from candidate profile, optionally overlaying a saved resume.
 * Profile always fills gaps so passport data shows up in the form.
 */
export function buildWizardSeedFromCandidate(
  profile: CandidateProfile,
  resume?: ResumeRecord | null,
  options?: { flowPhase?: ResumeWizardDraft['flowPhase']; wizardIndex?: number },
): Omit<ResumeWizardDraft, 'savedAt'> {
  const flowPhase = options?.flowPhase ?? 'wizard';
  const wizardIndex = options?.wizardIndex ?? 0;
  const fromProfile = {
    flowPhase,
    wizardIndex,
    ...mapCandidateProfileToResumeWizard(profile),
  };

  if (!resume) return fromProfile;

  const fromResume = {
    flowPhase,
    wizardIndex,
    ...mapResumeRecordToWizardSeed(resume),
  };

  if (isSparseResumeSeed(fromResume)) {
    return fromProfile;
  }

  return mergeProfileSeedWithDraft(fromResume, profile);
}

export const RESUME_FROM_PROFILE_KEY = 'cb.resumeFromProfile';
