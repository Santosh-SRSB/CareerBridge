export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];

export const COMPANY_SIZE_LABELS: Record<CompanySize, string> = {
  '1-10': '1–10 employees',
  '11-50': '11–50 employees',
  '51-200': '51–200 employees',
  '201-500': '201–500 employees',
  '500+': '500+ employees',
};

export const COMPANY_INDUSTRIES = [
  'BPO / Customer Service',
  'IT / Software',
  'Healthcare',
  'Retail',
  'Manufacturing',
  'Logistics / Supply Chain',
  'Banking / Financial Services',
  'Education / Training',
  'Hospitality / Travel',
  'Construction / Real Estate',
  'Telecom',
  'Media / Marketing',
  'Government / Public Sector',
  'Other',
] as const;

export const COMPANY_ABOUT_MAX = 1000;

export function isCompanySize(value: string): value is CompanySize {
  return (COMPANY_SIZES as readonly string[]).includes(value);
}

/** Empty is allowed (optional field); otherwise an https URL on linkedin.com. */
export function parseLinkedinUrl(raw: string): { ok: true; value: string | null } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, message: 'Enter a valid LinkedIn URL, e.g. https://www.linkedin.com/company/your-company.' };
  }
  const host = url.hostname.toLowerCase();
  if (!['http:', 'https:'].includes(url.protocol) || !(host === 'linkedin.com' || host.endsWith('.linkedin.com'))) {
    return { ok: false, message: 'Enter a valid LinkedIn URL, e.g. https://www.linkedin.com/company/your-company.' };
  }
  url.protocol = 'https:';
  return { ok: true, value: url.toString() };
}
