import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AI_SETTING_DEFAULTS,
  type AiBudgetStatus,
  EMPLOYER_PLAN_SETTING_DEFAULTS,
  ErrorCode,
  aiBudgetStatus,
  aiUsageDayStart,
  parseAiSettings,
  registrationPasswordError,
} from '@careerbridge/shared';
import { UserStatus, UserType } from '../prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { hashPlatformPassword, verifyPassword } from '../auth/password.util';
import { EmployersService } from '../employers/employers.service';
import { employerPlanUsage, usagePeriod } from '../employers/employer-plan';
import { closedAtForStatusChange } from '../employers/job-lifecycle';
import { ACTIVE_INTERVIEW_STATUSES, INTERVIEW_RESCHEDULED_AUDIT_ACTION } from '../employers/employer-policy';
import {
  adminInterviewStatusLabel,
  deriveAdminInterviewStatus,
  isAdminInterviewStatus,
  isRawEmployerInterviewStatus,
} from './admin-interview-status';
import {
  buildWorkbook,
  CANDIDATE_REPORT_COLUMNS,
  type CandidateReportRow,
  EMPLOYER_REPORT_COLUMNS,
  filterSummary,
  REPORT_EXPORT_BATCH,
  REPORT_EXPORT_MAX_ROWS,
  type ReportFile,
  reportFileName,
  SUMMARY_COLUMNS,
  type SummaryRow,
} from './admin-report-export';

import {
  compareEmployerJobRows,
  daysRequirementOpen,
  type EmployerJobReportRow,
  istDate,
  JOB_STATUS_LABELS,
  jobClosedDate,
  jobPostedAt,
  POSTED_JOB_WHERE,
  type ReportInterview,
  SHORTLIST_REACHED_APPLICATION_STATUSES,
  summariseJobInterviews,
} from './employer-job-report';
import { buildCandidateProgress, buildEmployerProgress } from './admin-progress-report';
import { adminStatusAuditAction, toAdminStatusResult, toUserStatusResult } from './admin-status';
import {
  bucketFor,
  JOB_POSTING_PROVIDER_REF_PREFIX,
  type PaymentStatusGroup,
  paiseToInr,
  REVENUE_DEFINITION,
  revenueBySource,
} from './admin-revenue';

/** Rows the Reports page table shows; the Excel export includes every row. */
const EMPLOYER_REPORT_VIEW_LIMIT = 500;

type CandidateListFilters = { location?: string; skill?: string; status?: string; from?: string; to?: string };

const ACCOUNT_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];

const DEFAULT_SETTINGS: Record<string, string> = {
  // Workflow: Settings → Platform / Resume / ATS / AI / Notifications / System
  'platform.maintenanceMode': 'false',
  'resume.atsEnabled': 'true',
  'resume.maxVersions': '10',
  'ats.scoreThreshold': '60',
  'ats.scoreVersion': 'v1',
  'ats.matchingEnabled': 'true',
  ...AI_SETTING_DEFAULTS,
  ...EMPLOYER_PLAN_SETTING_DEFAULTS,
  'notifications.enabled': 'true',
  'notifications.remindersEnabled': 'true',
  'notifications.templatesEnabled': 'true',
  'system.auditRetentionDays': '365',
};

const ALLOWED_SETTING_KEYS = new Set(Object.keys(DEFAULT_SETTINGS));

const STAFF_ROLES = new Set<string>(['SUPER_ADMIN', 'PLATFORM_ADMIN', 'PLATFORM_OPERATOR']);

const IST_OFFSET_MS = 330 * 60_000;

const ADMIN_LIST_LIMIT = 100;
/** Rows scanned before applying a derived-status filter (the derived status is not a DB column). */
const ADMIN_INTERVIEW_SCAN_LIMIT = 500;

/** Parses a YYYY-MM-DD filter as the start or end of that day in India time. */
export function parseDateFilter(raw: string | undefined, edge: 'start' | 'end'): Date | null {
  const value = raw?.trim();
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const utc = match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : NaN;
  if (!match || Number.isNaN(utc) || new Date(utc).getUTCDate() !== Number(match[3])) {
    throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Dates must use the YYYY-MM-DD format.' });
  }
  const startIst = utc - IST_OFFSET_MS;
  return new Date(edge === 'start' ? startIst : startIst + 24 * 60 * 60_000 - 1);
}

/** Percentage of `count` relative to `base`, one decimal; null when there is no base to compare with. */
export function conversionRate(count: number, base: number): number | null {
  if (!base) return null;
  return Math.round((count / base) * 1000) / 10;
}

function splitAliases(raw: string | null | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((alias) => alias.trim())
    .filter(Boolean);
}

function parseNameList(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/** Replaces `from` (case-insensitive) with `to` in a skill-name list, without creating duplicates. */
export function replaceSkillName(list: string[], from: string, to: string): { list: string[]; changed: boolean } {
  const fromKey = from.trim().toLowerCase();
  if (!list.some((item) => item.trim().toLowerCase() === fromKey)) return { list, changed: false };
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const next = item.trim().toLowerCase() === fromKey ? to : item;
    const key = next.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
  }
  return { list: out, changed: true };
}

/** Short, non-sensitive failure reason from a stored Graph API error payload. */
export function whatsappFailureReason(errorJson: string | null | undefined): string {
  if (!errorJson) return 'Unknown error';
  try {
    const parsed = JSON.parse(errorJson) as Record<string, unknown>;
    const err = (parsed.error && typeof parsed.error === 'object' ? parsed.error : parsed) as Record<string, unknown>;
    const first = Array.isArray(parsed.errors) ? (parsed.errors[0] as Record<string, unknown> | undefined) : undefined;
    const code = err.code ?? first?.code;
    const title = err.title ?? err.message ?? first?.title ?? first?.message;
    const text = typeof title === 'string' ? title.slice(0, 160) : 'Delivery failed';
    return code !== undefined ? `${text} (code ${String(code)})` : text;
  } catch {
    return 'Delivery failed';
  }
}

