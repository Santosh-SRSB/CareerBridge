export { RESUME_SUMMARY_MAX } from '@careerbridge/shared';

export type EducationEntryField = 'degree' | 'institution' | 'startDate' | 'endDate';
export type ExperienceEntryField = 'role' | 'company' | 'startDate' | 'endDate';
export type EntryErrors<F extends string> = Partial<Record<F, string>>;

export interface EducationEntryInput {
  degree: string;
  institution: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface ExperienceEntryInput {
  role: string;
  company: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

function monthKey(value: string): number | null {
  const match = /^(\d{4})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return Number(match[1]) * 12 + (month - 1);
}

function currentMonthKey(now: Date): number {
  return now.getFullYear() * 12 + now.getMonth();
}

export function validateEducationEntry(
  input: EducationEntryInput,
  now: Date = new Date(),
): EntryErrors<EducationEntryField> {
  const errors: EntryErrors<EducationEntryField> = {};
  if (!input.degree.trim()) errors.degree = 'Degree is required';
  if (!input.institution.trim()) errors.institution = 'Institution name is required';

  const start = monthKey(input.startDate || '');
  if (start !== null && start > currentMonthKey(now)) {
    errors.startDate = 'Start date cannot be in the future';
  }

  if (!input.isCurrent) {
    const end = monthKey(input.endDate || '');
    if (end === null) {
      errors.endDate = 'Year of completion is required';
    } else if (Math.floor(end / 12) > now.getFullYear()) {
      errors.endDate = 'Year cannot be in the future';
    } else if (start !== null && end < start) {
      errors.endDate = 'Completion date must be after the start date';
    }
  }
  return errors;
}

export function validateExperienceEntry(
  input: ExperienceEntryInput,
  now: Date = new Date(),
): EntryErrors<ExperienceEntryField> {
  const errors: EntryErrors<ExperienceEntryField> = {};
  if (!input.role.trim()) errors.role = 'Job title is required';
  if (!input.company.trim()) errors.company = 'Company name is required';

  const nowKey = currentMonthKey(now);
  const start = monthKey(input.startDate || '');
  if (start === null) {
    errors.startDate = 'Start date is required';
  } else if (start > nowKey) {
    errors.startDate = 'Start date cannot be in the future';
  }

  if (!input.isCurrent) {
    const end = monthKey(input.endDate || '');
    if (end === null) {
      errors.endDate = 'End date is required';
    } else if (end > nowKey) {
      errors.endDate = 'End date cannot be in the future';
    } else if (start !== null && end < start) {
      errors.endDate = 'End date must be after the start date';
    }
  }
  return errors;
}

export function hasEntryErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}
