import type { CandidateProfile } from '@careerbridge/shared';
import { buildMasterResume, type BuildMasterResumeInput } from './build-master-resume';
import type { MasterResumeDocument } from './master-resume.types';
import { mapCandidateProfileToResumeWizard } from './profile-to-resume-wizard';

export function buildResumeFromProfile(profile: CandidateProfile): MasterResumeDocument {
  const draft = mapCandidateProfileToResumeWizard(profile);

  return buildMasterResume({
    fullName: draft.fullName,
    location: draft.location,
    email: draft.email,
    phone: draft.phone,
    summary: draft.summary,
    skills: draft.skills,
    experienceList: draft.experienceList as BuildMasterResumeInput['experienceList'],
    educationList: draft.educationList as BuildMasterResumeInput['educationList'],
    projectList: draft.projectList as BuildMasterResumeInput['projectList'],
    certificationList: draft.certificationList as BuildMasterResumeInput['certificationList'],
    achievementList: draft.achievementList as BuildMasterResumeInput['achievementList'],
    languages: draft.languages
      .map((entry) => {
        const match = entry.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
        if (match) return { name: match[1].trim(), level: match[2].trim() };
        return { name: entry, level: '' };
      })
      .filter((item) => item.name.trim()),
    linkedin: profile.links?.linkedin,
    github: profile.links?.github,
    portfolio: profile.links?.portfolio || profile.links?.website,
  });
}
