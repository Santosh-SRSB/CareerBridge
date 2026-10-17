/** Education / experience date helpers for career-gap detection after highest qualification. */

export type CareerGapEducationInput = {
  qualification: string;
  startDate?: string | null;
  endDate?: string | null;
  yearCompleted?: number | string | null;
  isCurrent?: boolean;
};

export type CareerGapExperienceInput = {
  startDate?: string | null;
  endDate?: string | null;
  stillInCompany?: boolean;
  isCurrent?: boolean;
};

export type CareerGapResult = {
  gapMonths: number;
  gapDays: number;
  totalDays: number;
  hasGap: boolean;
  gapLabel: string;
  highestEducation: {
    qualification: string;
    endDate: string | null;
    stillStudying: boolean;
    rank: number;
  } | null;
};

function parseDay(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  // Accept YYYY-MM, YYYY-MM-DD, and ISO datetimes (2021-07-01T00:00:00.000Z).
  const match = value.trim().match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3] || 1));
}

/** YYYY-MM (no day) → last day of that month; full dates stay as-is. */
function parseEducationEnd(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const monthOnly = trimmed.match(/^(\d{4})-(\d{2})(?:[T\s].*)?$/);
  if (monthOnly && !/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const year = Number(monthOnly[1]);
    const monthIndex = Number(monthOnly[2]) - 1;
    return startOfDay(new Date(year, monthIndex + 1, 0));
  }
  return parseDay(trimmed);
}

/** Job start: YYYY-MM → first day; YYYY-MM-DD / ISO as-is. */
function parseJobStart(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}(?:[T\s].*)?$/.test(trimmed) && !/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const monthOnly = trimmed.match(/^(\d{4})-(\d{2})/);
    if (!monthOnly) return null;
    return startOfDay(new Date(Number(monthOnly[1]), Number(monthOnly[2]) - 1, 1));
  }
  return parseDay(trimmed);
}

