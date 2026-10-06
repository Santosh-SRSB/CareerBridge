import { CANDIDATE_EXPERIENCE_FILTERS, jobMatchesExperienceFilter, type JobCard } from '@careerbridge/shared';
import { getCitiesForState } from '@/data/india-locations';

export const JOB_FILTER_CHIPS = ['Salary', 'Experience', 'Job Type', 'Skills'] as const;
export type JobFilterChip = (typeof JOB_FILTER_CHIPS)[number];

export type SalaryPeriod = 'monthly' | 'ctc';

export type JobSearchFilterValues = {
  q: string;
  state: string;
  city: string;
  salaryMin: string;
  salaryMax: string;
  salaryPeriod: SalaryPeriod;
  experience: string;
  jobType: string;
  skills: string[];
};

export const EXPERIENCE_OPTIONS = CANDIDATE_EXPERIENCE_FILTERS.map(({ value, label }) => ({ value, label }));

export const JOB_TYPE_OPTIONS = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERNSHIP', label: 'Internship' },
] as const;

export function buildLocationQuery(state: string, city: string) {
  if (city.trim()) return city.trim();
  return '';
}

export function matchesExperience(jobExperience: string | null | undefined, filter: string) {
  if (!filter) return true;
  return jobMatchesExperienceFilter(jobExperience, filter);
}

/** Jobs store annual CTC; a monthly filter amount is converted to annual. */
export function toAnnualAmount(value: string, period: SalaryPeriod): number | undefined {
  const amount = Number(value.replace(/,/g, '').trim());
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  return period === 'monthly' ? amount * 12 : amount;
}

export function matchesSalary(
  job: JobCard,
  minRaw: string,
  maxRaw: string,
  period: SalaryPeriod,
) {
  const min = toAnnualAmount(minRaw, period) ?? null;
  const max = toAnnualAmount(maxRaw, period) ?? null;
  if (min == null && max == null) return true;

  const jobMin = job.salaryMin ?? 0;
  const jobMax = job.salaryMax ?? jobMin;

  if (min != null && jobMax < min) return false;
  if (max != null && jobMin > max) return false;
  return true;
}

export function matchesLocation(job: JobCard, state: string, city: string) {
  if (!state.trim()) return true;
  const jobCity = job.city.toLowerCase();

  if (city.trim()) {
    return jobCity.includes(city.trim().toLowerCase());
  }

  const stateCities = getCitiesForState(state).map((item) => item.toLowerCase());
  return stateCities.some((item) => item === jobCity || jobCity.includes(item) || item.includes(jobCity));
}

export function matchesSkills(job: JobCard, skills: string[]) {
  if (!skills.length) return true;
  const haystack = [...job.requiredSkills, ...job.preferredSkills].map((item) => item.toLowerCase());
  return skills.every((skill) => haystack.some((item) => item.includes(skill.toLowerCase())));
}

export function applyJobFilters(
  jobs: JobCard[],
  filters: JobSearchFilterValues,
  extras?: { experienceTextById?: Record<string, string | null> },
) {
  return jobs.filter((job) => {
    if (!matchesLocation(job, filters.state, filters.city)) return false;
    if (filters.jobType && job.jobType !== filters.jobType) return false;
    if (!matchesSalary(job, filters.salaryMin, filters.salaryMax, filters.salaryPeriod)) return false;
    const experienceText = extras?.experienceTextById?.[job.id] ?? job.experience ?? null;
    if (!matchesExperience(experienceText, filters.experience)) return false;
    if (!matchesSkills(job, filters.skills)) return false;
    return true;
  });
}
