/** Employer usage helpers. Limits prefer active paid subscription; legacy platform_settings remain fallback. */

export const EMPLOYER_PLAN_SETTING_DEFAULTS = {
  'billing.starterActiveJobLimit': '0',
  'billing.starterCandidateViewCredits': '100',
} as const;

export type EmployerPlanSettingKey = keyof typeof EMPLOYER_PLAN_SETTING_DEFAULTS;

export type EmployerPlanSettings = { starterActiveJobLimit: number; starterCandidateViewCredits: number };

export function parseEmployerPlanSettings(
  values: Partial<Record<string, string | null | undefined>>,
): EmployerPlanSettings {
  const limit = (key: EmployerPlanSettingKey) => {
    const raw = values[key];
    const n = raw == null || String(raw).trim() === '' ? NaN : Number(raw);
    if (!Number.isFinite(n) || n < 0) return Number(EMPLOYER_PLAN_SETTING_DEFAULTS[key]);
    return Math.floor(n);
  };
  return {
    starterActiveJobLimit: limit('billing.starterActiveJobLimit'),
    starterCandidateViewCredits: limit('billing.starterCandidateViewCredits'),
  };
}

export type EmployerPlanUsage = {
  /** Display / legacy label. Prefer `planId` for catalogue lookups. */
  plan: string;
  planId: string | null;
  /** True when a paid EmployerSubscription is ACTIVE and not past endsAt. */
  subscriptionActive: boolean;
  endsAt: string | null;
  /** Usage bucket key (subscription id or calendar month fallback). */
  period: string;
  activeJobs: number;
  /** Concurrent active job limit. 0 = unlimited (legacy settings only). */
  activeJobLimit: number;
  candidateViews: number;
  /** Period database-view allowance. 0 = unlimited (legacy settings only). */
  candidateViewCredits: number;
  /** Catalogue login seat limit; null = unlimited / unknown (Enterprise or no plan). */
  loginSeats: number | null;
  /** Active employer logins on the company (owner counts — OD-07). null when unknown. */
  loginSeatsUsed: number | null;
};

export function activeJobLimitReached(usage: Pick<EmployerPlanUsage, 'activeJobs' | 'activeJobLimit'>) {
  return usage.activeJobLimit > 0 && usage.activeJobs >= usage.activeJobLimit;
}

export function candidateViewCreditsLeft(usage: Pick<EmployerPlanUsage, 'candidateViews' | 'candidateViewCredits'>) {
  if (usage.candidateViewCredits <= 0) return null;
  return Math.max(0, usage.candidateViewCredits - usage.candidateViews);
}

export function activeJobLimitMessage(limit: number) {
  return `You have reached the active job-post limit (${limit}) for your plan. Close an existing job or upgrade your plan to publish another.`;
}

export function candidateViewLimitMessage(limit: number) {
  return `You have used all ${limit} candidate database views for this subscription period. Upgrade or renew to continue candidate discovery.`;
}

export function subscriptionRequiredMessage() {
  return 'An active employer subscription is required. Choose a plan and complete payment to continue.';
}

export function subscriptionExpiredMessage() {
  return 'Your subscription has expired. Existing records are retained, but you cannot publish or reactivate jobs until you renew.';
}

/** OD-07 — owner counts; `null` limit means unlimited (Enterprise). */
export function loginSeatLimitReached(used: number, limit: number | null) {
  return limit != null && limit > 0 && used >= limit;
}

export function loginSeatLimitMessage(limit: number) {
  return `This company has reached the recruiter login seat limit (${limit}) for its plan. Upgrade the plan or remove an existing login to add another.`;
}