/** Job end: YYYY-MM → last day of month; YYYY-MM-DD / ISO as-is. */
function parseJobEnd(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}(?:[T\s].*)?$/.test(trimmed) && !/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const monthOnly = trimmed.match(/^(\d{4})-(\d{2})/);
    if (!monthOnly) return null;
    const year = Number(monthOnly[1]);
    const monthIndex = Number(monthOnly[2]) - 1;
    return startOfDay(new Date(year, monthIndex + 1, 0));
  }
  return parseDay(trimmed);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(from: Date, to: Date) {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

/** Whole calendar months between two dates (exclusive of partial trailing month). */
export function calendarMonthsBetween(from: Date, to: Date) {
  if (to <= from) return 0;
  let months =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

function mergeRanges(ranges: { start: Date; end: Date }[]) {
  const sorted = [...ranges].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: { start: Date; end: Date }[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) {
      merged.push({ ...range });
    } else if (range.end > last.end) {
      last.end = range.end;
    }
  }
  return merged;
}

/** Merge overlapping ranges and bridge short breaks (≤ bridgeDays) as continuous work. */
function mergeRangesBridged(ranges: { start: Date; end: Date }[], bridgeDays: number) {
  const sorted = [...ranges].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: { start: Date; end: Date }[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ ...range });
      continue;
    }
    const nextAllowed = addDays(last.end, 1 + Math.max(0, bridgeDays));
    if (range.start <= nextAllowed) {
      if (range.end > last.end) last.end = range.end;
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

/**
 * Rank qualifications so 10th/12th never win over diploma/degree.
 * Higher number = higher education.
 */
export function educationQualificationRank(qualification: string | null | undefined): number {
  const q = (qualification || '').toLowerCase().trim();
  if (!q) return 0;

  if (/ph\.?\s*d|doctorate|doctoral/.test(q)) return 60;
  if (
    /post\s*grad|postgraduate|m\.?\s*tech|m\.?\s*e\b|mba|m\.?\s*sc|m\.?\s*com|m\.?\s*a\b|m\.?\s*ca|masters?/.test(
      q,
    )
  ) {
    return 50;
  }
  if (
    /\bgraduate\b|b\.?\s*tech|b\.?\s*e\b|b\.?\s*sc|b\.?\s*com|b\.?\s*a\b|bba|bca|bachelor|degree|engineering\s*college|college\s*of\s*engineering|institute\s*of\s*technology|\biit\b|\bnit\b/.test(
      q,
    )
  ) {
    return 40;
  }
  if (/diploma|polytechnic/.test(q)) return 30;
  if (/12th|higher\s*secondary|hsc|intermediate|\+2|puc|class\s*12|xii\b/.test(q)) return 20;
  if (
    /10th|ssc|matriculation|class\s*10|\bx\b|high\s*school|secondary\s*school|vidyalaya|senior\s*secondary|sslc/.test(
      q,
    )
  ) {
    return 10;
  }
  // Placeholder "Other" must not beat real school/college rows.
  if (/^other(\s*\(.*\))?$/i.test(q)) return 5;
  // Unknown free-text college/university names still beat school.
  if (/\b(college|university|institute|academy)\b/.test(q)) return 35;
  return 25;
}

function educationEndDate(row: CareerGapEducationInput): Date | null {
  if (row.isCurrent) return null;
  const fromEnd = parseEducationEnd(row.endDate || undefined);
  if (fromEnd) return startOfDay(fromEnd);
  if (row.yearCompleted != null && String(row.yearCompleted).trim()) {
    const year = Number(String(row.yearCompleted).trim().slice(0, 4));
    if (Number.isFinite(year) && year >= 1970) {
      return startOfDay(new Date(year, 5, 30)); // end of June of completion year
    }
  }
  return null;
}

/** Pick the highest qualification; ties broken by latest end date. */
export function pickHighestEducation(education: CareerGapEducationInput[]) {
  const rows = education
    .map((row) => ({
      qualification: (row.qualification || '').trim(),
      rank: educationQualificationRank(row.qualification),
      end: educationEndDate(row),
      stillStudying: Boolean(row.isCurrent),
      raw: row,
    }))
    .filter((row) => row.qualification && !/^other(\s*\(.*\))?$/i.test(row.qualification));

  if (!rows.length) {
    // Fall back to any row if everything was placeholder "Other"
    const fallback = education
      .map((row) => ({
        qualification: (row.qualification || '').trim(),
        rank: educationQualificationRank(row.qualification),
        end: educationEndDate(row),
        stillStudying: Boolean(row.isCurrent),
        raw: row,
      }))
      .filter((row) => row.qualification);
    if (!fallback.length) return null;
    fallback.sort((a, b) => {
      if (b.rank !== a.rank) return b.rank - a.rank;
      const aTime = a.end?.getTime() ?? (a.stillStudying ? Number.MAX_SAFE_INTEGER : 0);
      const bTime = b.end?.getTime() ?? (b.stillStudying ? Number.MAX_SAFE_INTEGER : 0);
      return bTime - aTime;
    });
    const top = fallback[0];
    return {
      qualification: top.qualification,
      endDate: top.end
        ? `${top.end.getFullYear()}-${String(top.end.getMonth() + 1).padStart(2, '0')}-${String(top.end.getDate()).padStart(2, '0')}`
        : null,
      stillStudying: top.stillStudying,
      rank: top.rank,
      end: top.end,
    };
  }

  rows.sort((a, b) => {
    if (b.rank !== a.rank) return b.rank - a.rank;
    const aTime = a.end?.getTime() ?? (a.stillStudying ? Number.MAX_SAFE_INTEGER : 0);
    const bTime = b.end?.getTime() ?? (b.stillStudying ? Number.MAX_SAFE_INTEGER : 0);
    return bTime - aTime;
  });

  const top = rows[0];
  return {
    qualification: top.qualification,
    endDate: top.end
      ? `${top.end.getFullYear()}-${String(top.end.getMonth() + 1).padStart(2, '0')}-${String(top.end.getDate()).padStart(2, '0')}`
      : null,
    stillStudying: top.stillStudying,
    rank: top.rank,
    end: top.end,
  };
}

function jobRanges(
  experience: CareerGapExperienceInput[],
  now: Date,
  /** If a job has no start date but is current / open-ended, cover from this date (usually day after graduation). */
  fallbackStart?: Date | null,
) {
  const today = startOfDay(now);
  return experience
    .map((row) => {
      const current = Boolean(row.stillInCompany || row.isCurrent);
      const parsedStart = parseJobStart(row.startDate || undefined);
      const parsedEnd = current ? today : parseJobEnd(row.endDate || undefined);
      // Open-ended job (started, no end) = still employed through today.
      const end = parsedEnd ?? (parsedStart || current ? today : null);
      if (!end) return null;
      const start =
        parsedStart ??
        (current || !row.endDate?.trim() ? fallbackStart ?? null : null);
      if (!start) return null;
      const from = startOfDay(start);
      const to = startOfDay(end);
      return { start: from, end: to < from ? from : to };
    })
    .filter((row): row is { start: Date; end: Date } => Boolean(row));
}

export function formatCareerGapLabel(months: number) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years) parts.push(years === 1 ? '1 year' : `${years} years`);
  if (rest) parts.push(rest === 1 ? '1 month' : `${rest} months`);
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return parts[0] || '0 months';
}

