/** Best completed score from sessions that expose `status` + optional `score`. */
export function bestCompletedScore(
  items: Array<{ status: string; score?: number | null }>,
  completedStatus: string | string[] = 'COMPLETED',
): number | null {
  const done = new Set(Array.isArray(completedStatus) ? completedStatus : [completedStatus]);
  const scores = items
    .filter((item) => done.has(item.status) && typeof item.score === 'number')
    .map((item) => item.score as number);
  return scores.length ? Math.max(...scores) : null;
}

/** Passport Interview score: best of AI/classic interviews and human mocks. */
export function passportInterviewScore(
  interviews: Array<{ status: string; score?: number | null; mode?: string | null }>,
  humanMocks: Array<{ status: string; score?: number | null }> = [],
): number | null {
  const ai = bestCompletedScore(interviews);
  const human = bestCompletedScore(humanMocks);
  if (ai == null && human == null) return null;
  return Math.max(ai ?? 0, human ?? 0);
}
