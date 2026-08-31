import type { CandidateProfile, JobCard, ProfileCompletion } from '@careerbridge/shared';

export type HomePageData = {
  name: string;
  firstName: string;
  city: string;
  profile: CandidateProfile;
  completion: ProfileCompletion;
  jobs: JobCard[];
  resumeScore: number | null;
  interviewScore: number | null;
  hasResume: boolean;
  applicationsCount: number;
  headlineSkill?: string;
  headlineRole: string;
  passportId: string;
};
