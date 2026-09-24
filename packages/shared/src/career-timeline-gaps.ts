/**
 * Timeline career-gap detection for freshers and experienced candidates.
 * Gaps are flagged only when uncovered days are STRICTLY greater than 30.
 * Deterministic — no AI.
 */

export const CAREER_GAP_THRESHOLD_DAYS = 30;

export const CAREER_GAP_REASONS = [
  'JOB_SEARCH',
  'HIGHER_EDUCATION',
  'CERTIFICATION_TRAINING',
  'FREELANCING',
  'BUSINESS',
  'RELOCATION',
  'PERSONAL_FAMILY',
  'HEALTH_BREAK',
  'OTHER',
] as const;

export type CareerGapReasonCode = (typeof CAREER_GAP_REASONS)[number];

export const CAREER_GAP_REASON_LABELS: Record<CareerGapReasonCode, string> = {
  JOB_SEARCH: 'Job Search',
  HIGHER_EDUCATION: 'Higher Education',
  CERTIFICATION_TRAINING: 'Certification / Training',
  FREELANCING: 'Freelancing',
  BUSINESS: 'Business / Entrepreneurship',
  RELOCATION: 'Relocation',
  PERSONAL_FAMILY: 'Personal / Family Reasons',
  HEALTH_BREAK: 'Health Break',
  OTHER: 'Other',
};

export type TimelineActivityInput = {
  id?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  stillInCompany?: boolean;
  isCurrent?: boolean;
};

export type DetectedTimelineGap = {
  gapStartDate: string;
  gapEndDate: string;
  gapDays: number;
  previousActivityId: string | null;
  nextActivityId: string | null;
};

export type TimelineGapAnalysis = {
  totalGaps: number;
  totalGapDays: number;
  totalGapDuration: string;
  gaps: DetectedTimelineGap[];
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Exact calendar-day difference (non-negative). */
export function daysBetweenDates(from: Date, to: Date) {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)));
}

export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = match[3] ? Number(match[3]) : 1;
  if (!Number.isFinite(year) || month < 0 || month > 11) return null;
  return startOfDay(new Date(year, month, day));
}

/**
 * Resolve an education completion date.
 * YYYY-MM → last day of that month; YYYY only → 30 June of that year.
 */
export function resolveEducationEndDate(input: {
  endDate?: string | null;
  yearCompleted?: number | string | null;
  stillStudying?: boolean;
}): Date | null {
  if (input.stillStudying) return null;
  if (input.endDate?.trim()) {
    const trimmed = input.endDate.trim();
    const monthOnly = trimmed.match(/^(\d{4})-(\d{2})$/);
    if (monthOnly) {
      const year = Number(monthOnly[1]);
      const monthIndex = Number(monthOnly[2]) - 1;
      return startOfDay(new Date(year, monthIndex + 1, 0));
    }
    return parseIsoDate(trimmed);
  }
  if (input.yearCompleted != null && String(input.yearCompleted).trim()) {
    const year = Number(String(input.yearCompleted).trim().slice(0, 4));
    if (Number.isFinite(year) && year >= 1970) {
      return startOfDay(new Date(year, 5, 30));
    }
  }
  return null;
}

type InternalRange = {
  id: string | null;
  start: Date;
  end: Date;
};

function resolveActivityRange(row: TimelineActivityInput, now: Date): InternalRange | null {
  const start = parseIsoDate(row.startDate || undefined);
  if (!start) return null;
  const current = Boolean(row.stillInCompany || row.isCurrent);
  const end = current ? startOfDay(now) : parseIsoDate(row.endDate || undefined);
  if (!end) return null;
  const from = startOfDay(start);
  const to = startOfDay(end);
  if (to < from) return { id: row.id || null, start: from, end: from };
  return { id: row.id || null, start: from, end: to };
}

/**
 * Merge overlapping / contiguous ranges. Contiguous = next.start <= prev.end
 * (same-day handoff or overlap collapses into one covered span).
 */
export function mergeActivityRanges(ranges: InternalRange[]): InternalRange[] {
  const sorted = [...ranges].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: InternalRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) {
      merged.push({ ...range });
      continue;
    }
    if (range.end > last.end) {
      last.end = range.end;
    }
  }
  return merged;
}

/**
 * Format exact day counts into a stable human-readable duration.
 * Convention: 30 days ≈ 1 month for display only (calculation stays in exact days).
 */
