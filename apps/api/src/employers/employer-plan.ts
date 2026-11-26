import {
  getEmployerSubscriptionPlan,
  EMPLOYER_PLAN_SETTING_DEFAULTS,
  parseEmployerPlanSettings,
  subscriptionExpiredMessage,
  subscriptionRequiredMessage,
  type EmployerPlanUsage,
} from '@careerbridge/shared';
import type { PrismaService } from '../prisma/prisma.service';

/** Jobs that count against the plan: live or waiting for admin approval. */
export const ACTIVE_JOB_STATUSES = ['PUBLISHED', 'PENDING_REVIEW'] as const;

/**
 * Prod safety switch. Default OFF = keep current live free-Starter behaviour
 * (platform_settings). Set EMPLOYER_SUBSCRIPTIONS_LIVE=true only after migrate,
 * Razorpay prod webhook/domain, and explicit go-live approval.
 */
export function employerSubscriptionsLive(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    String(process.env.EMPLOYER_SUBSCRIPTIONS_LIVE || '')
      .trim()
      .toLowerCase(),
  );
}

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

/** Active employer logins on a company — owner counts toward the seat limit (OD-07). */
export async function countCompanyLoginSeats(prisma: PrismaService, companyId: string): Promise<number> {
  const rows = await prisma.employer.findMany({
    where: {
      companyId,
      user: {
        status: 'ACTIVE',
        userType: { in: ['EMPLOYER_ADMIN', 'EMPLOYER_RECRUITER'] },
      },
    },
    select: { id: true },
  });
  return rows.length;
}

/**
 * Catalogue seat limit from the best active subscription among employers on this company.
 * null = no paid plan yet, or Enterprise (unlimited).
 */
export async function companyLoginSeatLimit(
  prisma: PrismaService,
  companyId: string,
  now = new Date(),
): Promise<number | null> {
  const members = await prisma.employer.findMany({
    where: { companyId },
    select: { id: true },
  });
  if (!members.length) return null;
  const sub = await prisma.employerSubscription.findFirst({
    where: {
      employerId: { in: members.map((m) => m.id) },
      status: 'ACTIVE',
      endsAt: { gt: now },
    },
    orderBy: { endsAt: 'desc' },
  });
  if (!sub) return null;
  const snap = parseSubscriptionEntitlementSnapshot(
    (sub as { entitlementsJson?: string | null }).entitlementsJson,
  );
  return snap?.loginSeats ?? getEmployerSubscriptionPlan(sub.planId)?.loginSeats ?? null;
}

/**
 * Authoritative usage for entitlement checks.
 * When EMPLOYER_SUBSCRIPTIONS_LIVE is off: identical to pre-subscription main (free Starter settings).
 * When on: paid EmployerSubscription catalogue / offer snapshot.
 */
export async function employerPlanUsage(
  prisma: PrismaService,
  employerId: string,
  now = new Date(),
): Promise<EmployerPlanUsage> {
  const activeJobs = await prisma.job.count({
    where: { employerId, status: { in: [...ACTIVE_JOB_STATUSES] } },
  });

  const [subscription, employer] = await Promise.all([
    prisma.employerSubscription.findFirst({
      where: {
        employerId,
        status: 'ACTIVE',
        endsAt: { gt: now },
      },
      orderBy: { endsAt: 'desc' },
    }),
    prisma.employer.findFirst({
      where: { id: employerId },
      select: { companyId: true },
    }),
  ]);

  const companyId = employer?.companyId ?? null;
  const loginSeatsUsed = companyId
    ? await countCompanyLoginSeats(prisma, companyId)
    : subscription
      ? 1
      : null;

  // While LIVE is off: only Super Admin grants (paymentId null) override legacy free.
  // Paid rows stay ignored until EMPLOYER_SUBSCRIPTIONS_LIVE=true (no prod surprise limits).
  const honorSubscription =
    Boolean(subscription) &&
    (employerSubscriptionsLive() ||
      (subscription as { paymentId?: string | null } | null)?.paymentId == null);

  if (subscription && honorSubscription) {
    const catalog = getEmployerSubscriptionPlan(subscription.planId);
    const snap = parseSubscriptionEntitlementSnapshot(
      (subscription as { entitlementsJson?: string | null }).entitlementsJson,
    );
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
      // null catalogue limits (Enterprise) → 0 = unlimited in shared helpers
      activeJobLimit: snap?.activeJobLimit ?? catalog?.activeJobLimit ?? 0,
      candidateViews,
      candidateViewCredits: snap?.candidateViewCredits ?? catalog?.candidateViewCredits ?? 0,
      loginSeats: snap?.loginSeats ?? catalog?.loginSeats ?? null,
      loginSeatsUsed,
    };
  }

  // --- Live-safe default: do not change prod employer behaviour until flag is ON ---
  if (!employerSubscriptionsLive()) {
    const period = usagePeriod(now);
    const [settings, candidateViews] = await Promise.all([
      loadEmployerPlanSettings(prisma),
      prisma.employerCandidateView.count({ where: { employerId, period } }),
    ]);
    return {
      plan: 'STARTER',
      planId: null,
      subscriptionActive: true,
      endsAt: null,
      period,
      activeJobs,
      activeJobLimit: settings.starterActiveJobLimit,
      candidateViews,
      candidateViewCredits: settings.starterCandidateViewCredits,
      loginSeats: null,
      loginSeatsUsed: null,
    };
  }

  const period = usagePeriod(now);
  const candidateViews = await prisma.employerCandidateView.count({
    where: { employerId, period },
  });
  const companySeats = companyId ? await companyLoginSeatLimit(prisma, companyId, now) : null;
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
    loginSeats: companySeats,
    loginSeatsUsed,
  };
}

/** Distinct expired vs never-purchased copy for publish/view gates. */
export async function employerSubscriptionBlockMessage(
  prisma: PrismaService,
  employerId: string,
  now = new Date(),
): Promise<string> {
  const active = await prisma.employerSubscription.findFirst({
    where: { employerId, status: 'ACTIVE', endsAt: { gt: now } },
    select: { id: true },
  });
  if (active) return subscriptionRequiredMessage();
  const prior = await prisma.employerSubscription.findFirst({
    where: { employerId },
    select: { id: true },
  });
  return prior ? subscriptionExpiredMessage() : subscriptionRequiredMessage();
}

/** Purchase snapshot on EmployerSubscription.entitlementsJson (Enterprise / plan versioning). */
export type SubscriptionEntitlementSnapshot = {
  activeJobLimit?: number | null;
  loginSeats?: number | null;
  candidateViewCredits?: number | null;
  advancedCandidateFilters?: boolean;
  candidateDatabaseShortlist?: boolean;
  jobPerformanceReports?: boolean;
};

export function parseSubscriptionEntitlementSnapshot(
  raw: string | null | undefined,
): SubscriptionEntitlementSnapshot | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as SubscriptionEntitlementSnapshot;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** @deprecated Exported for tests that still seed platform settings. */
export { parseEmployerPlanSettings };
