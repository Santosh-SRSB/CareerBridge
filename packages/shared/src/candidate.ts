export type CandidateProfile = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  city: string | null;
  preferredLanguage: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  openToRelocating: boolean;
  highestEducation: string | null;
  careerInterests: string[];
  hasExperience: string | null;
  profileCompletion: number;
  onboardingCompleted: boolean;
  education: CandidateEducation[];
  skills: CandidateSkill[];
  experiences: CandidateExperience[];
};

export type CandidateEducation = {
  id: string;
  qualification: string;
  institution: string | null;
  fieldOfStudy: string | null;
  yearCompleted: number | null;
};

export type CandidateSkill = {
  id: string;
  name: string;
};

export type CandidateExperience = {
  id: string;
  company: string;
  jobTitle: string;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  isInternship: boolean;
};

export type UpdateCandidatePayload = {
  fullName?: string;
  city?: string;
  preferredLanguage?: string;
  dateOfBirth?: string;
  gender?: string;
  openToRelocating?: boolean;
  highestEducation?: string;
  careerInterests?: string[];
  hasExperience?: string;
};

export type CreateEducationPayload = {
  qualification: string;
  institution?: string;
  fieldOfStudy?: string;
  yearCompleted?: number;
};

export type CreateSkillPayload = {
  name: string;
};

export type CreateExperiencePayload = {
  company: string;
  jobTitle: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  isInternship?: boolean;
};

export const EDUCATION_LEVELS = ['10th', '12th', 'Diploma', 'Graduate', 'Postgraduate', 'Other'] as const;

export const CAREER_INTERESTS = [
  'Customer Service',
  'Retail',
  'Technology',
  'Sales',
  'Office/Admin',
  'Delivery/Logistics',
] as const;

export const SUGGESTED_SKILLS = [
  'Communication',
  'Customer Service',
  'MS Excel',
  'Sales',
  'Data Entry',
] as const;

export const EXPERIENCE_OPTIONS = [
  { value: 'YES', label: 'Yes' },
  { value: 'NONE', label: 'No' },
  { value: 'INTERNSHIP', label: 'Internship / Apprenticeship' },
] as const;

export type PassportSectionKey =
  | 'personal'
  | 'education'
  | 'skills'
  | 'experience'
  | 'preferences'
  | 'languages'
  | 'certifications'
  | 'projects';

export type PassportSection = {
  key: PassportSectionKey;
  label: string;
  done: boolean;
  weight: number;
  why: string;
  href: string;
};

export type ProfileCompletion = {
  percentage: number;
  onboardingCompleted: boolean;
  sections: PassportSection[];
  missing: string[];
};

export const PASSPORT_SECTION_COPY: Record<
  PassportSectionKey,
  { label: string; why: string; href: string; weight: number }
> = {
  personal: {
    label: 'Personal Information',
    why: 'Employers need to know who you are and where you are based.',
    href: '/passport/personal',
    weight: 10,
  },
  education: {
    label: 'Education',
    why: 'Helps match you to roles that fit your qualification.',
    href: '/passport/education',
    weight: 15,
  },
  skills: {
    label: 'Skills',
    why: 'Makes your Career Passport searchable for the right jobs.',
    href: '/passport/skills',
    weight: 20,
  },
  experience: {
    label: 'Experience',
    why: 'Even internships and first jobs help employers understand what you can do.',
    href: '/passport/experience',
    weight: 20,
  },
  preferences: {
    label: 'Career Preferences',
    why: 'We use this to recommend work you actually want.',
    href: '/passport/preferences',
    weight: 15,
  },
  languages: {
    label: 'Languages',
    why: 'Helps employers know how you can communicate at work.',
    href: '/passport/personal',
    weight: 5,
  },
  certifications: {
    label: 'Certifications',
    why: 'Add certificates later to stand out for skilled roles.',
    href: '/passport',
    weight: 0,
  },
  projects: {
    label: 'Projects',
    why: 'Projects and volunteer work can fill gaps if you are just starting out.',
    href: '/passport',
    weight: 0,
  },
};
