import type { CandidateProfile } from '@careerbridge/shared';

function formatYears(years: number, months: number) {
  const total = years + months / 12;
  if (total < 1) return 'Less than 1 year';
  if (total < 2) return '1 year';
  const rounded = Math.round(total * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded} years` : `${rounded} years`;
}

export function formatCandidateExperienceLine(profile: Pick<
  CandidateProfile,
  'experiences' | 'totalExperienceYears' | 'totalExperienceMonths' | 'hasExperience'
>) {
  const experiences = profile.experiences || [];
  const years = profile.totalExperienceYears ?? 0;
  const months = profile.totalExperienceMonths ?? 0;
  const total = years + months / 12;
  const current =
    experiences.find((item) => item.stillInCompany) ||
    experiences.find((item) => !item.endDate);
  const latest = current || experiences[0];
  const internship = experiences.find((item) => item.isInternship);

  if (!experiences.length && total < 1) {
    return 'Fresher';
  }

  if (total < 1) {
    if (internship) return `Internship · ${internship.company}`;
    if (latest?.isInternship) return `Internship · ${latest.company}`;
    if (latest) return `Fresher · ${latest.jobTitle || latest.company}`;
    return 'Fresher';
  }

  const duration = formatYears(years, months);

  if (current) {
    return `Experience ${duration} · ${current.company}`;
  }

  if (latest) {
    return `Ex · ${latest.company}`;
  }

  return `Experience ${duration}`;
}
