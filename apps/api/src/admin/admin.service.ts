import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ErrorCode } from '@careerbridge/shared';
import { UserStatus, UserType } from '../prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { hashPlatformPassword } from '../auth/password.util';

const DEFAULT_SETTINGS: Record<string, string> = {
  // Workflow: Settings → Platform / Resume / ATS / AI / Notifications / System
  'platform.maintenanceMode': 'false',
  'resume.atsEnabled': 'true',
  'resume.maxVersions': '10',
  'ats.scoreThreshold': '60',
  'ats.scoreVersion': 'v1',
  'ats.matchingEnabled': 'true',
  'ai.enabled': 'true',
  'ai.dailyRequestLimit': '50000',
  'ai.tokenLimit': '2000000',
  'notifications.enabled': 'true',
  'notifications.remindersEnabled': 'true',
  'notifications.templatesEnabled': 'true',
  'system.auditRetentionDays': '365',
};

const ALLOWED_SETTING_KEYS = new Set(Object.keys(DEFAULT_SETTINGS));

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

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
      },
      aiUsage,
    };
  }

  async candidates(query?: string) {
    const q = query?.trim();
    const rows = await this.prisma.candidate.findMany({
      where: q
        ? {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { city: { contains: q, mode: 'insensitive' } },
              { user: { email: { contains: q, mode: 'insensitive' } } },
              { user: { phone: { contains: q } } },
            ],
          }
        : undefined,
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
      },
    });
    if (!row) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Interview not found' });
    }
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
    return {
      id: row.id,
      status: row.status,
      mode: row.mode,
      scheduledAt: row.scheduledAt.toISOString(),
      whatsappStatus: row.whatsappStatus,
      candidateName: [row.candidate.firstName, row.candidate.lastName].filter(Boolean).join(' ') || '—',
      jobTitle: row.job.title,
      companyName: row.employer.companyName,
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
      activity: await this.resourceActivity('INTERVIEW', id),
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
    return updated;
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
    return {
      id: row.id,
      companyName: row.companyName,
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

  async setJobStatus(actorId: string, id: string, status: 'PUBLISHED' | 'PAUSED' | 'CLOSED' | 'DRAFT') {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Job not found' });
    }
    const updated = await this.prisma.job.update({
      where: { id },
      data: {
        status,
        publishedAt: status === 'PUBLISHED' ? job.publishedAt || new Date() : job.publishedAt,
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

  async interviews(query?: string, status?: string) {
    const q = query?.trim();
    const rows = await this.prisma.employerInterview.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
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
      },
      orderBy: { scheduledAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      mode: row.mode,
      scheduledAt: row.scheduledAt.toISOString(),
      whatsappStatus: row.whatsappStatus,
      jobTitle: row.job.title,
      companyName: row.employer.companyName,
      candidateName: [row.candidate.firstName, row.candidate.lastName].filter(Boolean).join(' ') || '—',
    }));
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

    return {
      summary: {
        inbox: inbox.length,
        whatsappRecent: whatsapp.length,
        failed,
        sent,
        pending: whatsapp.filter((m) => m.status === 'QUEUED').length,
      },
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
    return {
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
      action: status === 'SUSPENDED' ? 'SUSPEND_ADMIN' : 'ACTIVATE_ADMIN',
      resourceType: 'ADMIN',
      resourceId: adminId,
      oldValue: { status: admin.status },
      newValue: { status },
    });
    return updatedAdmin;
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
