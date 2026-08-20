import { normalizeHttpUrl } from './candidate';

export const PERSON_NAME_PATTERN = /^[A-Za-z]+(?:[ .'-][A-Za-z]+)*\.?$/;
export const MAX_RECORD_YEAR = new Date().getFullYear() + 1;
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const PHOTO_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export function personNameError(value: string, emptyMessage = 'Enter your full name.') {
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length < 2) return emptyMessage;
  if (name.length > 80) return 'Name is too long.';
  if (!PERSON_NAME_PATTERN.test(name)) return 'Enter a valid name using letters only.';
  return null;
}

export function dateOfBirthError(value: string, required = true) {
  if (!value.trim()) return required ? 'Enter your date of birth.' : null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Enter a valid date of birth.';
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (date > today) return 'Date of birth cannot be in the future.';
  const age = (today.getTime() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (age < 14) return 'You must be at least 14 years old.';
  if (age > 80) return 'Enter a realistic date of birth.';
  return null;
}

export function yearError(value: string, required = false) {
  if (!value.trim()) return required ? 'Enter the year.' : null;
  if (!/^\d{4}$/.test(value)) return 'Enter a 4-digit year.';
  const year = Number(value);
  if (year < 1970 || year > MAX_RECORD_YEAR) return `Enter a year between 1970 and ${MAX_RECORD_YEAR}.`;
  return null;
}

export function yearNumberError(year?: number | null) {
  if (year == null) return null;
  return yearError(String(year));
}

export function dateRangeError(start: string, end: string, currentRole = false) {
  if (start) {
    const startDate = new Date(start);
    if (Number.isNaN(startDate.getTime())) return 'Enter a valid start date.';
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (startDate > today) return 'Start date cannot be in the future.';
  }
  if (!currentRole && start && end) {
    const endDate = new Date(end);
    if (Number.isNaN(endDate.getTime())) return 'Enter a valid end date.';
    if (endDate < new Date(start)) return 'End date cannot be before the start date.';
  }
  return null;
}

export function optionalUrlError(value: string) {
  if (!value.trim()) return null;
  if (!normalizeHttpUrl(value)) return 'Enter a valid website link.';
  return null;
}

export function salaryRangeError(minValue: string, maxValue: string) {
  const min = Number(minValue);
  const max = Number(maxValue);
  if (minValue && !Number.isFinite(min)) return 'Enter a valid starting salary.';
  if (maxValue && !Number.isFinite(max)) return 'Enter a valid maximum salary.';
  if (minValue && maxValue && min > max) return 'Maximum salary cannot be less than starting salary.';
  if ((minValue && min < 0) || (maxValue && max < 0)) return 'Salary cannot be negative.';
  return null;
}

export function emailError(value: string, required = true) {
  if (!value.trim()) return required ? 'Enter a valid email address.' : null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Enter a valid email address.';
  return null;
}

export function photoFileError(type: string, size: number) {
  if (!PHOTO_MIME_TYPES.includes(type.toLowerCase())) return 'Choose a JPG, PNG, or WebP photo.';
  if (size > PHOTO_MAX_BYTES) return 'Photo must be 8 MB or smaller.';
  return null;
}
