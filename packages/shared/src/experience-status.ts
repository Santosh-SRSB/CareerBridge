/** Inputs needed to decide Fresher vs Experienced on the dashboard boarding pass. */
export type ExperienceStatusInput = {
  experienceLevel?: string | null;
  hasExperience?: string | null;
  totalExperienceYears?: number | null;
  totalExperienceMonths?: number | null;
  experiences?: Array<{
    isInternship?: boolean;
    company?: string | null;
    jobTitle?: string | null;
  }>;
};

export type CandidateExperienceBand = 'fresher' | 'experienced';

export type ExperienceChipKey = 'fresher' | '0-1' | '1-3' | '3-5' | '5+';

function normalizeHasExperience(value?: string | null) {
  return (value || '').trim().toUpperCase();
}

export function experienceYearsTotal(profile: ExperienceStatusInput) {
  const years = profile.totalExperienceYears ?? 0;
  const months = profile.totalExperienceMonths ?? 0;
  return years + months / 12;
}

function paidJobs(profile: ExperienceStatusInput) {
  return (profile.experiences || []).filter(
    (row) =>
      !row.isInternship && Boolean(row.company?.trim() || row.jobTitle?.trim()),
  );
}

function internshipJobs(profile: ExperienceStatusInput) {
  return (profile.experiences || []).filter(
    (row) =>
      row.isInternship && Boolean(row.company?.trim() || row.jobTitle?.trim()),
  );
}

/**
 * Single source of truth for STATUS / LEVEL on the candidate dashboard.
 * Prefers 4-step onboarding `hasExperience`, then real job rows, years, then stored level.
 */
export function resolveCandidateExperienceBand(
  profile: ExperienceStatusInput,
): CandidateExperienceBand {
  const has = normalizeHasExperience(profile.hasExperience);
  const paid = paidJobs(profile);
  const total = experienceYearsTotal(profile);

  if (has === 'YES') return 'experienced';
  if (has === 'NONE' || has === 'NO') return 'fresher';
  if (has === 'INTERNSHIP') {
    if (paid.length > 0 || total >= 1) return 'experienced';
    return 'fresher';
  }

  if (paid.length > 0) return 'experienced';
  if (total >= 1) return 'experienced';
  if (internshipJobs(profile).length > 0) return 'fresher';

  const level = (profile.experienceLevel || '').trim().toLowerCase();
  if (level === 'experienced') return 'experienced';
  if (level === 'fresher') return 'fresher';

  return 'fresher';
}

export function resolveExperienceChip(profile: ExperienceStatusInput): ExperienceChipKey {
  if (resolveCandidateExperienceBand(profile) === 'fresher') return 'fresher';
  const total = experienceYearsTotal(profile);
  if (total < 1.5) return '0-1';
  if (total < 3.5) return '1-3';
  if (total < 5.5) return '3-5';
  return '5+';
}

export function experienceLevelFromHasExperience(
  hasExperience?: string | null,
): 'fresher' | 'experienced' {
  return normalizeHasExperience(hasExperience) === 'YES' ? 'experienced' : 'fresher';
}

/** Collapse repeated city/state tokens for display (e.g. "X, Karnataka, Karnataka"). */
export function formatLocationLabel(...parts: Array<string | null | undefined>) {
  const tokens: string[] = [];
  for (const part of parts) {
    if (!part?.trim()) continue;
    for (const token of part.split(',')) {
      const cleaned = token.trim();
      if (!cleaned) continue;
      if (tokens.some((existing) => existing.toLowerCase() === cleaned.toLowerCase())) continue;
      tokens.push(cleaned);
    }
  }
  return tokens.join(', ');
}
