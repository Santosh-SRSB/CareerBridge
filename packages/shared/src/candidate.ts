export type CandidateProfile = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  city: string | null;
  state?: string | null;
  preferredWorkCity?: string | null;
  phone: string | null;
  email: string | null;
  preferredLanguage: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  openToRelocating: boolean;
  highestEducation: string | null;
  stillInCollege?: boolean;
  educationStart?: string | null;
  educationEnd?: string | null;
  experienceLevel?: string | null;
  totalExperienceYears?: number;
  totalExperienceMonths?: number;
  gapReason?: string | null;
  gapMonths?: number | null;
  source?: string | null;
  about?: string | null;
  careerInterests: string[];
  hasExperience: string | null;
  profileCompletion: number;
  onboardingCompleted: boolean;
  whatsappOptIn?: boolean;
  whatsappNumber?: string | null;
  whatsappVerified?: boolean;
  education: CandidateEducation[];
  skills: CandidateSkill[];
  experiences: CandidateExperience[];
  certifications: CandidateCertification[];
  projects: CandidateProject[];
  photoUrl: string | null;
  links: CandidateLinks;
};

export type CandidateEducation = {
  id: string;
  qualification: string;
  institution: string | null;
  fieldOfStudy: string | null;
  yearCompleted: number | null;
  startDate?: string | null;
  endDate?: string | null;
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
  stillInCompany?: boolean;
};

export type CandidateCertification = {
  id: string;
  name: string;
  issuer: string | null;
  year: number | null;
  credentialId: string | null;
};

export type CandidateProject = {
  id: string;
  title: string;
  role: string | null;
  year: number | null;
  description: string | null;
  url: string | null;
};

export type CandidateLinks = {
  linkedin?: string;
  github?: string;
  portfolio?: string;
  website?: string;
};

const LINK_HOSTS: Record<keyof CandidateLinks, string[]> = {
  linkedin: ['linkedin.com'],
  github: ['github.com', 'github.io'],
  portfolio: [],
  website: [],
};

const LINK_MESSAGES: Record<keyof CandidateLinks, string> = {
  linkedin: 'LinkedIn must be a linkedin.com link.',
  github: 'GitHub must be a github.com link.',
  portfolio: 'Enter a valid portfolio website link.',
  website: 'Enter a valid website link.',
};

