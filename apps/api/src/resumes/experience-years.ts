/**
 * Compute total experience from dated experience rows — never trust a free-text
 * "2+ years" claim alone when dates are present.
 */

import { parseResumeDate, type ResumeContent } from '@careerbridge/shared';

function toMonthIndex(isoLike: string | null | undefined): number | null {
  const parsed = parseResumeDate(isoLike || undefined);
  if (!parsed) return null;
  const y = parsed.year;
  const m = parsed.month ?? 1;
  if (!y || y < 1950 || y > 2100) return null;
  return y * 12 + (m - 1);
}

/**
 * Returns whole years (floor) spanned from earliest start to latest end/current.
 * Overlapping jobs are collapsed into a union span (simple outer range).
 */
export function computeTotalExperienceYears(
  experiences: ResumeContent['experiences'] | null | undefined,
  now = new Date(),
): { years: number; months: number; confidence: number } {
  const rows = experiences || [];
  let minStart: number | null = null;
  let maxEnd: number | null = null;
  let dated = 0;

  const nowIdx = now.getFullYear() * 12 + now.getMonth();

  for (const exp of rows) {
    const start = toMonthIndex(exp.startDate);
    if (start == null) continue;
    dated += 1;
    const end = exp.isCurrent || !exp.endDate ? nowIdx : toMonthIndex(exp.endDate) ?? nowIdx;
    minStart = minStart == null ? start : Math.min(minStart, start);
    maxEnd = maxEnd == null ? end : Math.max(maxEnd, end);
  }

  if (minStart == null || maxEnd == null || maxEnd < minStart) {
    return { years: 0, months: 0, confidence: dated ? 0.3 : 0 };
  }

  const totalMonths = maxEnd - minStart;
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return {
    years,
    months,
    confidence: dated >= 2 ? 0.9 : dated === 1 ? 0.7 : 0.2,
  };
}

export function attachComputedExperienceYears(content: ResumeContent): ResumeContent {
  const computed = computeTotalExperienceYears(content.experiences);
  if (computed.confidence < 0.3) return content;
  return {
    ...content,
    fieldConfidence: [
      ...(content.fieldConfidence || []),
      {
        field: 'totalExperienceYears',
        value: String(computed.years),
        confidence: computed.confidence,
        source: 'computed_from_experience_dates',
      },
      ...(computed.months
        ? [
            {
              field: 'totalExperienceMonths',
              value: String(computed.months),
              confidence: computed.confidence,
              source: 'computed_from_experience_dates',
            },
          ]
        : []),
    ],
  };
}
