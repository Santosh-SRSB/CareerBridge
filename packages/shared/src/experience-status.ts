/** Single source of truth for candidate fresher vs experienced banding. */

export type ExperienceBand = 'fresher' | 'experienced';

/** Boarding-pass LEVEL chip keys. */
export type ExperienceLevelChip = 'fresher' | '0-1' | '1-3' | '3-5' | '5+';

/** @deprecated Prefer ExperienceLevelChip; kept for STATUS label helpers. */
export type ExperienceChip = {
  band: ExperienceBand;
  label: 'FRESHER' | 'EXPERIENCED';
  level: ExperienceLevelChip;
};

export type ExperienceBandInput = {
  hasExperience?: string | null;
  experienceLevel?: string | null;
  totalExperienceYears?: number | null;
  totalExperienceMonths?: number | null;
  experiences?: Array<{ isInternship?: boolean | null; jobTitle?: string | null; company?: string | null }>;
};

function hasPaidRole(
  experiences?: Array<{ isInternship?: boolean | null; jobTitle?: string | null; company?: string | null }>,
) {
  return (experiences || []).some(
    (row) =>
      !row.isInternship &&
      Boolean((row.jobTitle || '').trim() || (row.company || '').trim()),
  );
}

function hasInternshipOnly(
  experiences?: Array<{ isInternship?: boolean | null; jobTitle?: string | null; company?: string | null }>,
) {
  const rows = experiences || [];
  if (!rows.length) return false;
  const anyPaid = hasPaidRole(rows);
  const anyIntern = rows.some((row) => Boolean(row.isInternship));
  return anyIntern && !anyPaid;
}

function totalYears(input: ExperienceBandInput) {
  const years = Number(input.totalExperienceYears) || 0;
  const months = Number(input.totalExperienceMonths) || 0;
  return years + months / 12;
}

/** Prefer onboarding hasExperience → paid vs internship rows → years → stored level. */
export function resolveCandidateExperienceBand(input: ExperienceBandInput): ExperienceBand {
  const flag = (input.hasExperience || '').trim().toUpperCase();
  if (flag === 'YES') return 'experienced';
  if (flag === 'NONE') return 'fresher';
  // Internship: fresher unless paid jobs or ≥1 year.
  if (flag === 'INTERNSHIP') {
    if (hasPaidRole(input.experiences) || totalYears(input) >= 1) return 'experienced';
    return 'fresher';
  }

  if (hasPaidRole(input.experiences)) return 'experienced';
  if (hasInternshipOnly(input.experiences)) return 'fresher';

  if (totalYears(input) > 0) return 'experienced';

  const level = (input.experienceLevel || '').trim().toLowerCase();
  if (level === 'experienced') return 'experienced';
  return 'fresher';
}

/** LEVEL chip: fresher | 0-1 | 1-3 | 3-5 | 5+ */
export function resolveExperienceLevelChip(input: ExperienceBandInput): ExperienceLevelChip {
  const band = resolveCandidateExperienceBand(input);
  if (band === 'fresher') return 'fresher';
  const total = totalYears(input);
  if (total < 1.5) return '0-1';
  if (total < 3.5) return '1-3';
  if (total < 5.5) return '3-5';
  return '5+';
}

/**
 * STATUS + LEVEL together.
 * - label → boarding STATUS (FRESHER / EXPERIENCED)
 * - level → boarding LEVEL chip key
 */
export function resolveExperienceChip(input: ExperienceBandInput): ExperienceChip {
  const band = resolveCandidateExperienceBand(input);
  return {
    band,
    label: band === 'experienced' ? 'EXPERIENCED' : 'FRESHER',
    level: resolveExperienceLevelChip(input),
  };
}

/** Deduplicate location display tokens (e.g. "Karnataka, Karnataka"). */
export function formatLocationLabel(...parts: Array<string | null | undefined>): string {
  const tokens: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const raw = (part || '').trim();
    if (!raw) continue;
    for (const piece of raw.split(/[,|/]+/).map((p) => p.trim()).filter(Boolean)) {
      const key = piece.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tokens.push(piece);
    }
  }
  return tokens.join(', ');
}

/** Derive hasExperience + experienceLevel for persistence. */
export function deriveExperienceFlags(input: {
  experienceLevel?: string | null;
  experiences?: Array<{ isInternship?: boolean | null; jobTitle?: string | null; company?: string | null }>;
  hasExperience?: string | null;
}): { experienceLevel: ExperienceBand; hasExperience: 'YES' | 'NONE' | 'INTERNSHIP' } {
  const band = resolveCandidateExperienceBand(input);
  if (band === 'experienced') {
    return { experienceLevel: 'experienced', hasExperience: 'YES' };
  }
  if (hasInternshipOnly(input.experiences) || (input.hasExperience || '').toUpperCase() === 'INTERNSHIP') {
    return { experienceLevel: 'fresher', hasExperience: 'INTERNSHIP' };
  }
  return { experienceLevel: 'fresher', hasExperience: 'NONE' };
}