/**
 * Uncovered breaks in employment after the candidate's highest education ends.
 *
 * - School→college time is ignored (clock is tied to highest education only).
 * - Time from graduation until the first job is treated as a fresher / job-search
 *   period and is NOT counted as a career gap.
 * - Gaps are only the uncovered stretches BETWEEN jobs (and after the last job
 *   if they are not currently employed).
 * - Jobs within 45 days of each other are treated as continuous.
 * - A gap is flagged when uncovered time is **more than 30 days**.
 */
export function computeCareerGapAfterHighestEducation({
  education,
  experience,
  now = new Date(),
  gapThresholdDays = 30,
  bridgeDays = 45,
}: {
  education: CareerGapEducationInput[];
  experience: CareerGapExperienceInput[];
  now?: Date;
  /** Flag gap when total uncovered days are strictly greater than this (default 30). */
  gapThresholdDays?: number;
  /** Merge jobs separated by at most this many days as continuous employment. */
  bridgeDays?: number;
}): CareerGapResult {
  const highest = pickHighestEducation(education);
  if (!highest) {
    return {
      gapMonths: 0,
      gapDays: 0,
      totalDays: 0,
      hasGap: false,
      gapLabel: '',
      highestEducation: null,
    };
  }

  if (highest.stillStudying || !highest.end) {
    return {
      gapMonths: 0,
      gapDays: 0,
      totalDays: 0,
      hasGap: false,
      gapLabel: '',
      highestEducation: {
        qualification: highest.qualification,
        endDate: highest.endDate,
        stillStudying: highest.stillStudying,
        rank: highest.rank,
      },
    };
  }

  const today = startOfDay(now);
  const graduationNextDay = addDays(highest.end, 1);
  const empty = {
    gapMonths: 0,
    gapDays: 0,
    totalDays: 0,
    hasGap: false,
    gapLabel: '',
    highestEducation: {
      qualification: highest.qualification,
      endDate: highest.endDate,
      stillStudying: false,
      rank: highest.rank,
    },
  } satisfies CareerGapResult;

  if (graduationNextDay >= today) {
    return empty;
  }

  const rawJobs = jobRanges(experience, now, graduationNextDay)
    .map((range) => ({
      start: range.start < graduationNextDay ? graduationNextDay : range.start,
      end: range.end > today ? today : range.end,
    }))
    .filter((range) => range.end >= graduationNextDay && range.start <= today && range.end >= range.start);

  const employed = mergeRangesBridged(rawJobs, bridgeDays);

  // No post-graduation jobs → fresher, not an employment career gap.
  if (!employed.length) {
    return empty;
  }

  // Career gap starts after the first job begins — not at graduation.
  let cursor = addDays(employed[0].start, 0);
  // Advance through first job coverage.
  cursor = addDays(employed[0].end, 1);

  let totalDays = 0;
  let gapMonths = 0;
  for (let i = 1; i < employed.length; i += 1) {
    const range = employed[i];
    if (range.end < cursor) continue;
    const coveredStart = range.start < cursor ? cursor : range.start;
    if (coveredStart > cursor) {
      totalDays += daysBetween(cursor, coveredStart);
      gapMonths += calendarMonthsBetween(cursor, coveredStart);
    }
    if (range.end >= cursor) cursor = addDays(range.end, 1);
  }
  if (cursor < today) {
    totalDays += daysBetween(cursor, today);
    gapMonths += calendarMonthsBetween(cursor, today);
  }

  const gapDays = totalDays % 30;
  const hasGap = totalDays > gapThresholdDays;

  return {
    gapMonths,
    gapDays,
    totalDays,
    hasGap,
    gapLabel: hasGap ? formatCareerGapLabel(Math.max(1, gapMonths || 1)) : '',
    highestEducation: {
      qualification: highest.qualification,
      endDate: highest.endDate,
      stillStudying: false,
      rank: highest.rank,
    },
  };
}
