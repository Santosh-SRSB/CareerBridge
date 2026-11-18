import { MASTER_JOB_ROLES } from './job-categories-and-skills';
import { NON_TECH_JOB_CATEGORIES, TECH_JOB_CATEGORIES } from './marketplace';

const BASE_JOB_ROLE_CATALOG: Record<string, string[]> = {
  IT: [
    'Full Stack Developer',
    'Frontend Developer',
    'Backend Developer',
    'Software Developer',
    'Software Engineer',
    'Data Analyst',
    'DevOps Engineer',
    'QA Engineer',
    'Mobile App Developer',
    'React Developer',
    'Java Developer',
    'Python Developer',
  ],
  FINANCE: ['Accountant', 'Financial Analyst', 'Accounts Executive', 'Auditor', 'Tax Consultant', 'Finance Executive'],
  HR: ['HR Executive', 'Talent Acquisition', 'HR Generalist', 'People Operations', 'Recruiter'],
  SALES: ['Sales Executive', 'Business Development Executive', 'Account Manager', 'Retail Associate'],
  MARKETING: ['Marketing Executive', 'Digital Marketing Executive', 'Content Marketer', 'Brand Executive'],
  GENERAL: ['Customer Service Executive', 'Front Office Executive', 'Business Analyst', 'Operations Executive'],
};

export function categorizeRole(role: string): keyof typeof BASE_JOB_ROLE_CATALOG {
  const blob = role.toLowerCase();
  // Non-IT hiring / BD / sales titles win over incidental IT keywords in a JD.
  if (
    /\b(talent acquisition|recruiter|recruitment|human resource|\bhr\b|business development|bde|bdm|sales executive|inside sales|field sales)\b/.test(
      blob,
    )
  ) {
    if (/\b(talent acquisition|recruiter|recruitment|human resource|\bhr\b)\b/.test(blob)) return 'HR';
    return 'SALES';
  }
  if (
    /\b(software|developer|engineer|devops|sre|qa|sdet|test automation|data scientist|data engineer|ml engineer|ai engineer|cloud|cyber|security|architect|scrum|cto|it support|ui\/ux|ux designer)\b/.test(
      blob,
    )
  ) {
    return 'IT';
  }
  if (/\b(finance|account|payroll|cfo|procurement|tax|audit)\b/.test(blob)) return 'FINANCE';
  if (/\b(hr|human resource|talent|recruit|chro)\b/.test(blob)) return 'HR';
  if (/\b(sales|business development|account manager|customer success|customer support)\b/.test(blob)) {
    return 'SALES';
  }
  if (/\b(market|seo|content|brand|copywriter)\b/.test(blob)) return 'MARKETING';
  return 'GENERAL';
}

/** Coarse hiring track used to keep IT talent pools off Non-IT jobs (and vice versa). */
export type CareerTrack = 'IT' | 'NON_IT';

const TECH_SKILL_RE =
  /\b(python|java|javascript|typescript|react|angular|vue|node\.?js|spring|django|flask|aws|azure|gcp|devops|docker|kubernetes|sql|mongodb|postgres|git|linux|c\+\+|golang|kotlin|swift|tensorflow|pytorch|machine learning|deep learning|ci\/cd|jenkins|gitlab|github actions|cloud computing)\b/gi;
const NON_TECH_SKILL_RE =
  /\b(sales|business development|recruitment|talent acquisition|staffing|hr generalist|payroll|accounting|bookkeeping|digital marketing|seo|content writing|customer service|retail|cashier|hospitality)\b/gi;

export function resolveCareerTrack(input: {
  title?: string | null;
  category?: string | null;
  interests?: string[];
  skills?: string[];
  experienceTitles?: string[];
}): CareerTrack {
  // Job title wins over a mis-tagged category (e.g. Talent Acquisition saved as Software Development).
  const titleCat = categorizeRole(String(input.title || ''));
  if (titleCat === 'HR' || titleCat === 'SALES' || titleCat === 'MARKETING' || titleCat === 'FINANCE') {
    return 'NON_IT';
  }
  if (titleCat === 'IT') return 'IT';

  const category = (input.category || '').trim();
  if ((TECH_JOB_CATEGORIES as readonly string[]).includes(category)) return 'IT';
  if ((NON_TECH_JOB_CATEGORIES as readonly string[]).includes(category)) return 'NON_IT';

  const blob = [
    input.title || '',
    ...(input.interests || []),
    ...(input.skills || []),
    ...(input.experienceTitles || []),
  ]
    .join(' ')
    .toLowerCase();

  const roleCat = categorizeRole(blob);
  if (roleCat === 'IT') return 'IT';
  if (roleCat === 'HR' || roleCat === 'SALES' || roleCat === 'MARKETING' || roleCat === 'FINANCE') {
    return 'NON_IT';
  }

  const techHits = (blob.match(TECH_SKILL_RE) || []).length;
  const nonTechHits = (blob.match(NON_TECH_SKILL_RE) || []).length;
  if (techHits >= 2 && techHits > nonTechHits) return 'IT';
  if (nonTechHits >= 1 && nonTechHits >= techHits) return 'NON_IT';
  return techHits >= 1 ? 'IT' : 'NON_IT';
}

