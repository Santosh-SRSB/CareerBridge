import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode, type ApplicationStatus } from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MatchingService } from '../matching/matching.service';
import { NotificationsService } from '../notifications/notifications.service';

const FLOW: ApplicationStatus[] = ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'SELECTED'];

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: MatchingService,
    private readonly notifications: NotificationsService,
  ) {}

  async apply(userId: string, jobId: string, resumeId?: string) {
    const candidate = await this.requireCandidate(userId);
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { employer: true },
    });
    if (!job || job.status !== 'PUBLISHED') {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'This job is not open for applications' });
    }
    const existing = await this.prisma.application.findUnique({
      where: { candidateId_jobId: { candidateId: candidate.id, jobId } },
    });
    if (existing && existing.status !== 'WITHDRAWN') {
      throw new ConflictException({
        code: ErrorCode.DUPLICATE_RESOURCE,
        message: 'You have already applied for this job.',
      });
    }
    const resume = resumeId
      ? await this.prisma.resume.findFirst({ where: { id: resumeId, candidateId: candidate.id } })
      : await this.prisma.resume.findFirst({ where: { candidateId: candidate.id }, orderBy: { updatedAt: 'desc' } });
    const application = existing
      ? await this.prisma.application.update({
          where: { id: existing.id },
          data: { status: 'APPLIED', resumeId: resume?.id, resumeVersion: resume?.version },
        })
      : await this.prisma.application.create({
          data: {
            candidateId: candidate.id,
            jobId,
            resumeId: resume?.id,
            resumeVersion: resume?.version,
          },
        });
    // Keep employer match ranks in sync when a candidate applies.
    await this.matching.recomputeMatchesForJob(jobId).catch(() => undefined);

    const candidateName =
      [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim() || 'A candidate';

    await this.notifications
      .create({
        userId,
        title: 'Application submitted',
        body: `Your application for ${job.title} at ${job.employer.companyName} was sent.`,
        type: 'APPLICATION',
        link: `/applications/${application.id}`,
      })
      .catch(() => undefined);

    if (job.employer.userId) {
      await this.notifications
        .create({
          userId: job.employer.userId,
          title: 'New application',
          body: `${candidateName} applied for ${job.title}.`,
          type: 'APPLICATION',
          link: `/employer/jobs/${job.id}`,
        })
        .catch(() => undefined);
    }

    return this.get(userId, application.id);
  }

  async list(userId: string) {
    const candidate = await this.requireCandidate(userId);
    const rows = await this.prisma.application.findMany({
      where: { candidateId: candidate.id },
      include: { job: { include: { employer: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async get(userId: string, id: string) {
    const candidate = await this.requireCandidate(userId);
    const row = await this.prisma.application.findFirst({
      where: { id, candidateId: candidate.id },
      include: { job: { include: { employer: true } } },
    });
    if (!row) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Application was not found' });
    }
    return this.toRecord(row);
  }

  async withdraw(userId: string, id: string) {
    await this.get(userId, id);
    await this.prisma.application.update({ where: { id }, data: { status: 'WITHDRAWN' } });
    return this.get(userId, id);
  }

  async listScheduledInterviews(userId: string) {
    const candidate = await this.requireCandidate(userId);
    const rows = await this.prisma.employerInterview.findMany({
      where: {
        candidateId: candidate.id,
        status: { not: 'CANCELLED' },
      },
      include: {
        application: {
          include: {
            job: { include: { employer: true } },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 50,
    });
    return rows.map((row) => this.toScheduledInterview(row));
  }

  async getScheduledInterview(userId: string, id: string) {
    const candidate = await this.requireCandidate(userId);
    const row = await this.prisma.employerInterview.findFirst({
      where: { id, candidateId: candidate.id },
      include: {
        application: {
          include: {
            job: { include: { employer: true } },
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Interview was not found',
      });
    }
    return this.toScheduledInterview(row);
  }

  async confirmScheduledInterview(userId: string, id: string) {
    await this.getScheduledInterview(userId, id);
    const updated = await this.prisma.employerInterview.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        whatsappStatus: 'CONFIRMED_VIA_PORTAL',
      },
      include: {
        application: {
          include: {
            job: { include: { employer: true } },
          },
        },
      },
    });
    return this.toScheduledInterview(updated);
  }

  async requestRescheduleInterview(userId: string, id: string) {
    await this.getScheduledInterview(userId, id);
    const updated = await this.prisma.employerInterview.update({
      where: { id },
      data: {
        status: 'RESCHEDULE_REQUESTED',
        confirmedAt: null,
        whatsappStatus: 'RESCHEDULE_REQUESTED_VIA_PORTAL',
      },
      include: {
        application: {
          include: {
            job: { include: { employer: true } },
          },
        },
      },
    });
    return this.toScheduledInterview(updated);
  }

  private toScheduledInterview(row: {
    id: string;
    applicationId: string;
    scheduledAt: Date;
    durationMin: number;
    mode: string;
    location: string | null;
    status: string;
    application: {
      job: {
        title: string;
        employer: { companyName: string };
      };
    };
  }) {
    const scheduledAt = row.scheduledAt;
    const dateLabel = scheduledAt.toISOString().slice(0, 10);
    const timeLabel = new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    }).format(scheduledAt);
    const status =
      row.status === 'CONFIRMED'
        ? 'CONFIRMED'
        : row.status === 'RESCHEDULE_REQUESTED'
          ? 'RESCHEDULE_REQUESTED'
          : 'PENDING_CONFIRMATION';
    const mode = row.mode?.toUpperCase().includes('VIDEO') ? 'VIDEO' : 'IN_PERSON';
    return {
      id: row.id,
      jobTitle: row.application.job.title,
      companyName: row.application.job.employer.companyName,
      scheduledDate: dateLabel,
      scheduledTime: timeLabel,
      status,
      location: row.location || (mode === 'VIDEO' ? 'Video interview' : 'To be confirmed'),
      mode,
      applicationId: row.applicationId,
      durationMin: row.durationMin,
      scheduledAt: scheduledAt.toISOString(),
    };
  }

  private async requireCandidate(userId: string) {
    const candidate = await this.prisma.candidate.findUnique({ where: { userId } });
    if (!candidate) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Candidate profile was not found' });
    }
    return candidate;
  }

  private toRecord(row: {
    id: string;
    status: ApplicationStatus;
    createdAt: Date;
    resumeId: string | null;
    resumeVersion: number | null;
    job: {
      id: string;
      title: string;
      city: string;
      salaryMin: number | null;
      salaryMax: number | null;
      jobType: string;
      category: string;
      requiredSkills: string;
      preferredSkills: string;
      employer: { companyName: string };
    };
  }) {
    const reached = FLOW.indexOf(row.status === 'HIRED' ? 'SELECTED' : row.status);
    const timeline = FLOW.map((item, index) => ({
      status: item,
      at: row.createdAt.toISOString(),
      done: row.status === 'REJECTED' || row.status === 'WITHDRAWN' ? item === 'APPLIED' : reached >= index,
    }));
    return {
      id: row.id,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      resumeId: row.resumeId,
      resumeVersion: row.resumeVersion,
      job: {
        id: row.job.id,
        title: row.job.title,
        companyName: row.job.employer.companyName,
        city: row.job.city,
        salaryMin: row.job.salaryMin,
        salaryMax: row.job.salaryMax,
        jobType: row.job.jobType,
        category: row.job.category,
        requiredSkills: parseList(row.job.requiredSkills),
        preferredSkills: parseList(row.job.preferredSkills),
      },
      timeline,
    };
  }
}

function parseList(raw: string) {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}
