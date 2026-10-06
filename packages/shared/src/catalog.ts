import { PREFERRED_LANGUAGES } from './auth';
import { NON_TECH_JOB_CATEGORIES, TECH_JOB_CATEGORIES } from './marketplace';

/** Admin-managed reference lists (Admin → Settings). */
export const CATALOG_KINDS = ['JOB_CATEGORY', 'LOCATION_CITY', 'EXPERIENCE_LEVEL', 'LANGUAGE'] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

/** URL slug ↔ kind, used by GET /catalog/:slug and /admin/catalog/:slug. */
export const CATALOG_SLUGS: Record<string, CatalogKind> = {
  'job-categories': 'JOB_CATEGORY',
  locations: 'LOCATION_CITY',
  'experience-levels': 'EXPERIENCE_LEVEL',
  languages: 'LANGUAGE',
};

export const CATALOG_KIND_LABELS: Record<CatalogKind, string> = {
  JOB_CATEGORY: 'Job Categories',
  LOCATION_CITY: 'Locations',
  EXPERIENCE_LEVEL: 'Experience Levels',
  LANGUAGE: 'Languages',
};

export function catalogKindFromSlug(slug: string | null | undefined): CatalogKind | null {
  const key = String(slug || '').trim().toLowerCase();
  return CATALOG_SLUGS[key] ?? null;
}

export function catalogSlugForKind(kind: CatalogKind): string {
  return Object.entries(CATALOG_SLUGS).find(([, k]) => k === kind)?.[0] ?? kind.toLowerCase();
}

export type CatalogItem = {
  id: string;
  kind: CatalogKind;
  value: string;
  label: string;
  parentValue: string | null;
  sortOrder: number;
  active: boolean;
};

export type CatalogSeedItem = { value: string; label: string; parentValue?: string | null };

export const DEFAULT_EXPERIENCE_LEVELS: CatalogSeedItem[] = [
  { value: 'LT_1', label: 'Less than 1 year' },
  { value: '1_2', label: '1–2 years' },
  { value: '2_5', label: '2–5 years' },
  { value: '5_PLUS', label: '5+ years' },
];

export const DEFAULT_LANGUAGES: CatalogSeedItem[] = PREFERRED_LANGUAGES.map((name) => ({
  value: name,
  label: name,
}));

export const DEFAULT_JOB_CATEGORY_ITEMS: CatalogSeedItem[] = [
  ...TECH_JOB_CATEGORIES.map((name) => ({ value: name, label: name, parentValue: 'TECH' })),
  ...NON_TECH_JOB_CATEGORIES.map((name) => ({ value: name, label: name, parentValue: 'NON_TECH' })),
];

/** Candidate employment status (onboarding step 2). */
export const EMPLOYMENT_STATUSES = [
  { value: 'FRESHER', label: 'Fresher' },
  { value: 'EMPLOYED', label: 'Currently Employed' },
  { value: 'NOT_EMPLOYED', label: 'Not Currently Employed' },
  { value: 'STUDENT', label: 'Student' },
] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number]['value'];

/** Years-of-experience is asked only for statuses with work history. */
export function employmentStatusNeedsExperience(status: string | null | undefined): boolean {
  return status === 'EMPLOYED' || status === 'NOT_EMPLOYED';
}

export const ONBOARDING_MAX_JOB_CATEGORIES = 3;
export const ONBOARDING_MAX_JOB_CATEGORIES_MESSAGE = 'You can select up to 3 job categories';
export const CANDIDATE_MAX_SKILLS = 20;
export const CANDIDATE_MAX_SKILLS_MESSAGE = 'You have reached the maximum skill limit';
export const SALARY_RANGE_INVALID_MESSAGE = 'Please enter a valid salary range';
/** Monthly INR ceiling for expected salary inputs. */
export const EXPECTED_SALARY_MAX_INR = 10_000_000;

/**
 * Validates an optional expected salary range. Empty inputs are allowed; any provided value must be a
 * positive whole number within bounds, and min must be below max when both are given.
 */
export function validateExpectedSalaryRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  const provided = [min, max].filter((v) => v !== null && v !== undefined) as number[];
  for (const value of provided) {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0 || value > EXPECTED_SALARY_MAX_INR) {
      return SALARY_RANGE_INVALID_MESSAGE;
    }
  }
  if (min != null && max != null && min >= max) return SALARY_RANGE_INVALID_MESSAGE;
  return null;
}

export const ONBOARDING_STEP_LABELS: Record<number, string> = {
  1: 'Location',
  2: 'Employment status',
  3: 'Job preferences',
  4: 'Skills',
};

export function parseSkippedSteps(raw: unknown): number[] {
  let list: unknown = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return [...new Set(list.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 4))].sort((a, b) => a - b);
}
