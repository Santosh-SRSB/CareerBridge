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
  const match = value.trim().match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3] || 1));
}

/** YYYY-MM (no day) → last day of that month; full dates stay as-is. */
function parseEducationEnd(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const monthOnly = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (monthOnly) {
    const year = Number(monthOnly[1]);
    const monthIndex = Number(monthOnly[2]) - 1;
    return startOfDay(new Date(year, monthIndex + 1, 0));
  }
  return parseDay(trimmed);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(from: Date, to: Date) {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
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
    /\bgraduate\b|b\.?\s*tech|b\.?\s*e\b|b\.?\s*sc|b\.?\s*com|b\.?\s*a\b|bba|bca|bachelor|degree/.test(q)
  ) {
    return 40;
  }
  if (/diploma|polytechnic/.test(q)) return 30;
  if (/12th|higher\s*secondary|hsc|intermediate|\+2|puc|class\s*12|xii\b/.test(q)) return 20;
  if (/10th|ssc|matriculation|secondary|class\s*10|x\b/.test(q)) return 10;
  if (/^other$/.test(q)) return 5;
  // Unknown free-text college quals should still beat school leaving certificates.
  return 35;
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
    .filter((row) => row.qualification);

  if (!rows.length) return null;

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

function jobRanges(experience: CareerGapExperienceInput[], now: Date) {
  const today = startOfDay(now);
  return experience
    .map((row) => {
      const start = parseDay(row.startDate || undefined);
      if (!start) return null;
      const current = Boolean(row.stillInCompany || row.isCurrent);
      const end = current ? today : parseDay(row.endDate || undefined);
      if (!end) return null;
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
 * Uncovered time after the candidate's highest education ends.
 * School→college gaps (e.g. after 12th before degree) are ignored when a higher
 * qualification exists — the clock starts at the highest edu end date only.
 *
 * A gap is flagged when uncovered time is **more than 30 days**.
 */
export function computeCareerGapAfterHighestEducation({
  education,
  experience,
  now = new Date(),
  gapThresholdDays = 30,
}: {
  education: CareerGapEducationInput[];
  experience: CareerGapExperienceInput[];
  now?: Date;
  /** Flag gap when total uncovered days are strictly greater than this (default 30). */
  gapThresholdDays?: number;
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
  const from = highest.end;
  if (from >= today) {
    return {
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
    };
  }

  const employed = mergeRanges(jobRanges(experience, now)).filter((range) => range.end > from);
  let cursor = from;
  let totalDays = 0;
  for (const range of employed) {
    if (range.end <= cursor) continue;
    const coveredStart = range.start < cursor ? cursor : range.start;
    if (coveredStart > cursor) totalDays += daysBetween(cursor, coveredStart);
    if (range.end > cursor) cursor = range.end;
  }
  if (cursor < today) totalDays += daysBetween(cursor, today);

  const gapMonths = Math.floor(totalDays / 30);
  const gapDays = totalDays % 30;
  const hasGap = totalDays > gapThresholdDays;

  return {
    gapMonths,
    gapDays,
    totalDays,
    hasGap,
    gapLabel: hasGap ? formatCareerGapLabel(Math.max(1, gapMonths)) : '',
    highestEducation: {
      qualification: highest.qualification,
      endDate: highest.endDate,
      stillStudying: false,
      rank: highest.rank,
    },
  };
}
