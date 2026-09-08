const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Format YYYY-MM from <input type="month"> to "January 2025" */
export function formatMonthLabel(value: string): string {
  if (!value) return '';
  const [year, month] = value.split('-');
  const idx = Number(month) - 1;
  if (!year || idx < 0 || idx > 11) return value;
  return `${MONTH_NAMES[idx]} ${year}`;
}

export function formatMonthRange(start: string, end: string, isCurrent: boolean): string {
  const parts: string[] = [];
  if (start) parts.push(formatMonthLabel(start));
  if (isCurrent) parts.push('Present');
  else if (end) parts.push(formatMonthLabel(end));
  return parts.join(' – ');
}

export function formatEducationYearRange(start: string, end: string): string {
  const startYear = start?.split('-')[0] || '';
  const endYear = end?.split('-')[0] || '';
  if (startYear && endYear) return `${startYear} – ${endYear}`;
  return startYear || endYear;
}

export function formatDateForResume(value: string): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}$/.test(value)) return formatMonthLabel(value);
  return value;
}
