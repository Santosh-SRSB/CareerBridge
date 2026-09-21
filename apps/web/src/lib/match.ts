import { atsMatchBandLabel } from '@careerbridge/shared';

export function matchLabel(score: number) {
  return atsMatchBandLabel(score);
}

export function formatSalary(min?: number | null, max?: number | null) {
  if (!min || !max) return 'Salary on request';
  return `₹${min.toLocaleString('en-IN')} – ₹${max.toLocaleString('en-IN')}`;
}

export function formatJobType(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}
