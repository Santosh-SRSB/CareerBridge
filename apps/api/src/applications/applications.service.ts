import { Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode, type ApplicationStatus } from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';

const FLOW: ApplicationStatus[] = ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'SELECTED'];

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

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
