import type { PassportExperience } from "@/types/passport";

function parseDay(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3] || 1));
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function monthsBetween(from: Date, to: Date) {
  if (to <= from) return 0;
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

export function formatGapLabel(months: number) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years) parts.push(years === 1 ? "1 year" : `${years} years`);
  if (rest) parts.push(rest === 1 ? "1 month" : `${rest} months`);
  return parts.join(" ");
}

function jobRanges(experience: PassportExperience[], now = new Date()) {
  const today = startOfDay(now);
  return experience
    .map((row) => {
      const start = parseDay(row.startDate);
      if (!start) return null;
      const end = row.stillInCompany ? today : parseDay(row.endDate);
      if (!end) return null;
      const from = startOfDay(start);
      const to = startOfDay(end);
      return { start: from, end: to < from ? from : to };
    })
    .filter((row): row is { start: Date; end: Date } => Boolean(row));
}

export function datedExperienceMonths(experience: PassportExperience[], now = new Date()) {
  return mergeRanges(jobRanges(experience, now)).reduce(
    (total, range) => total + monthsBetween(range.start, range.end),
    0,
  );
}

export function declaredExperienceMonths(years: string, months: string) {
  const yearCount = Number(years);
  const monthCount = Number(months);
  const total =
    (Number.isFinite(yearCount) ? yearCount : 0) * 12 + (Number.isFinite(monthCount) ? monthCount : 0);
  return Math.max(0, total);
}

export function experienceMismatch(declaredMonths: number, datedMonths: number) {
  if (!declaredMonths || !datedMonths) return false;
  return Math.abs(declaredMonths - datedMonths) > 1;
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

export function careerGapMonths({
  stillInCollege,
  educationEnd,
  experience,
  now = new Date(),
}: {
  stillInCollege: boolean;
  educationEnd: string;
  experience: PassportExperience[];
  now?: Date;
}) {
  const { totalDays } = careerGapDuration({ stillInCollege, educationEnd, experience, now });
  return Math.floor(totalDays / 30);
}

function daysBetween(from: Date, to: Date) {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

/** Calendar-ish gap: uncovered days between education end / first job and today (or between jobs). */
export function careerGapDuration({
  stillInCollege,
  educationEnd,
  experience,
  now = new Date(),
}: {
  stillInCollege: boolean;
  educationEnd: string;
  experience: PassportExperience[];
  now?: Date;
}): { totalDays: number; months: number; days: number } {
  const today = startOfDay(now);
  const employed = mergeRanges(jobRanges(experience, now));

  const collegeEnd = stillInCollege ? null : parseDay(educationEnd);
  const firstJob = employed[0]?.start;
  const from = collegeEnd ? startOfDay(collegeEnd) : firstJob;
  if (!from || from >= today) return { totalDays: 0, months: 0, days: 0 };

  let cursor = from;
  let totalDays = 0;
  for (const range of employed) {
    if (range.end <= cursor) continue;
    const coveredStart = range.start < cursor ? cursor : range.start;
    if (coveredStart > cursor) totalDays += daysBetween(cursor, coveredStart);
    if (range.end > cursor) cursor = range.end;
  }
  if (cursor < today) totalDays += daysBetween(cursor, today);

  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;
  return { totalDays, months, days };
}

export function formatGapMonthsDays(months: number, days: number) {
  const parts: string[] = [];
  if (months > 0) parts.push(months === 1 ? '1 month' : `${months} months`);
  if (days > 0) parts.push(days === 1 ? '1 day' : `${days} days`);
  if (!parts.length) return '0 days';
  return parts.join(' and ');
}
