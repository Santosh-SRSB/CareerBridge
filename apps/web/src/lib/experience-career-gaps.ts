/**
 * Detect calendar gaps between consecutive work-experience roles.
 * Used before the resume review step — additive to existing careerGaps UI.
 */

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

export type ExperienceDateInput = {
  startDate?: string;
  endDate?: string;
  current?: boolean;
  isCurrent?: boolean;
  stillInCompany?: boolean;
  startMonth?: string;
  startYear?: string;
  endMonth?: string;
  endYear?: string;
  company?: string;
  role?: string;
  jobTitle?: string;
};

export type DetectedCareerGap = {
  startDate: string;
  endDate: string;
  gapDays: number;
  reason: string;
  afterRole: string;
  beforeRole: string;
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(from: Date, to: Date) {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)));
}

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseFlexibleDate(value: string | undefined | null): Date | null {
  const raw = String(value || '').trim();
  if (!raw || /present|current|now|ongoing/i.test(raw)) return null;

  const iso = raw.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (iso) {
    return startOfDay(
      new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3] || 1)),
    );
  }

  const my = raw.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (my) {
    const month = MONTHS[my[1].toLowerCase()];
    if (month !== undefined) return startOfDay(new Date(Number(my[2]), month, 1));
  }

  const ym = raw.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (ym) {
    return startOfDay(new Date(Number(ym[2]), Number(ym[1]) - 1, 1));
  }

  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) return startOfDay(new Date(parsed));
  return null;
}

function roleLabel(row: ExperienceDateInput) {
  const title = String(row.role || row.jobTitle || 'Role').trim() || 'Role';
  const company = String(row.company || '').trim();
  return company ? `${title} @ ${company}` : title;
}

function resolveRange(row: ExperienceDateInput, now = new Date()) {
  const current = Boolean(row.current || row.isCurrent || row.stillInCompany);
  const start =
    parseFlexibleDate(row.startDate) ||
    (row.startMonth && row.startYear
      ? parseFlexibleDate(`${row.startMonth} ${row.startYear}`)
      : null);
  if (!start) return null;
  const end = current
    ? startOfDay(now)
    : parseFlexibleDate(row.endDate) ||
      (row.endMonth && row.endYear
        ? parseFlexibleDate(`${row.endMonth} ${row.endYear}`)
        : null);
  if (!end) return null;
  return {
    start,
    end: end < start ? start : end,
    label: roleLabel(row),
  };
}

/**
 * Returns gaps of > 0 days between consecutive dated roles (sorted by start).
 * Reason is empty until the user confirms — mandatory only when gapDays > 30.
 */
export function detectExperienceCareerGaps(
  experience: ExperienceDateInput[],
  now = new Date(),
): DetectedCareerGap[] {
  const ranges = (experience || [])
    .map((row) => resolveRange(row, now))
    .filter((row): row is { start: Date; end: Date; label: string } => Boolean(row))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const gaps: DetectedCareerGap[] = [];
  for (let i = 0; i < ranges.length - 1; i += 1) {
    const earlier = ranges[i];
    const later = ranges[i + 1];
    // Next role starts after previous ended → gap
    if (later.start <= earlier.end) continue;
    const gapDays = daysBetween(earlier.end, later.start);
    if (gapDays <= 0) continue;
    gaps.push({
      startDate: toIsoDate(earlier.end),
      endDate: toIsoDate(later.start),
      gapDays,
      reason: '',
      afterRole: earlier.label,
      beforeRole: later.label,
    });
  }
  return gaps;
}

export function gapRequiresReason(gapDays: number) {
  return gapDays > 30;
}
