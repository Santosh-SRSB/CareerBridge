export function matchLabel(score: number) {
  if (score >= 80) return 'Strong Match';
  if (score >= 60) return 'Good Match';
  if (score >= 40) return 'Potential Match';
  return 'Limited Match';
}

export function formatSalary(min?: number | null, max?: number | null) {
  if (!min || !max) return 'Salary on request';
  return `₹${min.toLocaleString('en-IN')} – ₹${max.toLocaleString('en-IN')}`;
}

export function formatJobType(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}
