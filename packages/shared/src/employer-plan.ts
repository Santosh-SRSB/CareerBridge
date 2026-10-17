/** Starter (free) plan allowances. Super Admin can change them in Settings; 0 means unlimited. */
export const EMPLOYER_PLAN_SETTING_DEFAULTS = {
  'billing.starterActiveJobLimit': '5',
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
  plan: 'STARTER';
  /** Calendar month in India time, YYYY-MM. */
  period: string;
  activeJobs: number;
  /** 0 = unlimited. */
  activeJobLimit: number;
  candidateViews: number;
  /** 0 = unlimited. */
  candidateViewCredits: number;
};

export function activeJobLimitReached(usage: Pick<EmployerPlanUsage, 'activeJobs' | 'activeJobLimit'>) {
  return usage.activeJobLimit > 0 && usage.activeJobs >= usage.activeJobLimit;
}

export function candidateViewCreditsLeft(usage: Pick<EmployerPlanUsage, 'candidateViews' | 'candidateViewCredits'>) {
  if (usage.candidateViewCredits <= 0) return null;
  return Math.max(0, usage.candidateViewCredits - usage.candidateViews);
}

export function activeJobLimitMessage(limit: number) {
  return `Your Starter plan allows up to ${limit} active jobs. Close or pause a job, or buy more credits, to publish this one.`;
}

export function candidateViewLimitMessage(limit: number) {
  return `You have used all ${limit} candidate profile views included this month. Buy more credits to view more candidates.`;
}
