export const SETUP_TASKS = [
  'Saving your location',
  'Recording your work status',
  'Matching job preferences',
  'Preparing your profile',
] as const;

/**
 * Number of setup tasks shown as done. `ticks` advances on a timer up to the last task; the last
 * task only completes once the saved profile has actually been confirmed.
 */
export function setupTaskStatus(ticks: number, profileReady: boolean): number {
  const timed = Math.max(0, Math.min(ticks, SETUP_TASKS.length - 1));
  if (timed === SETUP_TASKS.length - 1 && profileReady) return SETUP_TASKS.length;
  return timed;
}
