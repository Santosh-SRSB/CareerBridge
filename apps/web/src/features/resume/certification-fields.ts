import type { ResumeContent } from '@careerbridge/shared';

export type ResumeCertificationEntry = {
  name: string;
  issuer?: string | null;
  date?: string | null;
  url?: string | null;
};

/** Normalize legacy string certs and structured objects into one shape. */
export function normalizeCertificationEntry(
  value: string | ResumeCertificationEntry | null | undefined,
): ResumeCertificationEntry | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const name = value.trim();
    return name ? { name, issuer: null, date: null, url: null } : null;
  }
  const name = String(value.name || '').trim();
  if (!name) return null;
  return {
    name,
    issuer: value.issuer?.trim() || null,
    date: value.date?.trim() || null,
    url: value.url?.trim() || null,
  };
}

export function normalizeCertificationList(
  list: ResumeContent['certifications'] | null | undefined,
): ResumeCertificationEntry[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => normalizeCertificationEntry(item))
    .filter((item): item is ResumeCertificationEntry => Boolean(item));
}

/** Display: "SQL — HackerRank (January 2026)" with graceful missing fields. */
export function formatCertificationLine(cert: ResumeCertificationEntry): string {
  const name = cert.name.trim();
  if (!name) return '';
  const issuer = cert.issuer?.trim() || '';
  const date = cert.date?.trim() || '';
  if (issuer && date) return `${name} — ${issuer} (${date})`;
  if (issuer) return `${name} — ${issuer}`;
  if (date) return `${name} (${date})`;
  return name;
}
