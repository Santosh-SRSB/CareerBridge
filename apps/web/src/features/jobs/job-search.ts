import type { JobCard } from '@careerbridge/shared';
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

export const EXPERIENCE_OPTIONS = [
  { value: 'fresher', label: 'Fresher' },
  { value: '0-1', label: '0–1 years' },
  { value: '1-3', label: '1–3 years' },
  { value: '3-5', label: '3–5 years' },
  { value: '5+', label: '5+ years' },
] as const;

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
  const text = (jobExperience || '').toLowerCase();
  switch (filter) {
    case 'fresher':
      return text.includes('fresher') || text.includes('0') || text === '';
    case '0-1':
      return text.includes('0') || text.includes('1') || text.includes('fresher');
    case '1-3':
      return text.includes('1') || text.includes('2') || text.includes('3');
    case '3-5':
      return text.includes('3') || text.includes('4') || text.includes('5');
    case '5+':
      return text.includes('5') || text.includes('6') || text.includes('7');
    default:
      return true;
  }
}

function toMonthlyAmount(value: string, period: SalaryPeriod) {
  const amount = Number(value.replace(/,/g, '').trim());
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return period === 'ctc' ? Math.round(amount / 12) : amount;
}

export function matchesSalary(
  job: JobCard,
  minRaw: string,
  maxRaw: string,
  period: SalaryPeriod,
) {
  const min = toMonthlyAmount(minRaw, period);
  const max = toMonthlyAmount(maxRaw, period);
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
