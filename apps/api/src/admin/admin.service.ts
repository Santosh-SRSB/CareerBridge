import { Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const [candidates, activeCandidates, employers, openJobs, applications, interviews] = await Promise.all([
      this.prisma.candidate.count(),
      this.prisma.candidate.count({ where: { onboardingCompleted: true } }),
      this.prisma.employer.count(),
      this.prisma.job.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.application.count(),
      this.prisma.interview.count(),
    ]);
    return { candidates, activeCandidates, employers, openJobs, applications, interviews };
  }

  async candidates() {
    return this.prisma.candidate.findMany({
      include: { user: { select: { phone: true, email: true, status: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async employers() {
    return this.prisma.employer.findMany({
      include: { user: { select: { phone: true, email: true, status: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async verifyEmployer(id: string) {
    const employer = await this.prisma.employer.findUnique({ where: { id } });
    if (!employer) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Employer was not found' });
    }
    return this.prisma.employer.update({ where: { id }, data: { verified: true } });
  }

  async jobs() {
    return this.prisma.job.findMany({
      include: { employer: { select: { companyName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async applications() {
    return this.prisma.application.findMany({
      include: {
        job: { select: { title: true } },
        candidate: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async skills(query?: string) {
    return this.prisma.skill.findMany({
      where: query ? { name: { contains: query, mode: 'insensitive' } } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async addSkill(name: string, category: string) {
    return this.prisma.skill.upsert({
      where: { name: name.trim() },
      update: { category },
      create: { name: name.trim(), category },
    });
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
    }));
  }
}