const APPLICATION_STAGE_ORDER = [
  'APPLIED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'ON_HOLD',
  'INTERVIEW',
  'SELECTED',
  'HIRED',
  'REJECTED',
  'WITHDRAWN',
] as const;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly employerService: EmployersService,
  ) {}

  private async writeAudit(input: {
    userId?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
  }) {
    await this.prisma.auditLog.create({
      data: {
        userId: input.userId || null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId || null,
        oldValue: input.oldValue == null ? null : JSON.stringify(input.oldValue),
        newValue: input.newValue == null ? null : JSON.stringify(input.newValue),
      },
    });
  }

  private async resourceActivity(resourceType: string, resourceId: string, take = 20) {
    const rows = await this.prisma.auditLog.findMany({
      where: { resourceType, resourceId },
      orderBy: { createdAt: 'desc' },
      take,
    });
    const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, userType: true },
        })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows.map((row) => ({
      id: row.id,
      time: row.createdAt.toISOString(),
      action: row.action,
      userId: row.userId,
      actor: row.userId ? byId.get(row.userId)?.email || row.userId : 'system',
      resourceType: row.resourceType,
      resourceId: row.resourceId,
    }));
  }

  /** Live AI metering from `ai_interactions` (Volume 4 wiring for admin MVP). */
  async aiUsage() {
    const [total, failed, grouped, byUserGrouped, recent] = await Promise.all([
      this.prisma.aiInteraction.count(),
      this.prisma.aiInteraction.count({ where: { status: 'FAILED' } }),
      this.prisma.aiInteraction.groupBy({
        by: ['operation'],
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true },
      }),
      this.prisma.aiInteraction.groupBy({
        by: ['userId'],
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true },
      }),
      this.prisma.aiInteraction.findMany({
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: {
          id: true,
          userId: true,
          operation: true,
          provider: true,
          model: true,
          status: true,
          inputTokens: true,
          outputTokens: true,
          estimatedCostUsd: true,
          latencyMs: true,
          createdAt: true,
          error: true,
        },
      }),
    ]);

    const costUsd = grouped.reduce((n, g) => n + (g._sum.estimatedCostUsd ?? 0), 0);
    const tokens = grouped.reduce(
      (n, g) => n + (g._sum.inputTokens ?? 0) + (g._sum.outputTokens ?? 0),
      0,
    );
    const byFeature = [...grouped]
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 20)
      .map((g) => ({
        feature: g.operation,
        requests: g._count._all,
        tokens: (g._sum.inputTokens ?? 0) + (g._sum.outputTokens ?? 0),
        estimatedCostInr: Number(((g._sum.estimatedCostUsd ?? 0) * 83).toFixed(2)),
      }));

    const userIds = byUserGrouped.map((g) => g.userId).filter(Boolean) as string[];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, userType: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    const byUser = [...byUserGrouped]
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 25)
      .map((g) => {
        const u = g.userId ? userMap.get(g.userId) : null;
        return {
          userId: g.userId,
          email: u?.email || (g.userId ? 'unknown' : 'anonymous'),
          userType: u?.userType || null,
          requests: g._count._all,
          tokens: (g._sum.inputTokens ?? 0) + (g._sum.outputTokens ?? 0),
          estimatedCostInr: Number(((g._sum.estimatedCostUsd ?? 0) * 83).toFixed(2)),
        };
      });

    return {
      totalRequests: total,
      failedRequests: failed,
      totalTokens: tokens,
      estimatedCostUsd: Number(costUsd.toFixed(4)),
      estimatedCostInr: Number((costUsd * 83).toFixed(2)),
      byFeature,
      byUser,
      recent: recent.map((r) => ({
        id: r.id,
        userId: r.userId,
        feature: r.operation,
        provider: r.provider,
        model: r.model,
        status: r.status,
        tokens: r.inputTokens + r.outputTokens,
        costInr: Number((r.estimatedCostUsd * 83).toFixed(2)),
        latencyMs: r.latencyMs,
        error: r.error,
        at: r.createdAt.toISOString(),
      })),
    };
  }

  async aiBudgetToday(): Promise<AiBudgetStatus> {
    const [rows, agg] = await Promise.all([
      this.prisma.platformSetting.findMany({ where: { key: { in: Object.keys(AI_SETTING_DEFAULTS) } } }),
      this.prisma.aiInteraction.aggregate({
        where: { createdAt: { gte: aiUsageDayStart() } },
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true },
      }),
    ]);
    return aiBudgetStatus({
      ...parseAiSettings(Object.fromEntries(rows.map((row) => [row.key, row.value]))),
      requestsToday: agg._count._all,
      tokensToday: (agg._sum.inputTokens ?? 0) + (agg._sum.outputTokens ?? 0),
    });
  }

  async dashboard() {
    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [
      candidates,
      activeCandidates,
      employers,
      openJobs,
      applications,
      interviews,
      candidateRegs7d,
      employerRegs7d,
      jobsPublished7d,
      applications7d,
      interviews7d,
      suspendedUsers,
      failedWhatsApp,
      pausedJobs,
      unreadNotifications,
      hires,
      shortlisted,
      recentCandidates,
      recentJobs,
      recentInterviews,
      aiUsage,
      aiBudget,
    ] = await Promise.all([
      this.prisma.candidate.count(),
      this.prisma.candidate.count({ where: { onboardingCompleted: true } }),
      this.prisma.employer.count(),
      this.prisma.job.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.application.count(),
      this.prisma.employerInterview.count(),
      this.prisma.candidate.count({ where: { createdAt: { gte: since7 } } }),
      this.prisma.employer.count({ where: { createdAt: { gte: since7 } } }),
      this.prisma.job.count({ where: { status: 'PUBLISHED', updatedAt: { gte: since7 } } }),
      this.prisma.application.count({ where: { createdAt: { gte: since7 } } }),
      this.prisma.employerInterview.count({ where: { createdAt: { gte: since7 } } }),
      this.prisma.user.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.whatsAppMessage.count({
        where: { status: 'FAILED' },
      }).catch(() => 0),
      this.prisma.job.count({ where: { status: 'PAUSED' } }),
      this.prisma.notification.count({ where: { readAt: null } }),
      this.prisma.application.count({ where: { status: 'HIRED' } }),
      this.prisma.application.count({ where: { status: 'SHORTLISTED' } }),
      this.prisma.candidate.findMany({
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { firstName: true, lastName: true, createdAt: true },
      }),
      this.prisma.job.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { updatedAt: 'desc' },
        take: 2,
        select: { title: true, updatedAt: true, employer: { select: { companyName: true } } },
      }),
      this.prisma.employerInterview.findMany({
        orderBy: { createdAt: 'desc' },
        take: 2,
        select: { createdAt: true, candidate: { select: { firstName: true, lastName: true } } },
      }),
      this.aiUsage(),
      this.aiBudgetToday(),
    ]);

    const recentActivity = [
      ...recentCandidates.map((c) => ({
        at: c.createdAt.toISOString(),
        label: `Candidate registered · ${[c.firstName, c.lastName].filter(Boolean).join(' ') || 'Candidate'}`,
      })),
      ...recentJobs.map((j) => ({
        at: j.updatedAt.toISOString(),
        label: `Employer published job · ${j.employer.companyName} · ${j.title}`,
      })),
      ...recentInterviews.map((i) => ({
        at: i.createdAt.toISOString(),
        label: `Interview scheduled · ${[i.candidate.firstName, i.candidate.lastName].filter(Boolean).join(' ') || 'Candidate'}`,
      })),
    ]
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 8);

    return {
      candidates,
      activeCandidates,
      employers,
      openJobs,
      applications,
      interviews,
      hires,
      funnel: {
        candidates,
        applications,
        shortlisted,
        interviews,
        hires,
      },
      recentActivity,
      systemStatus: [
        { name: 'API', status: 'Healthy' as const },
        { name: 'Database', status: 'Healthy' as const },
        { name: 'AI Gateway', status: process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY ? 'Healthy' : 'Degraded' },
        { name: 'WhatsApp', status: process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN ? 'Healthy' : 'Degraded' },
        { name: 'Storage', status: process.env.GCS_BUCKET || process.env.GOOGLE_CLOUD_STORAGE_BUCKET ? 'Healthy' : 'Degraded' },
      ],
      activity: {
        candidateRegistrations7d: candidateRegs7d,
        employerRegistrations7d: employerRegs7d,
        jobsPublished7d,
        applications7d,
        interviews7d,
      },
      alerts: {
        failedNotifications: failedWhatsApp,
        failedAiRequests: aiUsage.failedRequests,
        suspendedAccounts: suspendedUsers,
        jobsRequiringAttention: pausedJobs,
        unreadNotifications,
        aiBudget,
      },
      aiUsage,
    };
  }

  async candidates(query?: string, filters: CandidateListFilters = {}) {
    const rows = await this.prisma.candidate.findMany({
      where: this.candidateListWhere(query, filters),
      include: {
        user: { select: { phone: true, email: true, status: true, createdAt: true } },
        skills: { take: 5 },
        _count: { select: { applications: true, resumes: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      name: [row.firstName, row.lastName].filter(Boolean).join(' ') || '—',
      location: [row.city, row.state].filter(Boolean).join(', ') || '—',
      profileCompletion: row.profileCompletion ?? 0,
      primarySkills: row.skills.map((s) => s.name),
      resumeCount: row._count.resumes,
      applications: row._count.applications,
      accountStatus: row.user.status,
      email: row.user.email,
      phone: row.user.phone,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private candidateListWhere(query?: string, filters: CandidateListFilters = {}) {
    const q = query?.trim();
    const location = filters.location?.trim();
    const skill = filters.skill?.trim();
    const status = filters.status?.trim().toUpperCase();
    if (status && !ACCOUNT_STATUSES.includes(status)) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Unknown account status filter.' });
    }
    const from = parseDateFilter(filters.from, 'start');
    const to = parseDateFilter(filters.to, 'end');
    if (from && to && from > to) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'The end date must be on or after the start date.',
      });
    }
    const and: Record<string, unknown>[] = [];
    if (q) {
      and.push({
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
          { user: { email: { contains: q, mode: 'insensitive' } } },
          { user: { phone: { contains: q } } },
        ],
      });
    }
    if (location) {
      and.push({
        OR: [
          { city: { contains: location, mode: 'insensitive' } },
          { state: { contains: location, mode: 'insensitive' } },
        ],
      });
    }
    if (skill) and.push({ skills: { some: { name: { contains: skill, mode: 'insensitive' } } } });
    if (status) and.push({ user: { status } });
    if (from || to) and.push({ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } });
    return and.length ? ({ AND: and } as never) : undefined;
  }

  async candidateDetails(id: string) {
    const row = await this.prisma.candidate.findUnique({
      where: { id },
      include: {
        user: { select: { phone: true, email: true, status: true, createdAt: true } },
        skills: true,
        education: true,
        experiences: true,
        resumes: { orderBy: { updatedAt: 'desc' }, take: 5 },
        applications: {
          include: {
            job: {
              select: {
                title: true,
                employer: { select: { companyName: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        employerInterviews: {
          include: { job: { select: { title: true } }, employer: { select: { companyName: true } } },
          orderBy: { scheduledAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!row) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Candidate not found' });
    }
    return {
      id: row.id,
      name: [row.firstName, row.lastName].filter(Boolean).join(' ') || '—',
      email: row.user.email,
      phone: row.user.phone,
      accountStatus: row.user.status,
      location: [row.city, row.state].filter(Boolean).join(', ') || '—',
      profileCompletion: row.profileCompletion ?? 0,
      createdAt: row.createdAt.toISOString(),
      profile: {
        firstName: row.firstName,
        lastName: row.lastName,
        city: row.city,
        state: row.state,
        experienceLevel: row.experienceLevel,
        highestEducation: row.highestEducation,
        about: row.about,
        onboardingCompleted: row.onboardingCompleted,
      },
      highestEducation: row.highestEducation,
      skills: row.skills.map((s) => ({ id: s.id, name: s.name })),
      education: row.education,
      experience: row.experiences,
      resumes: row.resumes.map((r) => ({
        id: r.id,
        title: r.title,
        score: r.score,
        kind: r.kind,
        updatedAt: r.updatedAt.toISOString(),
      })),
      applications: row.applications.map((a) => ({
        id: a.id,
        status: a.status,
        jobTitle: a.job.title,
        companyName: a.job.employer.companyName,
        createdAt: a.createdAt.toISOString(),
      })),
      interviews: row.employerInterviews.map((i) => ({
        id: i.id,
        status: i.status,
        scheduledAt: i.scheduledAt.toISOString(),
        jobTitle: i.job.title,
        companyName: i.employer.companyName,
      })),
      activity: await this.resourceActivity('USER', row.userId).then(async (userAct) => {
        const candAct = await this.resourceActivity('CANDIDATE', row.id);
        return [...userAct, ...candAct]
          .sort((a, b) => (a.time < b.time ? 1 : -1))
          .slice(0, 25);
      }),
    };
  }

  async setCandidateStatus(actorId: string, candidateId: string, status: UserStatus) {
    const candidate = await this.prisma.candidate.findUnique({ where: { id: candidateId } });
    if (!candidate) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Candidate not found' });
    }
    return this.setUserStatus(actorId, candidate.userId, status);
  }

  async setEmployerStatus(actorId: string, employerId: string, status: UserStatus) {
    const employer = await this.prisma.employer.findUnique({ where: { id: employerId } });
    if (!employer) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Employer not found' });
    }
    return this.setUserStatus(actorId, employer.userId, status);
  }

  async applicationDetails(id: string) {
    const row = await this.prisma.application.findUnique({
      where: { id },
      include: {
        job: {
          select: {
            title: true,
            city: true,
            status: true,
            employer: { select: { companyName: true } },
          },
        },
        candidate: { select: { firstName: true, lastName: true, city: true } },
        match: { select: { totalScore: true } },
      },
    });
    if (!row) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Application not found' });
    }
    const resume = row.resumeId
      ? await this.prisma.resume.findUnique({
          where: { id: row.resumeId },
          select: { id: true, title: true, score: true, version: true, kind: true },
        })
      : null;
    return {
      id: row.id,
      status: row.status,
      matchScore: row.match?.totalScore ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      candidateName: [row.candidate.firstName, row.candidate.lastName].filter(Boolean).join(' ') || '—',
      jobTitle: row.job.title,
      companyName: row.job.employer.companyName,
      candidate: row.candidate,
      job: row.job,
      resume,
      resumeId: row.resumeId,
      activity: await this.resourceActivity('APPLICATION', id),
    };
  }

  async interviewDetails(id: string) {
    const row = await this.prisma.employerInterview.findUnique({
      where: { id },
      include: {
        job: { select: { title: true } },
        candidate: { select: { firstName: true, lastName: true } },
        employer: { select: { companyName: true } },
        application: {
          select: { status: true, hiringOutcome: { select: { outcome: true, decidedAt: true } } },
        },
      },
    });
    if (!row) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Interview not found' });
    }
    const activity = await this.resourceActivity('INTERVIEW', id);
    const employerReschedules = activity.filter((a) => a.action === INTERVIEW_RESCHEDULED_AUDIT_ACTION);
    const applicationStatus = row.application?.status ?? null;
    const adminStatus = deriveAdminInterviewStatus({
      applicationStatus,
      interview: row,
      employerRescheduled: employerReschedules.length > 0,
    });
    const whatsapp = await this.prisma.whatsAppMessage
      .findMany({
        where: { interviewId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          status: true,
          direction: true,
          templateName: true,
          toPhone: true,
          errorJson: true,
          createdAt: true,
        },
      })
      .catch(() => []);
    const outcome = row.application?.hiringOutcome;
    const events = [
      { at: row.createdAt, label: 'Interview scheduled by employer' },
      ...employerReschedules.map((a) => ({ at: new Date(a.time), label: 'Employer rescheduled the interview' })),
      { at: row.candidateRescheduleRequestedAt, label: 'Candidate asked for another time' },
      { at: row.confirmedAt, label: 'Candidate confirmed the interview' },
      { at: row.candidateFeedbackAt, label: 'Candidate shared interview feedback' },
      {
        at: outcome?.decidedAt,
        label: outcome ? `Hiring outcome recorded: ${outcome.outcome.replace(/_/g, ' ').toLowerCase()}` : '',
      },
    ]
      .filter((e): e is { at: Date; label: string } => Boolean(e.at && e.label))
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .map((e) => ({ at: e.at.toISOString(), label: e.label }));
    return {
      id: row.id,
      status: row.status,
      applicationId: row.applicationId,
      applicationStatus,
      adminStatus,
      adminStatusLabel: adminInterviewStatusLabel(adminStatus),
      mode: row.mode,
      scheduledAt: row.scheduledAt.toISOString(),
      whatsappStatus: row.whatsappStatus,
      candidateName: [row.candidate.firstName, row.candidate.lastName].filter(Boolean).join(' ') || '—',
      jobTitle: row.job.title,
      companyName: row.employer.companyName,
      statusEvents: events,
      candidate: row.candidate,
      job: row.job,
      employer: row.employer,
      notifications: whatsapp.map((m) => ({
        id: m.id,
        status: m.status,
        direction: m.direction,
        template: m.templateName,
        to: m.toPhone,
        error: m.errorJson,
        createdAt: m.createdAt.toISOString(),
      })),
      activity,
    };
  }

  async setUserStatus(actorId: string, userId: string, status: UserStatus) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'User not found' });
    }
    if (user.userType === 'SUPER_ADMIN' && status !== 'ACTIVE') {
      throw new ForbiddenException({ code: ErrorCode.FORBIDDEN, message: 'Cannot suspend a Super Admin' });
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status },
    });
    await this.writeAudit({
      userId: actorId,
      action: status === 'SUSPENDED' ? 'SUSPEND_USER' : status === 'INACTIVE' ? 'DEACTIVATE_USER' : 'ACTIVATE_USER',
      resourceType: 'USER',
      resourceId: userId,
      oldValue: { status: user.status },
      newValue: { status },
    });
    return toUserStatusResult(updated);
  }

  async employers(query?: string) {
    const q = query?.trim();
    const rows = await this.prisma.employer.findMany({
      where: q
        ? {
            OR: [
              { companyName: { contains: q, mode: 'insensitive' } },
              { user: { email: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : undefined,
      include: {
        user: { select: { phone: true, email: true, status: true, createdAt: true } },
        _count: { select: { jobs: true, interviews: true } },
        jobs: { select: { _count: { select: { applications: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      companyName: row.companyName,
      verified: row.verified,
      verificationStatus: row.verificationStatus,
      accountStatus: row.user.status,
      email: row.user.email,
      phone: row.user.phone,
      jobs: row._count.jobs,
      applications: row.jobs.reduce((n, j) => n + j._count.applications, 0),
      interviews: row._count.interviews,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async verifyEmployer(actorId: string, id: string) {
    const employer = await this.prisma.employer.findUnique({ where: { id } });
    if (!employer) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Employer was not found' });
    }
    const updated = await this.prisma.employer.update({
      where: { id },
      data: { verified: true, verificationStatus: 'VERIFIED' },
    });
    await this.writeAudit({
      userId: actorId,
      action: 'VERIFY_EMPLOYER',
      resourceType: 'EMPLOYER',
      resourceId: id,
      oldValue: { verified: employer.verified },
      newValue: { verified: true },
    });
    return updated;
  }

  /**
   * Super / platform admin opens the full employer workspace as that company
   * (post jobs, candidates, applications, interviews, profile, etc.).
   */
  async impersonateEmployer(actorId: string, employerId: string, actorRole?: string) {
    if (actorRole !== 'SUPER_ADMIN' && actorRole !== 'PLATFORM_ADMIN') {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Only super admins and platform admins can open an employer workspace.',
      });
    }

    const employer = await this.prisma.employer.findUnique({
      where: { id: employerId },
      include: {
        user: {
          select: {
            id: true,
            status: true,
            userType: true,
            phone: true,
            email: true,
          },
        },
      },
    });
    if (!employer) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Employer was not found',
      });
    }
    if (
      employer.user.userType !== 'EMPLOYER_ADMIN' &&
      employer.user.userType !== 'EMPLOYER_RECRUITER'
    ) {
      throw new BadRequestException({
        code: ErrorCode.BUSINESS_RULE_VIOLATION,
        message: 'This account is not an employer login.',
      });
    }
    if (employer.user.status === 'SUSPENDED' || employer.user.status === 'INACTIVE') {
      throw new BadRequestException({
        code: ErrorCode.BUSINESS_RULE_VIOLATION,
        message: 'Activate this employer account before opening their workspace.',
      });
    }

    const session = await this.auth.issueSessionForUserId(employer.user.id);
    await this.writeAudit({
      userId: actorId,
      action: 'IMPERSONATE_EMPLOYER',
      resourceType: 'EMPLOYER',
      resourceId: employer.id,
      newValue: {
        companyName: employer.companyName,
        employerUserId: employer.user.id,
      },
    });

    return {
      ...session,
      impersonation: {
        employerId: employer.id,
        companyName: employer.companyName,
        adminUserId: actorId,
      },
    };
  }

  async employerDetails(id: string) {
    const row = await this.prisma.employer.findUnique({
      where: { id },
      include: {
        user: { select: { phone: true, email: true, status: true, createdAt: true } },
        jobs: { select: { id: true, title: true, status: true }, orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { jobs: true, interviews: true } },
      },
    });
    if (!row) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Employer not found' });
    }
    const applications = await this.prisma.application.count({
      where: { job: { employerId: id } },
    });
    const hires = await this.prisma.application.count({
      where: { status: 'HIRED', job: { employerId: id } },
    });
    const applicationsList = await this.prisma.application.findMany({
      where: { job: { employerId: id } },
      include: {
        job: { select: { title: true } },
        candidate: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const interviewsList = await this.prisma.employerInterview.findMany({
      where: { employerId: id },
      include: {
        job: { select: { title: true } },
        candidate: { select: { firstName: true, lastName: true } },
      },
      orderBy: { scheduledAt: 'desc' },
      take: 20,
    });
    const usage = await employerPlanUsage(this.prisma, id);
    return {
      id: row.id,
      companyName: row.companyName,
      plan: {
        name: usage.plan,
        period: usage.period,
        activeJobs: usage.activeJobs,
        activeJobLimit: usage.activeJobLimit,
      },
      credits: {
        candidateViewsUsed: usage.candidateViews,
        candidateViewCredits: usage.candidateViewCredits,
        remaining:
          usage.candidateViewCredits > 0 ? Math.max(0, usage.candidateViewCredits - usage.candidateViews) : null,
      },
      email: row.user.email,
      phone: row.user.phone,
      accountStatus: row.user.status,
      verified: row.verified,
      verificationStatus: row.verificationStatus,
      city: row.city,
      createdAt: row.createdAt.toISOString(),
      counts: {
        jobs: row._count.jobs,
        interviews: row._count.interviews,
        applications,
        hires,
      },
      jobs: row.jobs,
      applications: applicationsList.map((a) => ({
        id: a.id,
        status: a.status,
        jobTitle: a.job.title,
        candidateName: [a.candidate.firstName, a.candidate.lastName].filter(Boolean).join(' ') || '—',
        createdAt: a.createdAt.toISOString(),
      })),
      interviews: interviewsList.map((i) => ({
        id: i.id,
        status: i.status,
        scheduledAt: i.scheduledAt.toISOString(),
        jobTitle: i.job.title,
        candidateName: [i.candidate.firstName, i.candidate.lastName].filter(Boolean).join(' ') || '—',
      })),
      activity: await this.resourceActivity('EMPLOYER', id),
    };
  }

  async jobs(query?: string, status?: string) {
    const q = query?.trim();
    const rows = await this.prisma.job.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { employer: { companyName: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: {
        employer: { select: { companyName: true, id: true } },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      companyName: row.employer.companyName,
      status: row.status,
      city: row.city,
      applications: row._count.applications,
      createdAt: row.createdAt.toISOString(),
      publishedAt: row.publishedAt?.toISOString() ?? null,
    }));
  }

  async jobDetails(id: string) {
    const row = await this.prisma.job.findUnique({
      where: { id },
      include: {
        employer: { select: { id: true, companyName: true, verified: true, city: true } },
        _count: { select: { applications: true } },
      },
    });
    if (!row) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Job not found' });
    }
    const applications = await this.prisma.application.findMany({
      where: { jobId: id },
      include: { candidate: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      city: row.city,
      description: row.description,
      applications: row._count.applications,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      employer: row.employer,
      applicationList: applications.map((a) => ({
        id: a.id,
        status: a.status,
        candidateName: [a.candidate.firstName, a.candidate.lastName].filter(Boolean).join(' ') || '—',
        createdAt: a.createdAt.toISOString(),
      })),
      activity: await this.resourceActivity('JOB', id),
    };
  }

  async approveJob(actorId: string, id: string) {
    return this.setJobStatus(actorId, id, 'PUBLISHED');
  }

  /** A job waiting for review goes back to Draft so the employer can fix it; a live job is taken down. */
  async rejectJob(actorId: string, id: string) {
    const job = await this.prisma.job.findUnique({ where: { id }, select: { status: true } });
    if (!job) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Job not found' });
    }
    const pending = job.status === 'PENDING_REVIEW';
    const updated = await this.setJobStatus(actorId, id, pending ? 'DRAFT' : 'CLOSED');
    await this.employerService.notifyJobRejected(id);
    return updated;
  }

  async setJobStatus(
    actorId: string,
    id: string,
    status: 'PUBLISHED' | 'PENDING_REVIEW' | 'PAUSED' | 'CLOSED' | 'DRAFT',
  ) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Job not found' });
    }
    const updated = await this.prisma.job.update({
      where: { id },
      data: {
        status,
        publishedAt: status === 'PUBLISHED' ? job.publishedAt || new Date() : job.publishedAt,
        closedAt: closedAtForStatusChange(job.status, status, new Date()),
      },
    });
    await this.writeAudit({
      userId: actorId,
      action: `JOB_${status}`,
      resourceType: 'JOB',
      resourceId: id,
      oldValue: { status: job.status },
      newValue: { status },
    });
    if (status === 'PUBLISHED' && job.status !== 'PUBLISHED') {
      const followUps = await this.employerService.completeJobApproval(id);
      return { ...updated, ...(followUps || {}) };
    }
    return updated;
  }

  async applications(query?: string, status?: string) {
    const q = query?.trim();
    const rows = await this.prisma.application.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(q
          ? {
              OR: [
                { job: { title: { contains: q, mode: 'insensitive' } } },
                { candidate: { firstName: { contains: q, mode: 'insensitive' } } },
                { candidate: { lastName: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: {
        job: {
          select: {
            title: true,
            employer: { select: { companyName: true } },
          },
        },
        candidate: { select: { firstName: true, lastName: true } },
        match: { select: { totalScore: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      matchScore: row.match?.totalScore ?? null,
      jobTitle: row.job.title,
      companyName: row.job.employer.companyName,
      candidateName: [row.candidate.firstName, row.candidate.lastName].filter(Boolean).join(' ') || '—',
      createdAt: row.createdAt.toISOString(),
    }));
  }

  /** Per-stage application counts across the whole platform (not limited to the latest 100 rows). */
  async applicationPipeline() {
    const grouped = await this.prisma.application.groupBy({ by: ['status'], _count: { _all: true } });
    const byStatus = Object.fromEntries(APPLICATION_STAGE_ORDER.map((s) => [s, 0])) as Record<string, number>;
    for (const row of grouped) byStatus[String(row.status)] = row._count._all;
    const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);
    return {
      total,
      byStatus,
      stages: [
        { stage: 'Applied', count: byStatus.APPLIED + byStatus.UNDER_REVIEW },
        { stage: 'Shortlisted', count: byStatus.SHORTLISTED + byStatus.ON_HOLD },
        { stage: 'Interview', count: byStatus.INTERVIEW },
        { stage: 'Selected', count: byStatus.SELECTED + byStatus.HIRED },
        { stage: 'Rejected', count: byStatus.REJECTED },
      ],
    };
  }

  /**
   * Interview rows plus shortlisted applications that have no active interview yet, each with the
   * Admin-only derived `adminStatus`. `status` accepts an admin status key or (back-compat) a raw
   * EmployerInterview status.
   */
  async interviews(query?: string, status?: string) {
    const q = query?.trim();
    const filter = status?.trim().toUpperCase() || '';
    const adminFilter = isAdminInterviewStatus(filter) ? filter : null;
    const rawFilter = !adminFilter && isRawEmployerInterviewStatus(filter) ? filter : null;
    if (filter && !adminFilter && !rawFilter) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Unknown interview status filter.' });
    }
    const name = (c: { firstName: string | null; lastName: string | null }) =>
      [c.firstName, c.lastName].filter(Boolean).join(' ') || '—';

    type ListRow = {
      id: string;
      recordType: 'INTERVIEW' | 'APPLICATION';
      interviewId: string | null;
      applicationId: string;
      status: string | null;
      applicationStatus: string | null;
      adminStatus: string | null;
      adminStatusLabel: string | null;
      mode: string | null;
      scheduledAt: string | null;
      whatsappStatus: string | null;
      jobTitle: string;
      companyName: string;
      candidateName: string;
      sortAt: number;
    };

    const result: ListRow[] = [];
    if (adminFilter !== 'PROFILE_SHORTLISTED') {
      const rows = await this.prisma.employerInterview.findMany({
        where: {
          ...(rawFilter ? { status: rawFilter as never } : {}),
          ...(q
            ? {
                OR: [
                  { job: { title: { contains: q, mode: 'insensitive' } } },
                  { candidate: { firstName: { contains: q, mode: 'insensitive' } } },
                  { employer: { companyName: { contains: q, mode: 'insensitive' } } },
                ],
              }
            : {}),
        },
        include: {
          job: { select: { title: true } },
          candidate: { select: { firstName: true, lastName: true } },
          employer: { select: { companyName: true } },
          application: { select: { status: true } },
        },
        orderBy: { scheduledAt: 'desc' },
        take: adminFilter ? ADMIN_INTERVIEW_SCAN_LIMIT : ADMIN_LIST_LIMIT,
      });
      const rescheduled = await this.employerRescheduledInterviewIds(rows.map((r) => r.id));
      const now = new Date();
      for (const row of rows) {
        const applicationStatus = row.application?.status ?? null;
        const adminStatus = deriveAdminInterviewStatus({
          applicationStatus,
          interview: row,
          employerRescheduled: rescheduled.has(row.id),
          now,
        });
        result.push({
          id: row.id,
          recordType: 'INTERVIEW',
          interviewId: row.id,
          applicationId: row.applicationId,
          status: row.status,
          applicationStatus,
          adminStatus,
          adminStatusLabel: adminInterviewStatusLabel(adminStatus),
          mode: row.mode,
          scheduledAt: row.scheduledAt.toISOString(),
          whatsappStatus: row.whatsappStatus,
          jobTitle: row.job.title,
          companyName: row.employer.companyName,
          candidateName: name(row.candidate),
          sortAt: row.scheduledAt.getTime(),
        });
      }
    }

    if (!rawFilter && (!adminFilter || adminFilter === 'PROFILE_SHORTLISTED')) {
      const apps = await this.prisma.application.findMany({
        where: {
          status: 'SHORTLISTED',
          employerInterviews: { none: { status: { in: [...ACTIVE_INTERVIEW_STATUSES] } } },
          ...(q
            ? {
                OR: [
                  { job: { title: { contains: q, mode: 'insensitive' } } },
                  { candidate: { firstName: { contains: q, mode: 'insensitive' } } },
                  { job: { employer: { companyName: { contains: q, mode: 'insensitive' } } } },
                ],
              }
            : {}),
        },
        include: {
          job: { select: { title: true, employer: { select: { companyName: true } } } },
          candidate: { select: { firstName: true, lastName: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: ADMIN_LIST_LIMIT,
      });
      for (const app of apps) {
        const adminStatus = deriveAdminInterviewStatus({ applicationStatus: app.status, interview: null });
        result.push({
          id: app.id,
          recordType: 'APPLICATION',
          interviewId: null,
          applicationId: app.id,
          status: null,
          applicationStatus: app.status,
          adminStatus,
          adminStatusLabel: adminInterviewStatusLabel(adminStatus),
          mode: null,
          scheduledAt: null,
          whatsappStatus: null,
          jobTitle: app.job.title,
          companyName: app.job.employer.companyName,
          candidateName: name(app.candidate),
          sortAt: app.updatedAt.getTime(),
        });
      }
    }

    const filtered = adminFilter ? result.filter((row) => row.adminStatus === adminFilter) : result;
    return filtered
      .sort((a, b) => b.sortAt - a.sortAt)
      .slice(0, adminFilter ? ADMIN_LIST_LIMIT : ADMIN_LIST_LIMIT * 2)
      .map(({ sortAt: _sortAt, ...row }) => row);
  }

  private async employerRescheduledInterviewIds(interviewIds: string[]): Promise<Set<string>> {
    if (!interviewIds.length) return new Set();
    const rows = await this.prisma.auditLog.findMany({
      where: {
        action: INTERVIEW_RESCHEDULED_AUDIT_ACTION,
        resourceType: 'INTERVIEW',
        resourceId: { in: interviewIds },
      },
      select: { resourceId: true },
    });
    return new Set(rows.map((r) => r.resourceId).filter((id): id is string => Boolean(id)));
  }

  async skills(query?: string) {
    return this.prisma.skill.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { category: { contains: query, mode: 'insensitive' } },
              { aliases: { contains: query, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async addSkill(actorId: string, name: string, category: string, aliases?: string) {
    const row = await this.prisma.skill.upsert({
      where: { name: name.trim() },
      update: { category, aliases: aliases?.trim() || undefined, active: true },
      create: { name: name.trim(), category, aliases: aliases?.trim() || null },
    });
    await this.writeAudit({
      userId: actorId,
      action: 'UPSERT_SKILL',
      resourceType: 'SKILL',
      resourceId: row.id,
      newValue: row,
    });
    return row;
  }

  /**
   * Merges a duplicate skill into another: candidate skills and job skill lists move to the target,
   * the duplicate's name and aliases become target aliases, and the duplicate is deactivated.
   */
  async mergeSkill(actorId: string, sourceId: string, targetId: string) {
    if (sourceId === targetId) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Choose a different skill to merge into.' });
    }
    const [source, target] = await Promise.all([
      this.prisma.skill.findUnique({ where: { id: sourceId } }),
      this.prisma.skill.findUnique({ where: { id: targetId } }),
    ]);
    if (!source || !target) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Skill not found' });
    }

    const aliasSeen = new Set<string>([target.name.toLowerCase()]);
    const aliases: string[] = [];
    for (const alias of [...splitAliases(target.aliases), source.name, ...splitAliases(source.aliases)]) {
      const key = alias.toLowerCase();
      if (aliasSeen.has(key)) continue;
      aliasSeen.add(key);
      aliases.push(alias);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const sourceRows = await tx.candidateSkill.findMany({
        where: { name: { equals: source.name, mode: 'insensitive' } },
        select: { id: true, candidateId: true },
      });
      const alreadyHasTarget = new Set(
        (
          await tx.candidateSkill.findMany({
            where: {
              candidateId: { in: sourceRows.map((r) => r.candidateId) },
              name: { equals: target.name, mode: 'insensitive' },
            },
            select: { candidateId: true },
          })
        ).map((r) => r.candidateId),
      );
      const duplicateIds = sourceRows.filter((r) => alreadyHasTarget.has(r.candidateId)).map((r) => r.id);
      const renameIds = sourceRows.filter((r) => !alreadyHasTarget.has(r.candidateId)).map((r) => r.id);
      if (duplicateIds.length) await tx.candidateSkill.deleteMany({ where: { id: { in: duplicateIds } } });
      if (renameIds.length) await tx.candidateSkill.updateMany({ where: { id: { in: renameIds } }, data: { name: target.name } });

      let jobsUpdated = 0;
      const jobs = await tx.job.findMany({
        where: {
          OR: [
            { requiredSkills: { contains: source.name, mode: 'insensitive' } },
            { preferredSkills: { contains: source.name, mode: 'insensitive' } },
          ],
        },
        select: { id: true, requiredSkills: true, preferredSkills: true },
      });
      for (const job of jobs) {
        const required = replaceSkillName(parseNameList(job.requiredSkills), source.name, target.name);
        const preferred = replaceSkillName(parseNameList(job.preferredSkills), source.name, target.name);
        if (!required.changed && !preferred.changed) continue;
        await tx.job.update({
          where: { id: job.id },
          data: { requiredSkills: JSON.stringify(required.list), preferredSkills: JSON.stringify(preferred.list) },
        });
        jobsUpdated += 1;
      }
      const profiles = await tx.jobSkillProfile.findMany({
        where: {
          OR: [
            { requiredSkillsJson: { contains: source.name, mode: 'insensitive' } },
            { preferredSkillsJson: { contains: source.name, mode: 'insensitive' } },
          ],
        },
        select: { id: true, requiredSkillsJson: true, preferredSkillsJson: true },
      });
      for (const profile of profiles) {
        const required = replaceSkillName(parseNameList(profile.requiredSkillsJson), source.name, target.name);
        const preferred = replaceSkillName(parseNameList(profile.preferredSkillsJson), source.name, target.name);
        if (!required.changed && !preferred.changed) continue;
        await tx.jobSkillProfile.update({
          where: { id: profile.id },
          data: {
            requiredSkillsJson: JSON.stringify(required.list),
            preferredSkillsJson: JSON.stringify(preferred.list),
          },
        });
      }

      const updatedTarget = await tx.skill.update({
        where: { id: target.id },
        data: { aliases: aliases.join(', ') || null, active: true },
      });
      await tx.skill.update({ where: { id: source.id }, data: { active: false } });
      return {
        target: updatedTarget,
        candidatesUpdated: sourceRows.length,
        duplicatesRemoved: duplicateIds.length,
        jobsUpdated,
      };
    });

    await this.writeAudit({
      userId: actorId,
      action: 'MERGE_SKILL',
      resourceType: 'SKILL',
      resourceId: target.id,
      oldValue: { source, target },
      newValue: {
        target: result.target,
        candidatesUpdated: result.candidatesUpdated,
        duplicatesRemoved: result.duplicatesRemoved,
        jobsUpdated: result.jobsUpdated,
      },
    });
    return result;
  }

  async updateSkill(
    actorId: string,
    id: string,
    data: { name?: string; category?: string; aliases?: string; active?: boolean },
  ) {
    const existing = await this.prisma.skill.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Skill not found' });
    }
    const updated = await this.prisma.skill.update({
      where: { id },
      data: {
        name: data.name?.trim() || undefined,
        category: data.category?.trim() || undefined,
        aliases: data.aliases === undefined ? undefined : data.aliases,
        active: data.active,
      },
    });
    await this.writeAudit({
      userId: actorId,
      action: 'UPDATE_SKILL',
      resourceType: 'SKILL',
      resourceId: id,
      oldValue: existing,
      newValue: updated,
    });
    return updated;
  }

  /** Outbound WhatsApp delivery over the last 30 days, from statuses reported by Meta webhooks. */
  private async whatsappDeliveryMetrics(now = new Date()) {
    const windowDays = 30;
    const since = new Date(now.getTime() - windowDays * 24 * 60 * 60_000);
    const where = { direction: 'OUTBOUND' as const, createdAt: { gte: since } };
    try {
      const [grouped, recent] = await Promise.all([
        this.prisma.whatsAppMessage.groupBy({ by: ['status'], where, _count: { _all: true } }),
        this.prisma.whatsAppMessage.findMany({
          where: { ...where, status: 'FAILED' },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, templateName: true, errorJson: true, createdAt: true, interviewId: true },
        }),
      ]);
      const count = (status: string) => grouped.find((g) => String(g.status) === status)?._count._all ?? 0;
      const delivered = count('DELIVERED') + count('READ');
      const sentOk = count('SENT') + delivered;
      const failedCount = count('FAILED');
      return {
        windowDays,
        sent: sentOk,
        delivered,
        read: count('READ'),
        failed: failedCount,
        pending: count('QUEUED'),
        deliveryRate: conversionRate(delivered, sentOk + failedCount),
        recentFailures: recent.map((m) => ({
          id: m.id,
          template: m.templateName,
          reason: whatsappFailureReason(m.errorJson),
          interviewId: m.interviewId,
          createdAt: m.createdAt.toISOString(),
        })),
      };
    } catch {
      return null;
    }
  }

  async notifications() {
    const [inbox, whatsapp] = await Promise.all([
      this.prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { user: { select: { email: true, phone: true, userType: true } } },
      }),
      this.prisma.whatsAppMessage
        .findMany({
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            direction: true,
            status: true,
            toPhone: true,
            fromPhone: true,
            templateName: true,
            errorJson: true,
            createdAt: true,
            interviewId: true,
          },
        })
        .catch(
          (): Array<{
            id: string;
            direction: string;
            status: string;
            toPhone: string | null;
            fromPhone: string | null;
            templateName: string | null;
            errorJson: string | null;
            createdAt: Date;
            interviewId: string | null;
          }> => [],
        ),
    ]);

    const failed = whatsapp.filter((m) => m.status === 'FAILED').length;
    const sent = whatsapp.filter((m) => ['SENT', 'DELIVERED', 'READ', 'QUEUED'].includes(String(m.status))).length;
    const delivery = await this.whatsappDeliveryMetrics();

    return {
      summary: {
        inbox: inbox.length,
        whatsappRecent: whatsapp.length,
        failed,
        sent,
        pending: whatsapp.filter((m) => m.status === 'QUEUED').length,
      },
      delivery,
      inbox: inbox.map((n) => ({
        id: n.id,
        title: n.title,
        type: n.type,
        createdAt: n.createdAt.toISOString(),
        read: Boolean(n.readAt),
        user: n.user.email || n.user.phone,
      })),
      whatsapp: whatsapp.map((m) => ({
        id: m.id,
        status: m.status,
        direction: m.direction,
        to: m.toPhone,
        from: m.fromPhone,
        template: m.templateName,
        error: m.errorJson,
        interviewId: m.interviewId,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  async reports() {
    const [
      candidates,
      employers,
      openJobs,
      applications,
      interviews,
      resumes,
      hired,
      activeUsers,
      resumeAgg,
    ] = await Promise.all([
      this.prisma.candidate.count(),
      this.prisma.employer.count(),
      this.prisma.job.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.application.count(),
      this.prisma.employerInterview.count(),
      this.prisma.resume.count(),
      this.prisma.application.count({ where: { status: 'HIRED' } }),
      this.prisma.user.count({
        where: {
          status: 'ACTIVE',
          userType: { in: ['CANDIDATE', 'EMPLOYER_ADMIN', 'EMPLOYER_RECRUITER'] },
        },
      }),
      this.prisma.resume.aggregate({ _avg: { score: true }, _count: { _all: true } }),
    ]);
    const [applicants, shortlistedReached, interviewReached] = await Promise.all([
      this.prisma.application.findMany({ distinct: ['candidateId'], select: { candidateId: true } }).then((r) => r.length),
      this.prisma.application.count({
        where: { status: { in: [...SHORTLIST_REACHED_APPLICATION_STATUSES] } },
      }),
      this.prisma.application.count({ where: { status: { in: ['INTERVIEW', 'SELECTED', 'HIRED'] } } }),
    ]);
    const funnel = [
      { stage: 'Candidates', count: candidates, conversionRate: null, basis: null },
      {
        stage: 'Applications',
        count: applications,
        applicants,
        conversionRate: conversionRate(applicants, candidates),
        basis: 'candidates who applied at least once',
      },
      {
        stage: 'Shortlisted',
        count: shortlistedReached,
        conversionRate: conversionRate(shortlistedReached, applications),
        basis: 'of applications',
      },
      {
        stage: 'Interviews',
        count: interviewReached,
        conversionRate: conversionRate(interviewReached, shortlistedReached),
        basis: 'of shortlisted',
      },
      { stage: 'Hires', count: hired, conversionRate: conversionRate(hired, interviewReached), basis: 'of interviewed' },
    ];
    return {
      funnel,
      platform: {
        candidates,
        employers,
        activeUsers,
        openJobs,
        applications,
        interviews,
        hired,
        applied: await this.prisma.application.count({ where: { status: 'APPLIED' } }),
        shortlisted: await this.prisma.application.count({ where: { status: 'SHORTLISTED' } }),
        interview: await this.prisma.application.count({ where: { status: 'INTERVIEW' } }),
        selected: await this.prisma.application.count({ where: { status: 'SELECTED' } }),
        rejected: await this.prisma.application.count({ where: { status: 'REJECTED' } }),
      },
      candidate: {
        profilesCompleted: await this.prisma.candidate.count({ where: { profileCompletion: { gte: 100 } } }),
        resumesCreated: resumes,
        avgAtsScore: Number((resumeAgg._avg.score ?? 0).toFixed(1)),
      },
      employer: {
        jobsCreated: await this.prisma.job.count(),
        jobsPublished: openJobs,
        applicationsReceived: applications,
        interviewsConducted: interviews,
        hires: hired,
      },
      ai: await this.aiUsage().then((u) => ({
        requests: u.totalRequests,
        failed: u.failedRequests,
        tokens: u.totalTokens,
        estimatedCostInr: u.estimatedCostInr,
        byFeature: u.byFeature,
        byUser: u.byUser,
      })),
    };
  }

  /**
   * Reports → Candidate Excel: the Reports "candidate" metrics plus every candidate matching the
   * Admin Candidates list filters (all rows, not one page).
   */
  async candidateReportExport(actorId: string, query?: string, filters: CandidateListFilters = {}, now = new Date()) {
    const where = this.candidateListWhere(query, filters);
    const rows: CandidateReportRow[] = [];
    let cursor: string | undefined;
    for (;;) {
      const batch = await this.prisma.candidate.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          city: true,
          state: true,
          profileCompletion: true,
          createdAt: true,
          user: { select: { email: true, phone: true, status: true } },
          skills: { select: { name: true }, take: 5 },
          _count: { select: { applications: true, resumes: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: REPORT_EXPORT_BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      for (const row of batch) {
        rows.push({
          name: [row.firstName, row.lastName].filter(Boolean).join(' ') || '—',
          email: row.user.email,
          phone: row.user.phone,
          location: [row.city, row.state].filter(Boolean).join(', ') || '—',
          profileCompletion: row.profileCompletion ?? 0,
          primarySkills: row.skills.map((s) => s.name),
          applications: row._count.applications,
          resumeCount: row._count.resumes,
          accountStatus: row.user.status,
          createdAt: row.createdAt,
        });
      }
      this.assertExportSize(rows.length);
      if (batch.length < REPORT_EXPORT_BATCH) break;
      cursor = batch[batch.length - 1]!.id;
    }

    const block = (await this.reports()).candidate;
    const summary: SummaryRow[] = [
      { label: 'Report', value: 'CareerBridge Candidate Report' },
      { label: 'Generated at (IST)', value: this.istTimestamp(now) },
      { label: 'Filters', value: filterSummary({ search: query, ...filters }) },
      { label: 'Candidates exported', value: rows.length },
      { label: 'Profiles completed', value: block.profilesCompleted },
      { label: 'Resumes created', value: block.resumesCreated },
      { label: 'Average ATS score', value: block.avgAtsScore },
    ];
    return this.finishReportExport(actorId, 'candidate', now, rows.length, { query, ...filters }, [
      { name: 'Summary', columns: SUMMARY_COLUMNS, rows: summary },
      { name: 'Candidates', columns: CANDIDATE_REPORT_COLUMNS, rows },
    ]);
  }

  /** Employer filters shared by the Employer Report and its export: search (company or email) and account status. */
  private employerReportFilters(query?: string, status?: string) {
    const q = query?.trim() || undefined;
    const accountStatus = status?.trim().toUpperCase() || undefined;
    if (accountStatus && !ACCOUNT_STATUSES.includes(accountStatus)) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Unknown account status filter.' });
    }
    const and: Record<string, unknown>[] = [];
    if (q) {
      and.push({
        OR: [
          { companyName: { contains: q, mode: 'insensitive' } },
          { user: { email: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }
    if (accountStatus) and.push({ user: { status: accountStatus } });
    return { q, accountStatus, employerWhere: and.length ? { AND: and } : undefined };
  }

  /**
   * Employer Report: one row per posted job (Job is the employer's requirement), with applications,
   * shortlisted candidates and interviews aggregated per job. Jobs are read in cursor batches and each
   * batch adds three grouped queries, so there is no per-job query.
   */
  private async employerJobReportRows(employerWhere: Record<string, unknown> | undefined, now: Date) {
    const where = (employerWhere ? { AND: [POSTED_JOB_WHERE, { employer: employerWhere }] } : POSTED_JOB_WHERE) as never;
    const shortlistReached = new Set<string>(SHORTLIST_REACHED_APPLICATION_STATUSES);
    const rows: EmployerJobReportRow[] = [];
    let cursor: string | undefined;
    for (;;) {
      const batch = await this.prisma.job.findMany({
        where,
        select: {
          id: true,
          employerId: true,
          title: true,
          status: true,
          publishedAt: true,
          closedAt: true,
          createdAt: true,
          employer: { select: { companyName: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: REPORT_EXPORT_BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (!batch.length) break;
      const jobIds = batch.map((j) => j.id);
      const [appGroups, interviews] = await Promise.all([
        this.prisma.application.groupBy({
          by: ['jobId', 'status'],
          where: { jobId: { in: jobIds } },
          _count: { _all: true },
        }),
        this.prisma.employerInterview.findMany({
          where: { jobId: { in: jobIds } },
          select: {
            id: true,
            jobId: true,
            applicationId: true,
            status: true,
            scheduledAt: true,
            scheduledEnd: true,
            durationMin: true,
            candidateRescheduleRequestedAt: true,
            createdAt: true,
            application: { select: { status: true } },
          },
        }),
      ]);
      const rescheduled = await this.employerRescheduledInterviewIds(interviews.map((iv) => iv.id));
      const applied = new Map<string, number>();
      const shortlisted = new Map<string, number>();
      for (const g of appGroups) {
        applied.set(g.jobId, (applied.get(g.jobId) ?? 0) + g._count._all);
        if (shortlistReached.has(g.status)) shortlisted.set(g.jobId, (shortlisted.get(g.jobId) ?? 0) + g._count._all);
      }
      const interviewsByJob = new Map<string, ReportInterview[]>();
      for (const iv of interviews) {
        const list = interviewsByJob.get(iv.jobId) ?? [];
        list.push({ ...iv, applicationStatus: iv.application?.status ?? null });
        interviewsByJob.set(iv.jobId, list);
      }
      for (const job of batch) {
        const summary = summariseJobInterviews(interviewsByJob.get(job.id) ?? [], rescheduled, now);
        rows.push({
          jobId: job.id,
          employerId: job.employerId,
          employerName: job.employer.companyName,
          jobTitle: job.title,
          jobStatus: job.status,
          jobStatusLabel: JOB_STATUS_LABELS[job.status] ?? job.status,
          postedDate: istDate(jobPostedAt(job)),
          candidatesApplied: applied.get(job.id) ?? 0,
          candidatesShortlisted: shortlisted.get(job.id) ?? 0,
          interviewStatus: summary.label,
          interviewStatusCounts: summary.counts,
          closedDate: jobClosedDate(job),
          daysOpen: daysRequirementOpen(job, now),
        });
      }
      this.assertExportSize(rows.length);
      if (batch.length < REPORT_EXPORT_BATCH) break;
      cursor = batch[batch.length - 1]!.id;
    }
    return rows.sort(compareEmployerJobRows);
  }

  /** Reports → Employer Report table. Shows the newest EMPLOYER_REPORT_VIEW_LIMIT rows; the export has all. */
  async employerReport(query?: string, status?: string, now = new Date()) {
    const { employerWhere } = this.employerReportFilters(query, status);
    const rows = await this.employerJobReportRows(employerWhere, now);
    return {
      generatedAt: now.toISOString(),
      total: rows.length,
      limit: EMPLOYER_REPORT_VIEW_LIMIT,
      rows: rows.slice(0, EMPLOYER_REPORT_VIEW_LIMIT),
    };
  }

  /**
   * Reports → Employer Excel: the Reports "employer" metrics plus the per-job Employer Report for every
   * posted job of the employers matching the filters (search, account status).
   */
  async employerReportExport(actorId: string, query?: string, status?: string, now = new Date()) {
    const { q, accountStatus, employerWhere } = this.employerReportFilters(query, status);
    const rows = await this.employerJobReportRows(employerWhere, now);
    const employersWithoutJobs = await this.prisma.employer.count({
      where: { AND: [...(employerWhere ? [employerWhere] : []), { jobs: { none: POSTED_JOB_WHERE } }] } as never,
    });

    const block = (await this.reports()).employer;
    const summary: SummaryRow[] = [
      { label: 'Report', value: 'CareerBridge Employer Report' },
      { label: 'Generated at (IST)', value: this.istTimestamp(now) },
      { label: 'Filters', value: filterSummary({ search: q, status: accountStatus }) },
      { label: 'Jobs exported', value: rows.length },
      { label: 'Employers with jobs', value: new Set(rows.map((r) => r.employerId)).size },
      { label: 'Employers with no posted jobs', value: employersWithoutJobs },
      { label: 'Jobs created', value: block.jobsCreated },
      { label: 'Jobs published', value: block.jobsPublished },
      { label: 'Applications received', value: block.applicationsReceived },
      { label: 'Interviews conducted', value: block.interviewsConducted },
      { label: 'Hires', value: block.hires },
    ];
    return this.finishReportExport(actorId, 'employer', now, rows.length, { query: q, status: accountStatus }, [
      { name: 'Summary', columns: SUMMARY_COLUMNS, rows: summary },
      { name: 'Employer Jobs', columns: EMPLOYER_REPORT_COLUMNS, rows },
    ]);
  }

  private assertExportSize(count: number) {
    if (count > REPORT_EXPORT_MAX_ROWS) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: `This report has more than ${REPORT_EXPORT_MAX_ROWS} rows. Narrow the filters and try again.`,
      });
    }
  }

  private istTimestamp(now: Date) {
    return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 16).replace('T', ' ');
  }

  private async finishReportExport(
    actorId: string,
    kind: 'candidate' | 'employer',
    now: Date,
    rowCount: number,
    filters: Record<string, string | undefined>,
    sheets: Parameters<typeof buildWorkbook>[0],
  ): Promise<ReportFile> {
    const buffer = await buildWorkbook(sheets, now);
    await this.writeAudit({
      userId: actorId,
      action: kind === 'candidate' ? 'EXPORT_CANDIDATE_REPORT' : 'EXPORT_EMPLOYER_REPORT',
      resourceType: 'REPORT',
      newValue: { rows: rowCount, filters: filterSummary(filters) },
    });
    return { fileName: reportFileName(kind, now), buffer, rowCount };
  }

  /**
   * Employer revenue from recorded payments (see admin-revenue.ts for the definition). No payment
   * gateway is live yet, so figures only reflect payments stored with status PAID; the response
   * says so instead of estimating.
   */
  async revenue(now = new Date()) {
    const period = usagePeriod(now);
    const [year, month] = period.split('-').map(Number);
    const monthStart = new Date(Date.UTC(year, month - 1, 1) - IST_OFFSET_MS);
    const paid = { status: 'PAID' as const };
    const [byStatus, paidMonth, payingEmployers, newEmployers, creditsConsumed, jobPosting, hiringFees, freePaid] =
      await Promise.all([
        this.prisma.employerPayment
          .groupBy({ by: ['status'], _sum: { amountPaise: true }, _count: { _all: true } })
          .then((rows) => rows as unknown as PaymentStatusGroup[]),
        this.prisma.employerPayment.aggregate({
          where: { ...paid, paidAt: { gte: monthStart } },
          _sum: { amountPaise: true },
        }),
        this.prisma.employerPayment
          .findMany({
            where: { ...paid, amountPaise: { gt: 0 } },
            distinct: ['employerId'],
            select: { employerId: true },
          })
          .then((rows) => rows.length),
        this.prisma.employer.count({ where: { createdAt: { gte: monthStart } } }),
        this.prisma.employerCandidateView.count({ where: { period } }),
        this.prisma.employerPayment.aggregate({
          where: { ...paid, providerRef: { startsWith: JOB_POSTING_PROVIDER_REF_PREFIX } },
          _sum: { amountPaise: true },
        }),
        this.prisma.employerPayment.aggregate({
          where: { ...paid, hiringOutcomeId: { not: null } },
          _sum: { amountPaise: true },
        }),
        this.prisma.employerPayment.count({ where: { ...paid, amountPaise: 0 } }),
      ]);
    const paidTotals = bucketFor(byStatus, 'PAID');
    const paidPaise = byStatus.find((g) => g.status === 'PAID')?._sum.amountPaise ?? 0;
    const pending = bucketFor(byStatus, 'PENDING');
    return {
      period,
      currency: 'INR',
      totalRevenueInr: paidTotals.amountInr,
      revenueThisMonthInr: paiseToInr(paidMonth._sum.amountPaise),
      paidPayments: paidTotals.count,
      freePaidPayments: freePaid,
      pendingPayments: pending.count,
      payingEmployers,
      newEmployersThisMonth: newEmployers,
      creditsConsumedThisMonth: creditsConsumed,
      bySource: revenueBySource({
        totalPaise: paidPaise,
        jobPostingPaise: jobPosting._sum.amountPaise ?? 0,
        hiringFeePaise: hiringFees._sum.amountPaise ?? 0,
      }),
      excluded: {
        pending,
        failed: bucketFor(byStatus, 'FAILED'),
        refunded: bucketFor(byStatus, 'REFUNDED'),
      },
      definition: REVENUE_DEFINITION,
      paymentGatewayConfigured: false,
      note: 'Online payments are not live yet; revenue counts only payments recorded as PAID.',
    };
  }

  /** Reports → Candidate progress (distinct candidates per stage). */
  candidateProgress(now = new Date()) {
    return buildCandidateProgress(this.prisma as never, now);
  }

  /** Reports → Employer progress (distinct employers per stage). */
  employerProgress(now = new Date()) {
    return buildEmployerProgress(this.prisma as never, now);
  }

  async listAdmins() {
    const rows = await this.prisma.admin.findMany({
      include: {
        user: { select: { phone: true, userType: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      phone: row.user.phone,
      userType: row.user.userType,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      fullName: row.fullName,
      userId: row.userId,
      password: row.loginPassword ?? null,
    }));
  }

  async createAdmin(
    actorId: string,
    input: {
      email: string;
      password: string;
      fullName?: string;
      phone?: string;
      role?: 'SUPER_ADMIN' | 'PLATFORM_ADMIN' | 'PLATFORM_OPERATOR';
    },
  ) {
    const email = input.email.trim().toLowerCase();
    const role = input.role || 'PLATFORM_OPERATOR';
    if (!['SUPER_ADMIN', 'PLATFORM_ADMIN', 'PLATFORM_OPERATOR'].includes(role)) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Invalid admin role' });
    }
    const existing = await this.prisma.admin.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Admin email already exists' });
    }
    const plainPassword = input.password;
    const passwordHash = await hashPlatformPassword(plainPassword);
    let phone = input.phone?.trim() || '';
    if (!phone) {
      // Unique per (phone, userType) — avoid collisions when creating many admins quickly.
      phone = `+91${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
    }
    const phoneTaken = await this.prisma.user.findFirst({
      where: { phone, userType: role as UserType },
      select: { id: true },
    });
    if (phoneTaken) {
      phone = `+91${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 900 + 100)}`;
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          phone,
          passwordHash,
          externalAuthId: `admin_portal_${email}_${Date.now()}`,
          userType: role as UserType,
          status: 'ACTIVE',
        },
      });
      return tx.admin.create({
        data: {
          email,
          passwordHash,
          loginPassword: plainPassword,
          fullName: input.fullName?.trim() || null,
          status: 'ACTIVE',
          userId: user.id,
        },
        include: { user: { select: { userType: true, phone: true, status: true } } },
      });
    });

    await this.writeAudit({
      userId: actorId,
      action: 'CREATE_ADMIN',
      resourceType: 'ADMIN',
      resourceId: created.id,
      newValue: { email, role },
    });

    return {
      id: created.id,
      email: created.email,
      fullName: created.fullName,
      userType: created.user.userType,
      status: created.status,
      phone: created.user.phone,
      password: plainPassword,
    };
  }

  async setAdminStatus(actorId: string, adminId: string, status: UserStatus) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      include: { user: true },
    });
    if (!admin) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Admin not found' });
    }
    if (admin.user.userType === 'SUPER_ADMIN' && status !== 'ACTIVE') {
      throw new ForbiddenException({ code: ErrorCode.FORBIDDEN, message: 'Cannot suspend a Super Admin' });
    }
    const [updatedAdmin] = await this.prisma.$transaction([
      this.prisma.admin.update({ where: { id: adminId }, data: { status } }),
      this.prisma.user.update({ where: { id: admin.userId }, data: { status } }),
    ]);
    await this.writeAudit({
      userId: actorId,
      action: adminStatusAuditAction(status),
      resourceType: 'ADMIN',
      resourceId: adminId,
      oldValue: { status: admin.status },
      newValue: { status },
    });
    return toAdminStatusResult(updatedAdmin);
  }

  async setAdminRole(
    actorId: string,
    adminId: string,
    role: 'SUPER_ADMIN' | 'PLATFORM_ADMIN' | 'PLATFORM_OPERATOR',
  ) {
    if (!['SUPER_ADMIN', 'PLATFORM_ADMIN', 'PLATFORM_OPERATOR'].includes(role)) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Invalid admin role' });
    }
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      include: { user: true },
    });
    if (!admin) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Admin not found' });
    }
    if (admin.user.userType === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Cannot demote a Super Admin from this action',
      });
    }
    const updated = await this.prisma.user.update({
      where: { id: admin.userId },
      data: { userType: role as UserType },
    });
    await this.writeAudit({
      userId: actorId,
      action: 'CHANGE_ADMIN_ROLE',
      resourceType: 'ADMIN',
      resourceId: adminId,
      oldValue: { role: admin.user.userType },
      newValue: { role },
    });
    return { id: admin.id, email: admin.email, userType: updated.userType, status: admin.status };
  }

  async setAdminPassword(actorId: string, adminId: string, password: string) {
    const plain = password.trim();
    if (plain.length < 8) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Password must be at least 8 characters',
      });
    }
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      include: { user: true },
    });
    if (!admin) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Admin not found' });
    }
    const passwordHash = await hashPlatformPassword(plain);
    await this.prisma.$transaction([
      this.prisma.admin.update({
        where: { id: adminId },
        data: { passwordHash, loginPassword: plain },
      }),
      this.prisma.user.update({
        where: { id: admin.userId },
        data: { passwordHash },
      }),
    ]);
    await this.writeAudit({
      userId: actorId,
      action: 'SET_ADMIN_PASSWORD',
      resourceType: 'ADMIN',
      resourceId: adminId,
      newValue: { email: admin.email },
    });
    return {
      id: admin.id,
      email: admin.email,
      userType: admin.user.userType,
      status: admin.status,
      password: plain,
    };
  }

  async changeOwnPassword(
    userId: string,
    input: { currentPassword: string; newPassword: string; confirmPassword: string },
  ) {
    const { currentPassword, newPassword, confirmPassword } = input;
    if (newPassword !== confirmPassword) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'New password and confirmation do not match.',
      });
    }
    const policyError = registrationPasswordError(newPassword);
    if (policyError) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: policyError });
    }

    const admin = await this.prisma.admin.findUnique({
      where: { userId },
      include: { user: { select: { userType: true, status: true } } },
    });
    if (
      !admin ||
      admin.status !== 'ACTIVE' ||
      admin.user.status !== 'ACTIVE' ||
      !STAFF_ROLES.has(admin.user.userType)
    ) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Only active admin portal accounts can change their password here.',
      });
    }

    // 400 rather than 401: a 401 makes the web client drop the signed-in session.
    if (!(await verifyPassword(currentPassword, admin.passwordHash))) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Current password is incorrect.',
      });
    }
    if (await verifyPassword(newPassword, admin.passwordHash)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'New password must be different from the current password.',
      });
    }

    const passwordHash = await hashPlatformPassword(newPassword);
    await this.prisma.$transaction([
      this.prisma.admin.update({
        where: { id: admin.id },
        data: { passwordHash, loginPassword: null },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
    ]);
    await this.writeAudit({
      userId,
      action: 'CHANGE_OWN_PASSWORD',
      resourceType: 'ADMIN',
      resourceId: admin.id,
      newValue: { email: admin.email },
    });
    return { changed: true };
  }

  async getSettings() {
    const rows = await this.prisma.platformSetting.findMany();
    const map = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      if (ALLOWED_SETTING_KEYS.has(row.key)) map[row.key] = row.value;
    }
    return map;
  }

  async updateSettings(actorId: string, patch: Record<string, string>) {
    const entries = Object.entries(patch || {}).filter(([key]) => ALLOWED_SETTING_KEYS.has(key));
    for (const [key, value] of entries) {
      await this.prisma.platformSetting.upsert({
        where: { key },
        update: { value: String(value), updatedBy: actorId },
        create: { key, value: String(value), updatedBy: actorId },
      });
    }
    await this.writeAudit({
      userId: actorId,
      action: 'UPDATE_SETTINGS',
      resourceType: 'SETTINGS',
      newValue: Object.fromEntries(entries),
    });
    return this.getSettings();
  }

  async audit(query?: string, limited = false) {
    const q = query?.trim();
    const rows = await this.prisma.auditLog.findMany({
      where: q
        ? {
            OR: [
              { action: { contains: q, mode: 'insensitive' } },
              { resourceType: { contains: q, mode: 'insensitive' } },
              { resourceId: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: limited ? 25 : 100,
    });
    const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, userType: true },
        })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows.map((row) => ({
      id: row.id,
      time: row.createdAt.toISOString(),
      userId: row.userId,
      actor: row.userId ? byId.get(row.userId)?.email || row.userId : 'system',
      actorRole: row.userId ? byId.get(row.userId)?.userType || null : null,
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      requestId: row.requestId,
      ...(limited ? {} : { oldValue: row.oldValue, newValue: row.newValue }),
    }));
  }
}
