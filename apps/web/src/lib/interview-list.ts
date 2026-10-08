export type ListedInterview = {
  status: string;
  scheduledDate: string;
  scheduledAt?: string;
  durationMin?: number;
};

function interviewStartMs(item: ListedInterview) {
  const at = item.scheduledAt ? Date.parse(item.scheduledAt) : Number.NaN;
  return Number.isNaN(at) ? Date.parse(`${item.scheduledDate}T00:00:00`) : at;
}

export function isUpcomingInterview(item: ListedInterview, now = Date.now()) {
  if (item.status === 'COMPLETED' || item.status === 'CANCELLED') return false;
  const start = interviewStartMs(item);
  if (Number.isNaN(start)) return true;
  return start + (item.durationMin || 60) * 60_000 > now;
}

export function sortInterviewsByTime<T extends ListedInterview>(items: T[], direction: 'asc' | 'desc' = 'asc') {
  const sign = direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => sign * (interviewStartMs(a) - interviewStartMs(b)));
}

/**
 * The candidate's Interviews page: upcoming (soonest first) and history (latest first).
 * Cancelled interviews are never listed; the cancellation reaches the candidate as a notification.
 */
export function candidateInterviewSections<T extends ListedInterview>(items: readonly T[], now = Date.now()) {
  const listed = items.filter((item) => item.status !== 'CANCELLED');
  return {
    upcoming: sortInterviewsByTime(listed.filter((item) => isUpcomingInterview(item, now)), 'asc'),
    history: sortInterviewsByTime(listed.filter((item) => !isUpcomingInterview(item, now)), 'desc'),
  };
}
