/** Experience bands (years). `max` is Infinity for open-ended bands such as "5+ yrs". */
export type ExperienceRange = { min: number; max: number };

/** Candidate-side job search experience filters. */
export const CANDIDATE_EXPERIENCE_FILTERS = [
  { value: 'fresher', label: 'Fresher', min: 0, max: 0 },
  { value: '0-1', label: '0–1 years', min: 0, max: 1 },
  { value: '1-2', label: '1–2 years', min: 1, max: 2 },
  { value: '2-5', label: '2–5 years', min: 2, max: 5 },
  { value: '5+', label: '5+ years', min: 5, max: Number.POSITIVE_INFINITY },
] as const;

/**
 * Parse an experience label ("Fresher", "0 - 1 Years", "2–5 yrs", "5+ yrs", "Less than 1 year")
 * into a numeric range. Returns null when the text has no usable requirement.
 */
export function parseExperienceRange(text: string | null | undefined): ExperienceRange | null {
  const raw = String(text || '').trim().toLowerCase();
  if (!raw || raw === 'none' || raw === 'any') return null;
  if (/fresher|no experience|entry level/.test(raw)) return { min: 0, max: 0 };
  if (/less than\s*1|under\s*1|<\s*1/.test(raw)) return { min: 0, max: 1 };
  const nums = (raw.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter((n) => Number.isFinite(n));
  if (!nums.length) return null;
  if (/\+|or more|and above|above/.test(raw)) return { min: nums[0], max: Number.POSITIVE_INFINITY };
  if (nums.length >= 2) {
    const [a, b] = nums;
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  return { min: nums[0], max: nums[0] };
}

export function experienceFilterRange(value: string | null | undefined): ExperienceRange | null {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return null;
  const option = CANDIDATE_EXPERIENCE_FILTERS.find((item) => item.value === key);
  if (option) return { min: option.min, max: option.max };
  return parseExperienceRange(key);
}

/**
 * True when a job's experience band fits a search band. Adjacent bands that only share an
 * endpoint ("0–1" vs "1–2") do not match; a point band (Fresher = 0) matches bands starting at 0.
 */
export function experienceRangesOverlap(job: ExperienceRange, filter: ExperienceRange): boolean {
  const jobPoint = job.min === job.max;
  const filterPoint = filter.min === filter.max;
  if (jobPoint && filterPoint) return job.min === filter.min;
  if (filterPoint) return job.min <= filter.min && filter.min < job.max;
  if (jobPoint) return filter.min <= job.min && job.min < filter.max;
  return job.min < filter.max && filter.min < job.max;
}

/** Job with no stated requirement matches every experience filter. */
export function jobMatchesExperienceFilter(jobExperience: string | null | undefined, filterValue: string) {
  const filter = experienceFilterRange(filterValue);
  if (!filter) return true;
  const job = parseExperienceRange(jobExperience);
  if (!job) return true;
  return experienceRangesOverlap(job, filter);
}

/**
 * Handbook experience fit (0–100): 100 inside the job's band, 50 when within one year of it
 * ("adjacent"), 25 when over-qualified by more than a year, 0 when short by more than a year.
 * Returns null when the job states no requirement.
 */
export function experienceFitPercent(candidateYears: number, jobExperience: string | null | undefined): number | null {
  const range = parseExperienceRange(jobExperience);
  if (!range) return null;
  const years = Math.max(0, Number.isFinite(candidateYears) ? candidateYears : 0);
  const upper = range.max === range.min && range.min === 0 ? 1 : range.max;
  if (years >= range.min && years <= upper) return 100;
  if (years < range.min) return range.min - years <= 1 ? 50 : 0;
  return years - upper <= 1 ? 50 : 25;
}
