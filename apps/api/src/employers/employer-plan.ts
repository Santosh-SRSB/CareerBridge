import { EMPLOYER_PLAN_SETTING_DEFAULTS, parseEmployerPlanSettings, type EmployerPlanUsage } from '@careerbridge/shared';
import type { PrismaService } from '../prisma/prisma.service';

/** Jobs that count against the plan: live or waiting for admin approval. */
export const ACTIVE_JOB_STATUSES = ['PUBLISHED', 'PENDING_REVIEW'] as const;

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

export async function employerPlanUsage(
  prisma: PrismaService,
  employerId: string,
  now = new Date(),
): Promise<EmployerPlanUsage> {
  const period = usagePeriod(now);
  const [settings, activeJobs, candidateViews] = await Promise.all([
    loadEmployerPlanSettings(prisma),
    prisma.job.count({ where: { employerId, status: { in: [...ACTIVE_JOB_STATUSES] } } }),
    prisma.employerCandidateView.count({ where: { employerId, period } }),
  ]);
  return {
    plan: 'STARTER',
    period,
    activeJobs,
    activeJobLimit: settings.starterActiveJobLimit,
    candidateViews,
    candidateViewCredits: settings.starterCandidateViewCredits,
  };
}
