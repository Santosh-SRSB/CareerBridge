import type { CandidateProfile } from '@careerbridge/shared';
import { buildMasterResume } from './build-master-resume';
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
    experienceList: draft.experienceList,
    educationList: draft.educationList,
    projectList: draft.projectList,
    certificationList: draft.certificationList,
    achievementList: draft.achievementList,
    linkedin: profile.links?.linkedin,
    github: profile.links?.github,
    portfolio: profile.links?.portfolio || profile.links?.website,
  });
}
