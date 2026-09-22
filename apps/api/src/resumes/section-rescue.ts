/**
 * Near-duplicate experience collapse (plan E) + late-heading section rescue (plan F).
 * Pure heuristic — no LLM.
 */

import type { ResumeContent } from '@careerbridge/shared';

type Exp = ResumeContent['experiences'][number];

export type SectionBucket = 'header' | 'experience' | 'education' | 'skills' | 'personal' | 'summary';

/**
 * When headings appear late, reclassify pre-heading body lines into buckets
 * instead of leaving everything in the header (plan F).
 */
export function rescueLateHeadingBody(
  lines: string[],
  headingAt: (line: string) => string | null,
): { preHeading: Array<{ bucket: SectionBucket; line: string }>; firstHeadingIndex: number } {
  let firstHeadingIndex = lines.findIndex((l) => Boolean(headingAt(l)));
  if (firstHeadingIndex < 0) firstHeadingIndex = lines.length;
  const preHeading: Array<{ bucket: SectionBucket; line: string }> = [];

  // Only rescue when a meaningful body precedes the first heading
  if (firstHeadingIndex < 6) {
    return { preHeading, firstHeadingIndex };
  }

  for (let i = 0; i < firstHeadingIndex; i += 1) {
    const line = lines[i];
    const bare = line.replace(/^[-•*▪◦●]\s+/, '').trim();
    if (/^(father|date of birth|marital|permanent address|gender|nationality)\b/i.test(bare)) {
      preHeading.push({ bucket: 'personal', line });
      continue;
    }
    if (/(?:worked|working)\s+as\s+/i.test(bare) || /\bfrom\s+.+\s+to\s+/i.test(bare)) {
      preHeading.push({ bucket: 'experience', line });
      continue;
    }
    if (
      /^(puc|b\.?\s*com|bcom|b\.?\s*sc|bsc|b\.?\s*tech|mca|mba|diploma|10th|12th)\b/i.test(bare) ||
      /\b(university|college|school)\b/i.test(bare)
    ) {
      preHeading.push({ bucket: 'education', line });
      continue;
    }
    if (/^(objective|seeking|to obtain|maximize)\b/i.test(bare) || /^[•\-].{20,}/.test(line)) {
      // Ambiguous bullets before headings: prefer experience if employment-like else summary
      if (/\b(recruit|manage|hiring|developer|engineer)\b/i.test(bare)) {
        preHeading.push({ bucket: 'experience', line });
      } else {
        preHeading.push({ bucket: 'summary', line });
      }
      continue;
    }
    if (i < 4) {
      preHeading.push({ bucket: 'header', line });
    }
  }

  return { preHeading, firstHeadingIndex };
}

function norm(s: string | null | undefined): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function descBlob(e: Exp): string {
  return norm([e.description, ...(e.responsibilities || [])].filter(Boolean).join(' '));
}

function richness(e: Exp): number {
  let score = 0;
  if (e.company?.trim()) score += 4;
  if (e.jobTitle?.trim() && !/^role$/i.test(e.jobTitle)) score += 2;
  if (e.startDate) score += 2;
  if (e.endDate || e.isCurrent) score += 1;
  score += Math.min(6, (e.responsibilities || []).length);
  score += Math.min(3, Math.floor((e.description || '').length / 80));
  return score;
}

function textSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (longer.includes(shorter) && shorter.length > 40) return shorter.length / longer.length;
  const wa = new Set(shorter.split(' ').filter((w) => w.length > 3));
  const wb = new Set(longer.split(' ').filter((w) => w.length > 3));
  if (!wa.size || !wb.size) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter += 1;
  return (2 * inter) / (wa.size + wb.size);
}

function sameEmployer(a: Exp, b: Exp): boolean {
  const ca = norm(a.company);
  const cb = norm(b.company);
  if (!ca || !cb) {
    // No company on one side — allow match only if titles+dates align closely
    return (
      norm(a.jobTitle) === norm(b.jobTitle) &&
      Boolean(a.startDate) &&
      a.startDate === b.startDate
    );
  }
  if (ca === cb) return true;
  if (ca.includes(cb) || cb.includes(ca)) return true;
  // Distinct named companies → never treat as near-dupe for merge
  return false;
}

/**
 * Collapse near-duplicate paragraphs for the same employer; keep distinct employers separate.
 */
export function collapseNearDuplicateExperiences(jobs: Exp[]): Exp[] {
  if (jobs.length < 2) return jobs;
  const keep = jobs.map((j) => ({ ...j, responsibilities: [...(j.responsibilities || [])] }));
  const drop = new Set<number>();

  for (let i = 0; i < keep.length; i += 1) {
    if (drop.has(i)) continue;
    for (let j = i + 1; j < keep.length; j += 1) {
      if (drop.has(j)) continue;
      if (!sameEmployer(keep[i], keep[j])) continue;

      const sim = textSimilarity(descBlob(keep[i]), descBlob(keep[j]));
      const titleSame = norm(keep[i].jobTitle) === norm(keep[j].jobTitle);
      if (sim < 0.72 && !(titleSame && sim > 0.45)) continue;

      const richer = richness(keep[i]) >= richness(keep[j]) ? i : j;
      const poorer = richer === i ? j : i;
      const winner = keep[richer];
      const loser = keep[poorer];
      // Prefer non-empty company / dates from either
      winner.company = winner.company || loser.company;
      winner.startDate = winner.startDate || loser.startDate;
      winner.endDate = winner.isCurrent || loser.isCurrent ? null : winner.endDate || loser.endDate;
      winner.isCurrent = Boolean(winner.isCurrent || loser.isCurrent);
      if ((winner.responsibilities || []).length < (loser.responsibilities || []).length) {
        winner.responsibilities = loser.responsibilities;
        winner.description = loser.description || winner.description;
      }
      drop.add(poorer);
    }
  }

  return keep.filter((_, idx) => !drop.has(idx));
}
