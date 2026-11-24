import {
  getEmployerSubscriptionPlan,
  EMPLOYER_PLAN_SETTING_DEFAULTS,
  parseEmployerPlanSettings,
  type EmployerPlanUsage,
} from '@careerbridge/shared';
import type { PrismaService } from '../prisma/prisma.service';

/** Jobs that count against the plan: live or waiting for admin approval. */
export const ACTIVE_JOB_STATUSES = ['PUBLISHED', 'PENDING_REVIEW'] as const;

/** Legacy calendar-month bucket (India) when no paid subscription period exists. */
export function usagePeriod(now = new Date()): string {
  const ist = new Date(now.getTime() + 330 * 60_000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function loadEmployerPlanSettings(prisma: PrismaService) {
  const rows = await prisma.platformSetting.findMany({
    where: { key: { in: Object.keys(EMPLOYER_PLAN_SETTING_DEFAULTS) } },
  });
  return parseEmployerPlanSettings(Object.fromEntries(rows.map((row) => [row.key, row.value])));
}

/**
 * Authoritative usage for entitlement checks.
 * Prefer active EmployerSubscription catalogue limits; fall back to legacy platform_settings.
 */
export async function employerPlanUsage(
  prisma: PrismaService,
  employerId: string,
  now = new Date(),
): Promise<EmployerPlanUsage> {
  const [activeJobs, subscription] = await Promise.all([
    prisma.job.count({ where: { employerId, status: { in: [...ACTIVE_JOB_STATUSES] } } }),
    prisma.employerSubscription.findFirst({
      where: {
        employerId,
        status: 'ACTIVE',
        endsAt: { gt: now },
      },
      orderBy: { endsAt: 'desc' },
    }),
  ]);

  if (subscription) {
    const catalog = getEmployerSubscriptionPlan(subscription.planId);
    const period = `sub:${subscription.id}`;
    const candidateViews = await prisma.employerCandidateView.count({
      where: { employerId, period },
    });
    return {
      plan: (catalog?.name || subscription.planId).toUpperCase(),
      planId: subscription.planId,
      subscriptionActive: true,
      endsAt: subscription.endsAt.toISOString(),
      period,
      activeJobs,
      activeJobLimit: catalog?.activeJobLimit ?? 0,
      candidateViews,
      candidateViewCredits: catalog?.candidateViewCredits ?? 0,
      loginSeats: catalog?.loginSeats ?? null,
    };
  }

  const period = usagePeriod(now);
  const candidateViews = await prisma.employerCandidateView.count({
    where: { employerId, period },
  });
  return {
    plan: 'NONE',
    planId: null,
    subscriptionActive: false,
    endsAt: null,
    period,
    activeJobs,
    // No paid plan: block publish/views (guide §9.2 VERIFIED / PLAN_NOT_PURCHASED).
    activeJobLimit: 0,
    candidateViews,
    candidateViewCredits: 0,
    loginSeats: null,
  };
}

/** @deprecated Exported for tests that still seed platform settings. */
export { parseEmployerPlanSettings };
