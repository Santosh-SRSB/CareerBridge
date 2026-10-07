/** Admin Interviews page: stakeholder statuses derived server-side (`adminStatus`). */
export const ADMIN_INTERVIEW_STATUS_OPTIONS = [
  { value: 'PROFILE_SHORTLISTED', label: 'Profile Shortlisted' },
  { value: 'INTERVIEW_SCHEDULED', label: 'Interview Scheduled' },
  { value: 'INTERVIEW_RESCHEDULED', label: 'Interview Rescheduled' },
  { value: 'FEEDBACK_PENDING', label: 'Feedback Pending' },
  { value: 'SELECTED', label: 'Selected' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const;

export type AdminInterviewStatus = (typeof ADMIN_INTERVIEW_STATUS_OPTIONS)[number]['value'];

const LABELS = new Map<string, string>(ADMIN_INTERVIEW_STATUS_OPTIONS.map((o) => [o.value, o.label]));

export function adminInterviewStatusLabel(status: unknown): string | null {
  return typeof status === 'string' ? LABELS.get(status) ?? null : null;
}

/** Readable interview WhatsApp state, e.g. RESCHEDULE_NEEDED_VIA_WA → "Reschedule requested via WhatsApp". */
export function adminWhatsAppStatusLabel(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim().toUpperCase();
  const via = raw.endsWith('_VIA_WA') ? ' via WhatsApp' : raw.endsWith('_VIA_PORTAL') ? ' via portal' : '';
  const core = raw.replace(/_VIA_(WA|PORTAL)$/, '');
  const phrase = core.startsWith('RESCHEDULE_')
    ? 'Reschedule requested'
    : core.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
  return `${phrase}${via}`;
}

export type AdminInterviewFlowStep = { key: string; label: string; current: boolean };

/**
 * The stakeholder flow with the record's current stage marked. Stages are a map, not a history:
 * a record may skip stages (e.g. never rescheduled). Cancelled sits outside the flow.
 */
export function adminInterviewFlowSteps(status: unknown): { steps: AdminInterviewFlowStep[]; cancelled: boolean } {
  const s = typeof status === 'string' ? status : '';
  const outcome = s === 'SELECTED' || s === 'REJECTED';
  const steps: AdminInterviewFlowStep[] = [
    { key: 'PROFILE_SHORTLISTED', label: 'Profile Shortlisted', current: s === 'PROFILE_SHORTLISTED' },
    { key: 'INTERVIEW_SCHEDULED', label: 'Interview Scheduled', current: s === 'INTERVIEW_SCHEDULED' },
    { key: 'INTERVIEW_RESCHEDULED', label: 'Interview Rescheduled', current: s === 'INTERVIEW_RESCHEDULED' },
    { key: 'FEEDBACK_PENDING', label: 'Feedback Pending', current: s === 'FEEDBACK_PENDING' },
    {
      key: 'OUTCOME',
      label: outcome ? (adminInterviewStatusLabel(s) as string) : 'Selected / Rejected',
      current: outcome,
    },
  ];
  return { steps, cancelled: s === 'CANCELLED' };
}