export function formatGapDurationFromDays(totalDays: number): string {
  const days = Math.max(0, Math.floor(totalDays));
  if (days <= 0) return '0 days';
  if (days < 30) return days === 1 ? '1 day' : `${days} days`;

  const years = Math.floor(days / 365);
  let rem = days % 365;
  const months = Math.floor(rem / 30);
  rem = rem % 30;

  const parts: string[] = [];
  if (years) parts.push(years === 1 ? '1 year' : `${years} years`);
  if (months) parts.push(months === 1 ? '1 month' : `${months} months`);
  if (rem) parts.push(rem === 1 ? '1 day' : `${rem} days`);
  if (!parts.length) return days === 1 ? '1 day' : `${days} days`;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} ${parts[1]}`;
  return `${parts[0]} ${parts[1]} ${parts[2]}`;
}

export function formatGapDateRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) => {
    const d = parseIsoDate(iso);
    if (!d) return iso;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };
  return `${fmt(startIso)} – ${fmt(endIso)}`;
}

function pushGapIfSignificant(
  gaps: DetectedTimelineGap[],
  from: Date,
  to: Date,
  thresholdDays: number,
  previousActivityId: string | null,
  nextActivityId: string | null,
) {
  if (to <= from) return;
  const gapDays = daysBetweenDates(from, to);
  if (gapDays <= thresholdDays) return;
  gaps.push({
    gapStartDate: toIsoDate(from),
    gapEndDate: toIsoDate(to),
    gapDays,
    previousActivityId,
    nextActivityId,
  });
}

/**
 * Detect career gaps for freshers and experienced candidates.
 *
 * Includes:
 * - Gaps between employment / internship activities (overlaps collapsed)
 * - Gap from education completion → first activity (or → today if fresher with no jobs)
 * - Gap from last activity end → today when not currently employed
 *
 * Does NOT create a trailing gap after a current/present role.
 * Only gaps with gapDays > threshold (default 30) are returned.
 */
export function computeTimelineCareerGaps({
  activities,
  educationEndDate = null,
  stillStudying = false,
  now = new Date(),
  thresholdDays = CAREER_GAP_THRESHOLD_DAYS,
}: {
  activities: TimelineActivityInput[];
  /** Highest / latest education completion date (ISO or YYYY-MM). */
  educationEndDate?: string | null;
  stillStudying?: boolean;
  now?: Date;
  thresholdDays?: number;
}): TimelineGapAnalysis {
  const today = startOfDay(now);
  const resolved = (activities || [])
    .map((row) => resolveActivityRange(row, now))
    .filter((row): row is InternalRange => Boolean(row))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged = mergeActivityRanges(resolved);
  const gaps: DetectedTimelineGap[] = [];

  const eduEnd =
    stillStudying
      ? null
      : resolveEducationEndDate({ endDate: educationEndDate, stillStudying: false });

  // Fresher with no employment: education end → today
  if (!merged.length) {
    if (eduEnd && eduEnd < today) {
      pushGapIfSignificant(gaps, eduEnd, today, thresholdDays, null, null);
    }
    const totalGapDays = gaps.reduce((sum, g) => sum + g.gapDays, 0);
    return {
      totalGaps: gaps.length,
      totalGapDays,
      totalGapDuration: formatGapDurationFromDays(totalGapDays),
      gaps,
    };
  }

  // Education → first job/internship (if education ended before first activity)
  if (eduEnd && eduEnd < merged[0].start) {
    const first =
      resolved.find((r) => r.start.getTime() === merged[0].start.getTime()) || merged[0];
    pushGapIfSignificant(gaps, eduEnd, merged[0].start, thresholdDays, null, first.id);
  }

  // Gaps between merged employment spans
  for (let i = 0; i < merged.length - 1; i += 1) {
    const earlier = merged[i];
    const later = merged[i + 1];
    if (later.start <= earlier.end) continue;

    const prev =
      resolved.filter((r) => r.end.getTime() === earlier.end.getTime()).pop() || earlier;
    const next =
      resolved.find((r) => r.start.getTime() === later.start.getTime()) || later;

    pushGapIfSignificant(
      gaps,
      earlier.end,
      later.start,
      thresholdDays,
      prev.id,
      next.id,
    );
  }

  // After last activity → today, unless currently employed (last span ends at today)
  const last = merged[merged.length - 1];
  if (last.end < today) {
    const prev =
      resolved.filter((r) => r.end.getTime() === last.end.getTime()).pop() || last;
    pushGapIfSignificant(gaps, last.end, today, thresholdDays, prev.id, null);
  }

  const totalGapDays = gaps.reduce((sum, g) => sum + g.gapDays, 0);
  return {
    totalGaps: gaps.length,
    totalGapDays,
    totalGapDuration: formatGapDurationFromDays(totalGapDays),
    gaps,
  };
}
