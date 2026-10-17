/**
 * Job.closedAt for a status change. Entering CLOSED stamps the close time; saving a job that is already
 * CLOSED keeps it; reopening (publish, pause or draft) clears it, so it always marks the current close and a
 * later close records the new one. `undefined` leaves the column unchanged.
 */
export function closedAtForStatusChange(from: string, to: string, now: Date): Date | null | undefined {
  if (to === 'CLOSED') return from === 'CLOSED' ? undefined : now;
  return from === 'CLOSED' ? null : undefined;
}
