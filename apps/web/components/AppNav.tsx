export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'SELECTED' || status === 'HIRED' || status === 'PUBLISHED'
      ? 'text-success bg-primary-soft'
      : status === 'REJECTED' || status === 'WITHDRAWN' || status === 'CLOSED'
        ? 'text-error bg-accent-soft'
        : 'bg-teal text-primary';
  return (
    <span className={`rounded-pill px-3 py-1 text-xs font-bold ${tone}`}>
      {status.replaceAll('_', ' ')}
    </span>
  );
}
