import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { IntelligenceService } from '../intelligence/intelligence.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intelligence: IntelligenceService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(
    query: { q?: string; location?: string; type?: string; category?: string; page?: number; pageSize?: number },
    userId?: string,
  ) {
    const page = query.page || 1;
    const pageSize = Math.min(query.pageSize || 20, 50);
    const where = {
      status: 'PUBLISHED' as const,
      ...(query.location ? { city: { contains: query.location, mode: 'insensitive' as const } } : {}),
      ...(query.type ? { jobType: query.type } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' as const } },
              { description: { contains: query.q, mode: 'insensitive' as const } },
              { category: { contains: query.q, mode: 'insensitive' as const } },
              { requiredSkills: { contains: query.q, mode: 'insensitive' as const } },
              { preferredSkills: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.job.count({ where }),
      this.prisma.job.findMany({
        where,
        include: { employer: true },
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const candidate = userId ? await this.loadCandidate(userId) : null;
    const savedJobIds = candidate
      ? new Set(
          (
            await this.prisma.savedJob.findMany({
              where: { candidateId: candidate.id, jobId: { in: rows.map((row) => row.id) } },
              select: { jobId: true },
            })
          ).map((row) => row.jobId),
        )
      : new Set<string>();
    return {
      items: rows.map((job) => this.toCard(job, candidate, savedJobIds.has(job.id))),
      page,
      pageSize,
      total,
    };
  }

  async recommended(userId: string) {
    // Score against a wider published pool so recommendations reflect live employer posts.
    const result = await this.list({ page: 1, pageSize: 50 }, userId);
    return {
      ...result,
      items: [...result.items]
        .sort((a, b) => (b.match?.score || 0) - (a.match?.score || 0))
        .slice(0, 8),
      pageSize: 8,
      total: Math.min(result.total, 8),
    };
  }

  async detail(id: string, userId?: string) {
    const job = await this.prisma.job.findUnique({ where: { id }, include: { employer: true } });
    if (!job || job.status === 'DRAFT') {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Job was not found' });
    }
    const candidate = userId ? await this.loadCandidate(userId) : null;
    const applied = candidate
      ? Boolean(
          await this.prisma.application.findUnique({
            where: { candidateId_jobId: { candidateId: candidate.id, jobId: id } },
          }),
        )
      : false;
    const saved = candidate
      ? Boolean(
          await this.prisma.savedJob.findUnique({
            where: { candidateId_jobId: { candidateId: candidate.id, jobId: id } },
          }),
        )
      : false;
    return {
      ...this.toCard(job, candidate, saved),
      description: job.description,
      experience: job.experience,
      benefits: job.benefits,
      status: job.status,
      applied,
    };
  }

  async matchFor(userId: string, jobId: string) {
    const detail = await this.detail(jobId, userId);
    return detail.match;
  }

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

    const candidateName =
      [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim() || 'A candidate';

    await this.notifications
      .create({
        userId,
        title: 'Application submitted',
        body: `Your application for ${job.title} was sent successfully.`,
        type: 'APPLICATION',
        link: `/applications/${application.id}`,
      })
      .catch(() => undefined);

    if (job.employer?.userId) {
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

    return this.applicationView(application.id);
  }

  async listSaved(userId: string) {
    const candidate = await this.requireCandidate(userId);
    const rows = await this.prisma.savedJob.findMany({
      where: { candidateId: candidate.id },
      include: { job: { include: { employer: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return {
      items: rows
        .filter((row) => row.job.status === 'PUBLISHED')
        .map((row) => this.toCard(row.job, candidate, true)),
    };
  }

  async saveJob(userId: string, jobId: string) {
    const candidate = await this.requireCandidate(userId);
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.status !== 'PUBLISHED') {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Job was not found' });
    }
    await this.prisma.savedJob.upsert({
      where: { candidateId_jobId: { candidateId: candidate.id, jobId } },
      create: { candidateId: candidate.id, jobId },
      update: {},
    });
    return { saved: true, jobId };
  }

  async unsaveJob(userId: string, jobId: string) {
    const candidate = await this.requireCandidate(userId);
    await this.prisma.savedJob.deleteMany({
      where: { candidateId: candidate.id, jobId },
    });
    return { saved: false, jobId };
  }

  async applicationView(id: string) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: { job: { include: { employer: true } } },
    });
    if (!application) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Application was not found' });
    }
    return {
      id: application.id,
      status: application.status,
      createdAt: application.createdAt.toISOString(),
      resumeId: application.resumeId,
      resumeVersion: application.resumeVersion,
      job: this.toCard(application.job),
    };
  }

  private async loadCandidate(userId: string) {
    return this.prisma.candidate.findUnique({
      where: { userId },
      include: { skills: true },
    });
  }

  private async requireCandidate(userId: string) {
    const candidate = await this.loadCandidate(userId);
    if (!candidate) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Candidate profile was not found' });
    }
    return candidate;
  }

  private toCard(
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
      experience: string | null;
      employer: { companyName: string };
    },
    candidate?: {
      city: string | null;
      careerInterests: string;
      hasExperience: string | null;
      skills: Array<{ name: string }>;
    } | null,
    saved = false,
  ) {
    const requiredSkills = parseList(job.requiredSkills);
    const preferredSkills = parseList(job.preferredSkills);
    const match = candidate
      ? this.intelligence.match(
          {
            city: candidate.city,
            careerInterests: parseList(candidate.careerInterests),
            skills: candidate.skills.map((item) => item.name),
            hasExperience: candidate.hasExperience,
          },
          {
            city: job.city,
            category: job.category,
            requiredSkills,
            experience: job.experience,
          },
        )
      : undefined;
    return {
      id: job.id,
      title: job.title,
      companyName: job.employer.companyName,
      city: job.city,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      jobType: job.jobType,
      category: job.category,
      requiredSkills,
      preferredSkills,
      experience: job.experience,
      match,
      saved,
    };
  }
}

export function parseList(raw: string) {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}
