export const JOB_STATUS_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Active' },
  { value: 'PENDING_REVIEW', label: 'Pending Review' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'CLOSED', label: 'Closed' },
] as const;

export type JobStatusFilter = (typeof JOB_STATUS_FILTERS)[number]['value'];

export function jobStatusLabel(status: string) {
  if (status === 'PUBLISHED') return 'Active';
  if (status === 'PENDING_REVIEW') return 'Pending Review';
  if (status === 'CLOSED') return 'Closed';
  if (status === 'PAUSED') return 'Paused';
  if (status === 'DRAFT') return 'Draft';
  return status.replaceAll('_', ' ');
}

export function jobStatusTone(status: string) {
  if (status === 'PUBLISHED') return 'bg-emerald-100 text-emerald-800';
  if (status === 'PENDING_REVIEW') return 'bg-amber-100 text-amber-900';
  if (status === 'CLOSED') return 'bg-red-100 text-red-800';
  if (status === 'PAUSED') return 'bg-sky-100 text-sky-900';
  return 'bg-slate-200 text-slate-800';
}

export function jobPublishToast(result: unknown) {
  const status = (result as { status?: string } | null)?.status;
  return status === 'PENDING_REVIEW'
    ? 'Job submitted for review. It will be visible to candidates once approved.'
    : 'Job published successfully';
}
