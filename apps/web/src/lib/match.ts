import { atsMatchBandLabel } from '@careerbridge/shared';

export function matchLabel(score: number) {
  return atsMatchBandLabel(score);
}

export function formatSalary(min?: number | null, max?: number | null) {
  if (!min || !max) return 'Salary on request';
  return `₹${min.toLocaleString('en-IN')} – ₹${max.toLocaleString('en-IN')}`;
}

/** Job salaries are stored as annual CTC in rupees; show them as lakhs per annum. */
export function formatAnnualSalaryLpa(min?: number | null, max?: number | null) {
  if (!min && !max) return null;
  const lakhs = (n: number) => {
    const v = n / 100_000;
    return v >= 10 ? v.toFixed(1) : v.toFixed(2);
  };
  if (min && max) return `₹${lakhs(min)} – ${lakhs(max)} LPA`;
  if (min) return `From ₹${lakhs(min)} LPA`;
  return `Up to ₹${lakhs(max!)} LPA`;
}

export function formatJobType(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}
