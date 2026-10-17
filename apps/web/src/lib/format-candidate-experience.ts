import type { CandidateProfile } from '@careerbridge/shared';
import { resolveCandidateExperienceBand } from '@careerbridge/shared';

function formatYears(years: number, months: number) {
  const total = years + months / 12;
  if (total < 1) return 'Less than 1 year';
  if (total < 2) return '1 year';
  const rounded = Math.round(total * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded} years` : `${rounded} years`;
}

function yearsFromExperienceDates(
  experiences: Array<{ startDate?: string | null; endDate?: string | null; stillInCompany?: boolean | null }>,
) {
  let months = 0;
  const now = new Date();
  for (const row of experiences) {
    if (!row.startDate) continue;
    const start = new Date(row.startDate);
    if (Number.isNaN(start.getTime())) continue;
    const end =
      row.stillInCompany || !row.endDate
        ? now
        : new Date(row.endDate.includes('T') ? row.endDate : `${row.endDate}T00:00:00`);
    if (Number.isNaN(end.getTime()) || end < start) continue;
    months += (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  }
  return Math.max(0, months) / 12;
}

/** Prefer explicit onboarding years; else infer from role date ranges. */
export function resolveTotalExperienceYears(profile: Pick<
  CandidateProfile,
  'totalExperienceYears' | 'totalExperienceMonths' | 'experiences'
>) {
  const stored =
    (Number(profile.totalExperienceYears) || 0) + (Number(profile.totalExperienceMonths) || 0) / 12;
  if (stored > 0) return stored;
  return yearsFromExperienceDates(profile.experiences || []);
}

export function formatCandidateExperienceLine(profile: Pick<
  CandidateProfile,
  'experiences' | 'totalExperienceYears' | 'totalExperienceMonths' | 'hasExperience'
>) {
  const experiences = profile.experiences || [];
  const total = resolveTotalExperienceYears(profile);
  const years = Math.floor(total);
  const months = Math.round((total - years) * 12);
  const current =
    experiences.find((item) => item.stillInCompany) ||
    experiences.find((item) => !item.endDate);
  const latest = current || experiences[0];
  const internship = experiences.find((item) => item.isInternship);
  const flag = (profile.hasExperience || '').toUpperCase();
  const band = resolveCandidateExperienceBand(profile);

  if (band === 'fresher' || flag === 'NONE') {
    if (flag === 'INTERNSHIP' || internship) {
      const company = internship?.company || latest?.company;
      return company ? `Internship · ${company}` : 'Internship';
    }
    if (!experiences.length && total < 1) return 'Fresher';
    if (total < 1 && latest) return `Fresher · ${latest.jobTitle || latest.company}`;
    if (total < 1) return 'Fresher';
  }

  if (total < 1) {
    if (latest) return latest.jobTitle || latest.company || 'Experienced';
    return 'Experienced';
  }

  const duration = formatYears(years, months);
  if (current?.company) return `${duration} · ${current.company}`;
  if (latest?.company) return `${duration} · ${latest.company}`;
  return duration;
}