export function normalizeHttpUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function hostAllowed(hostname: string, allowed: string[]) {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  return allowed.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export function profileLinkError(kind: keyof CandidateLinks, value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const normalized = normalizeHttpUrl(trimmed);
  if (!normalized) return LINK_MESSAGES[kind];
  const allowed = LINK_HOSTS[kind];
  if (!allowed.length) return null;
  const host = new URL(normalized).hostname;
  if (!hostAllowed(host, allowed)) return LINK_MESSAGES[kind];
  return null;
}

export function profileLinkErrors(links: CandidateLinks) {
  const errors: Partial<Record<keyof CandidateLinks, string>> = {};
  (['linkedin', 'github', 'portfolio', 'website'] as const).forEach((key) => {
    const message = profileLinkError(key, links[key]);
    if (message) errors[key] = message;
  });
  return errors;
}

export type SavePassportPayload = {
  firstName: string;
  lastName?: string;
  city?: string;
  about?: string;
  careerInterests?: string[];
  stillInCollege?: boolean;
  educationStart?: string;
  educationEnd?: string;
  experienceLevel?: 'fresher' | 'experienced';
  totalExperienceYears?: string;
  totalExperienceMonths?: string;
  gapReason?: string;
  gapMonths?: number;
  source?: 'resume' | 'manual';
  skills?: string[];
  education?: {
    qualification: string;
    institution?: string;
    fieldOfStudy?: string;
    yearCompleted?: string;
    startDate?: string;
    endDate?: string;
  }[];
  experience?: {
    company?: string;
    jobTitle?: string;
    startDate?: string;
    endDate?: string;
    stillInCompany?: boolean;
    isInternship?: boolean;
    description?: string;
  }[];
  projects?: {
    title: string;
    role?: string;
    year?: number;
    description?: string;
    url?: string;
  }[];
};

export type UpdateCandidatePayload = {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  preferredWorkCity?: string;
  about?: string;
  preferredLanguage?: string;
  dateOfBirth?: string;
  gender?: string;
  openToRelocating?: boolean;
  highestEducation?: string;
  careerInterests?: string[];
  hasExperience?: string;
  totalExperienceYears?: string;
  totalExperienceMonths?: string;
  photoUrl?: string | null;
  links?: CandidateLinks;
  onboardingCompleted?: boolean;
  whatsappOptIn?: boolean;
  whatsappNumber?: string | null;
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

export type CreateCertificationPayload = {
  name: string;
  issuer?: string;
  year?: number;
  credentialId?: string;
};

export type CreateProjectPayload = {
  title: string;
  role?: string;
  year?: number;
  description?: string;
  url?: string;
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

export const ONBOARDING_DOMAINS = [
  'IT',
  'Non-IT',
  'Finance',
  'Healthcare',
  'Retail',
  'Operations',
  'Manufacturing',
  'Other',
] as const;

export type PassportSectionKey =
  | 'personal'
  | 'photo'
  | 'education'
  | 'skills'
  | 'experience'
  | 'preferences'
  | 'languages'
  | 'certifications'
  | 'projects'
  | 'links';

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

/** Sections shown on the candidate "My profile" overview (5 × 20% = 100%). */
export const PROFILE_OVERVIEW_SECTION_KEYS = [
  'personal',
  'education',
  'experience',
  'skills',
  'preferences',
] as const satisfies readonly PassportSectionKey[];

export const PROFILE_OVERVIEW_SECTION_WEIGHT = 20;
export const PROFILE_SKILLS_TARGET_COUNT = 3;

export function skillsOverviewPoints(skillCount: number, weight = PROFILE_OVERVIEW_SECTION_WEIGHT) {
  if (skillCount <= 0) return 0;
  if (skillCount >= PROFILE_SKILLS_TARGET_COUNT) return weight;
  return Math.round((skillCount / PROFILE_SKILLS_TARGET_COUNT) * weight);
}

export function computeProfileOverviewCompletion(
  sections: Pick<PassportSection, 'key' | 'done' | 'label'>[],
  skillCount: number,
) {
  let total = 0;
  for (const key of PROFILE_OVERVIEW_SECTION_KEYS) {
    if (key === 'skills') {
      total += skillsOverviewPoints(skillCount);
      continue;
    }
    const section = sections.find((item) => item.key === key);
    if (section?.done) total += PROFILE_OVERVIEW_SECTION_WEIGHT;
  }
  return Math.min(100, total);
}

export function profileOverviewMissingLabels(
  sections: Pick<PassportSection, 'key' | 'done' | 'label'>[],
  skillCount: number,
) {
  const missing: string[] = [];
  for (const key of PROFILE_OVERVIEW_SECTION_KEYS) {
    const section = sections.find((item) => item.key === key);
    if (!section) continue;
    if (key === 'skills') {
      if (skillCount < PROFILE_SKILLS_TARGET_COUNT) missing.push(section.label);
      continue;
    }
    if (!section.done) missing.push(section.label);
  }
  return missing;
}

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
  photo: {
    label: 'Photo',
    why: 'A clear photo helps employers recognise you.',
    href: '/passport/photo',
    weight: 0,
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
    href: '/passport/languages',
    weight: 5,
  },
  certifications: {
    label: 'Certifications',
    why: 'Add certificates later to stand out for skilled roles.',
    href: '/passport/certifications',
    weight: 8,
  },
  projects: {
    label: 'Projects',
    why: 'Projects and volunteer work can fill gaps if you are just starting out.',
    href: '/passport/projects',
    weight: 7,
  },
  links: {
    label: 'Links',
    why: 'Add LinkedIn, GitHub, or a portfolio so employers can see more of your work.',
    href: '/passport/links',
    weight: 0,
  },
};

export type LocationState = {
  id: string;
  name: string;
  code?: string | null;
};

export type LocationCity = {
  id: string;
  name: string;
  stateId: string;
};