/** Hard gate: IT jobs only show IT-track candidates; Non-IT jobs only show Non-IT-track candidates. */
export function careerTracksCompatible(
  job: { title?: string | null; category?: string | null },
  candidate: { interests?: string[]; skills?: string[]; experienceTitles?: string[] },
): boolean {
  const jobTrack = resolveCareerTrack({
    title: job.title,
    category: job.category,
  });
  const candidateTrack = resolveCareerTrack({
    interests: candidate.interests,
    skills: candidate.skills,
    experienceTitles: candidate.experienceTitles,
  });
  return jobTrack === candidateTrack;
}

/** Minimum skills points (of 80) required to appear in a job talent pool. */
export const MIN_JOB_MATCH_SKILLS_POINTS = 16;

/** Unapplied talent-pool rows must hit at least this many of role / skills / experience / JD. */
export const MIN_UNAPPLIED_MATCH_DIMENSIONS = 2;

export type JobMatchDimensionInput = {
  roleCompatible: boolean;
  skillsPoints: number;
  experiencePoints: number;
  /** Location / language / category / role-title signals from the live JD. */
  jdSignals?: boolean;
};

export type JobMatchDimensionHits = {
  role: boolean;
  skills: boolean;
  experience: boolean;
  jd: boolean;
  count: number;
};

/** Count which of role / skills / experience / JD matched for a candidate vs a job. */
export function jobMatchDimensionHits(input: JobMatchDimensionInput): JobMatchDimensionHits {
  const role = Boolean(input.roleCompatible);
  const skills = Number(input.skillsPoints || 0) > 0;
  const experience = Number(input.experiencePoints || 0) > 0;
  const jd = Boolean(input.jdSignals);
  return {
    role,
    skills,
    experience,
    jd,
    count: [role, skills, experience, jd].filter(Boolean).length,
  };
}

/**
 * Unapplied pool gate: same career track (IT↔Non-IT), real posted-JD skill overlap,
 * and at least 2 of role / skills / experience / JD.
 */
export function passesUnappliedJobMatch(input: JobMatchDimensionInput): boolean {
  const hits = jobMatchDimensionHits(input);
  if (!hits.role) return false;
  // Location-only / experience-only must not fill Unapplied for the wrong job family.
  if (!hits.skills) return false;
  return hits.count >= MIN_UNAPPLIED_MATCH_DIMENSIONS;
}

function mergeCatalog(): Record<string, string[]> {
  const out: Record<string, string[]> = {
    IT: [...BASE_JOB_ROLE_CATALOG.IT],
    FINANCE: [...BASE_JOB_ROLE_CATALOG.FINANCE],
    HR: [...BASE_JOB_ROLE_CATALOG.HR],
    SALES: [...BASE_JOB_ROLE_CATALOG.SALES],
    MARKETING: [...BASE_JOB_ROLE_CATALOG.MARKETING],
    GENERAL: [...BASE_JOB_ROLE_CATALOG.GENERAL],
  };
  const seen = new Set<string>();
  for (const list of Object.values(out)) {
    for (const role of list) seen.add(role.toLowerCase());
  }
  for (const role of MASTER_JOB_ROLES) {
    const key = role.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out[categorizeRole(role)].push(role);
  }
  return out;
}

export const JOB_ROLE_CATALOG: Record<string, string[]> = mergeCatalog();

export type JobRoleCategory = keyof typeof JOB_ROLE_CATALOG;

export type JobRolesResponse = {
  /** Curated catalogue grouped by category. */
  catalog: Record<string, string[]>;
  /** Distinct titles of currently published jobs, most common first. */
  fromJobs: string[];
};

export function detectRoleCategory(interests: string[]): JobRoleCategory {
  const blob = interests.join(' ').toLowerCase();
  if (/\b(it|software|developer|engineer|tech|data|qa|devops)\b/.test(blob)) return 'IT';
  if (/\b(finance|account|caf|tax|audit|banking)\b/.test(blob)) return 'FINANCE';
  if (/\b(hr|human resource|talent|recruit)\b/.test(blob)) return 'HR';
  if (/\b(sales|bdm|business development|retail)\b/.test(blob)) return 'SALES';
  if (/\b(market|digital|seo|content|brand)\b/.test(blob)) return 'MARKETING';
  return 'GENERAL';
}

/** Unique, trimmed role names in first-seen order (case-insensitive). */
export function uniqueRoles(roles: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of roles) {
    const role = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
    if (!role) continue;
    const key = role.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(role);
  }
  return out;
}
