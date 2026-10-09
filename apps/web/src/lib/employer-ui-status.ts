export type EvTone = 'default' | 'green' | 'blue' | 'amber' | 'hired' | 'red' | 'purple' | 'grey';

const APPLICATION_META: Record<string, { label: string; tone: EvTone }> = {
  APPLIED: { label: 'Applied', tone: 'blue' },
  UNDER_REVIEW: { label: 'Under review', tone: 'blue' },
  SHORTLISTED: { label: 'Shortlisted', tone: 'green' },
  INTERVIEW: { label: 'Interview', tone: 'amber' },
  ON_HOLD: { label: 'On hold', tone: 'amber' },
  SELECTED: { label: 'Selected', tone: 'hired' },
  HIRED: { label: 'Hired', tone: 'hired' },
  REJECTED: { label: 'Rejected', tone: 'red' },
  WITHDRAWN: { label: 'Withdrawn', tone: 'grey' },
};

const INTERVIEW_META: Record<string, { label: string; tone: EvTone }> = {
  PROPOSED: { label: 'Awaiting confirmation', tone: 'amber' },
  SCHEDULED: { label: 'Awaiting confirmation', tone: 'amber' },
  CONFIRMED: { label: 'Confirmed', tone: 'green' },
  RESCHEDULE_NEEDED: { label: 'Waiting for availability', tone: 'purple' },
  RESCHEDULE_REQUESTED: { label: 'New time proposed', tone: 'purple' },
  COMPLETED: { label: 'Completed', tone: 'hired' },
  CANCELLED: { label: 'Cancelled', tone: 'red' },
};

function titleCase(raw: string) {
  const text = raw.replaceAll('_', ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function applicationStatusMeta(status: string | null | undefined) {
  const key = String(status || '').toUpperCase();
  return APPLICATION_META[key] || { label: key ? titleCase(key) : '—', tone: 'default' as EvTone };
}

export function interviewStatusMeta(status: string | null | undefined) {
  const key = String(status || '').toUpperCase();
  return INTERVIEW_META[key] || { label: key ? titleCase(key) : '—', tone: 'default' as EvTone };
}

/** Job status → reference `.st` chip modifier. */
export function jobStatusChip(status: string | null | undefined): '' | 'active' | 'paused' | 'closed' | 'pending' {
  const key = String(status || '').toUpperCase();
  if (key === 'PUBLISHED') return 'active';
  if (key === 'PAUSED') return 'paused';
  if (key === 'CLOSED') return 'closed';
  if (key === 'PENDING_REVIEW') return 'pending';
  return '';
}

/** Pipeline progress (0–3) for the mini stepper: Applied → Shortlisted → Interview → Hired. */
export function pipelineStage(status: string | null | undefined): number {
  const key = String(status || '').toUpperCase();
  if (key === 'HIRED' || key === 'SELECTED') return 3;
  if (key === 'INTERVIEW') return 2;
  if (key === 'SHORTLISTED') return 1;
  if (key === 'REJECTED' || key === 'WITHDRAWN') return -1;
  return 0;
}

/** Bar colour for a handbook match band (EXCELLENT/GOOD/MODERATE/LOW). */
export function matchBarTone(band: string): 'good' | 'mid' | 'low' {
  if (band === 'EXCELLENT' || band === 'GOOD') return 'good';
  if (band === 'MODERATE') return 'mid';
  return 'low';
}

/** Handbook band colour → reference pill tone. */
export function matchPillTone(color: string): EvTone {
  if (color === 'green') return 'green';
  if (color === 'blue') return 'blue';
  if (color === 'amber') return 'amber';
  return 'default';
}

export function initials(name: string | null | undefined, fallback = '?') {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return fallback;
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
