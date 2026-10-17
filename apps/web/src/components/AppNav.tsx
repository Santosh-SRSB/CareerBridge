const STATUS_LABELS: Record<string, string> = {
  PUBLISHED: 'Active',
  PENDING_REVIEW: 'Pending Review',
  UNDER_REVIEW: 'Under Review',
  ON_HOLD: 'On Hold',
};

const POSITIVE = new Set(['ACTIVE', 'APPROVED', 'SELECTED', 'HIRED', 'PUBLISHED', 'CONFIRMED', 'COMPLETED']);
const NEGATIVE = new Set(['REJECTED', 'WITHDRAWN', 'CLOSED', 'SUSPENDED', 'CANCELLED']);
const WAITING = new Set(['PENDING', 'PENDING_REVIEW', 'ON_HOLD', 'UNDER_REVIEW', 'PAUSED']);
const NEUTRAL = new Set(['INACTIVE', 'DRAFT']);

export function statusBadgeTone(status: string) {
  const s = status.toUpperCase();
  if (POSITIVE.has(s)) return 'bg-emerald-100 text-emerald-800';
  if (NEGATIVE.has(s)) return 'bg-red-100 text-red-800';
  if (WAITING.has(s)) return 'bg-amber-100 text-amber-900';
  if (NEUTRAL.has(s)) return 'bg-slate-200 text-slate-800';
  return 'bg-sky-100 text-sky-900';
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-pill px-3 py-1 text-xs font-bold ${statusBadgeTone(status)}`} data-status={status}>
      {STATUS_LABELS[status] || status.replaceAll('_', ' ')}
    </span>
  );
}
