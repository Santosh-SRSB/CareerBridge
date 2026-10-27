/** Employer candidate-search filters (applied only within the job's unlocked match set). */

export const CANDIDATE_SEARCH_MAX_SKILLS = 10;

export const CANDIDATE_EDUCATION_FILTERS = [
  { value: 'any', label: 'Any', rank: 0 },
  { value: '10th', label: '10th / Secondary', rank: 1 },
  { value: '12th', label: '12th / Higher Secondary', rank: 2 },
  { value: 'diploma', label: 'Diploma / ITI', rank: 3 },
  { value: 'graduate', label: 'Any Graduate', rank: 4 },
  { value: 'postgraduate', label: 'Postgraduate', rank: 5 },
] as const;

export const CANDIDATE_AVAILABILITY_FILTERS = [
  { value: 'immediate', label: 'Immediate' },
  { value: 'notice', label: 'Serving notice' },
  { value: 'student', label: 'Student' },
] as const;

export const CANDIDATE_SEARCH_SORTS = [
  { value: 'match', label: 'Best Match' },
  { value: 'recent', label: 'Most Recent' },
  { value: 'experience', label: 'Experience (High to Low)' },
] as const;

export type CandidateSearchSort = (typeof CANDIDATE_SEARCH_SORTS)[number]['value'];

/** Rank free-text highest education (0 = unknown). */
export function educationRank(text: string | null | undefined): number {
  const raw = String(text || '').toLowerCase();
  if (!raw.trim()) return 0;
  if (/doctor|ph\.?\s*d/.test(raw)) return 6;
  if (/master|post\s*grad|\bpg\b|m\.?\s*b\.?\s*a|m\.?\s*c\.?\s*a|m\.?\s*tech|m\.?\s*sc|m\.?\s*com|\bm\.?\s*e\b|\bm\.?\s*a\b/.test(raw)) {
    return 5;
  }
  if (/bachelor|graduat|degree|b\.?\s*tech|b\.?\s*sc|b\.?\s*com|b\.?\s*b\.?\s*a|b\.?\s*c\.?\s*a|\bb\.?\s*e\b|\bb\.?\s*a\b|mbbs|llb/.test(raw)) {
    return 4;
  }
  if (/diploma|iti|polytechnic/.test(raw)) return 3;
  if (/12|higher secondary|hsc|puc|intermediate|plus two/.test(raw)) return 2;
  if (/10|secondary|sslc|matric/.test(raw)) return 1;
  return 0;
}

export function meetsEducationFilter(text: string | null | undefined, filterValue: string | null | undefined) {
  const option = CANDIDATE_EDUCATION_FILTERS.find((item) => item.value === filterValue);
  if (!option || option.rank === 0) return true;
  return educationRank(text) >= option.rank;
}

/** Latest pass-out / graduation year from education rows or educationEnd (YYYY…). */
export function candidatePassOutYear(candidate: {
  educationEnd?: string | null;
  education?: Array<{ yearCompleted?: number | null }>;
}): number | null {
  const years: number[] = [];
  for (const row of candidate.education || []) {
    const y = Number(row.yearCompleted);
    if (Number.isFinite(y) && y >= 1950 && y <= 2100) years.push(Math.trunc(y));
  }
  const end = String(candidate.educationEnd || '').trim();
  const match = end.match(/^(19|20)\d{2}/);
  if (match) {
    const y = Number(match[0]);
    if (y >= 1950 && y <= 2100) years.push(y);
  }
  if (!years.length) return null;
  return Math.max(...years);
}

function normalizePassOutBound(value: number | string | null | undefined): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

/**
 * Optional pass-out year filter.
 * - Exact year when `filterValue` is a single year (legacy).
 * - Inclusive range when `from` / `to` are provided (either bound optional).
 * Missing candidate year fails only when a filter bound is active.
 */
export function meetsPassOutYearFilter(
  year: number | null | undefined,
  filterValue?: number | string | null,
  range?: { from?: number | string | null; to?: number | string | null },
) {
  let from = normalizePassOutBound(range?.from);
  let to = normalizePassOutBound(range?.to);
  const exact = normalizePassOutBound(filterValue);

  if (from === null && to === null && exact === null) return true;
  if (year == null || !Number.isFinite(year)) return false;

  if (from !== null && to !== null && from > to) {
    const swap = from;
    from = to;
    to = swap;
  }

  const y = Math.trunc(year);
  if (from !== null || to !== null) {
    if (from !== null && y < from) return false;
    if (to !== null && y > to) return false;
    return true;
  }
  return y === exact;
}

/** True when a notice-period answer means available immediately (not "30 days"). */
export function isImmediateAvailabilityAnswer(raw: string | null | undefined): boolean {
  const lower = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!lower) return false;
  if (/^(immediate|asap|available now|joining immediately|can join immediately)$/.test(lower)) {
    return true;
  }
  // "0", "0 day(s)", "0 week(s)", "0 month(s)" — must not match inside "30 days"
  return /^(0|nil|none)(\s*(days?|weeks?|months?))?$/.test(lower);
}
