import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApplicationStatus, JobStatus } from '@prisma/client';
import { ErrorCode as SharedError } from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { IntelligenceService } from '../intelligence/intelligence.service';

const ACTION_STATUS: Record<string, ApplicationStatus> = {
  REVIEW: 'UNDER_REVIEW',
  SHORTLIST: 'SHORTLISTED',
  INTERVIEW: 'INTERVIEW',
  SELECT: 'SELECTED',
  REJECT: 'REJECTED',
  HIRE: 'HIRED',
};

@Injectable()
export class EmployersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intelligence: IntelligenceService,
  ) {}

  async me(userId: string) {
    return this.toProfile(await this.requireEmployer(userId));
  }

  async updateMe(userId: string, dto: { companyName?: string; industry?: string; city?: string; contactName?: string }) {
    const employer = await this.requireEmployer(userId);
    const updated = await this.prisma.employer.update({
      where: { id: employer.id },
      data: {
        ...(dto.companyName ? { companyName: dto.companyName.trim() } : {}),
        ...(dto.industry !== undefined ? { industry: dto.industry } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.contactName !== undefined ? { contactName: dto.contactName } : {}),
      },
    });
    return this.toProfile(updated);
  }

  async dashboard(userId: string) {
    const employer = await this.requireEmployer(userId);
    const jobs = await this.prisma.job.findMany({ where: { employerId: employer.id }, select: { id: true, status: true } });
    const jobIds = jobs.map((item) => item.id);
    const [applications, shortlisted, interviews, recent] = await Promise.all([
      this.prisma.application.count({ where: { jobId: { in: jobIds } } }),
      this.prisma.application.count({ where: { jobId: { in: jobIds }, status: 'SHORTLISTED' } }),
      this.prisma.application.count({ where: { jobId: { in: jobIds }, status: 'INTERVIEW' } }),
      this.prisma.application.findMany({
        where: { jobId: { in: jobIds } },
        include: { candidate: true, job: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);
    return {
      openJobs: jobs.filter((item) => item.status === 'PUBLISHED').length,
      applications,
      shortlisted,
      interviews,
      recent: recent.map((item) => ({
        candidateName: [item.candidate.firstName, item.candidate.lastName].filter(Boolean).join(' ') || 'Candidate',
        jobTitle: item.job.title,
        status: item.status,
        applicationId: item.id,
      })),
    };
  }

  async jobs(userId: string) {
    const employer = await this.requireEmployer(userId);
    return this.prisma.job.findMany({ where: { employerId: employer.id }, orderBy: { updatedAt: 'desc' } });
  }

  async createJob(userId: string, dto: CreateJobInput) {
    assertSalaryRange(dto.salaryMin, dto.salaryMax);
    const employer = await this.requireEmployer(userId);
    return this.prisma.job.create({
      data: {
        employerId: employer.id,
        title: dto.title.trim(),
        description: dto.description.trim(),
        city: dto.city.trim(),
        salaryMin: dto.salaryMin,
        salaryMax: dto.salaryMax,
        jobType: dto.jobType || 'FULL_TIME',
        category: dto.category,
        experience: dto.experience || 'NONE',
        requiredSkills: JSON.stringify(dto.requiredSkills || []),
        preferredSkills: JSON.stringify(dto.preferredSkills || []),
        benefits: dto.benefits,
        status: 'DRAFT',
      },
    });
  }

  async job(userId: string, id: string) {
    return this.requireJob(userId, id);
  }

  async updateJob(userId: string, id: string, dto: CreateJobInput) {
    assertSalaryRange(dto.salaryMin, dto.salaryMax);
    await this.requireJob(userId, id);
    return this.prisma.job.update({
      where: { id },
      data: {
        title: dto.title.trim(),
        description: dto.description.trim(),
        city: dto.city.trim(),
        salaryMin: dto.salaryMin,
        salaryMax: dto.salaryMax,
        jobType: dto.jobType || 'FULL_TIME',
        category: dto.category,
        experience: dto.experience,
        requiredSkills: JSON.stringify(dto.requiredSkills || []),
        preferredSkills: JSON.stringify(dto.preferredSkills || []),
        benefits: dto.benefits,
      },
    });
  }

  async setStatus(userId: string, id: string, status: JobStatus) {
    await this.requireJob(userId, id);
    return this.prisma.job.update({
      where: { id },
      data: { status, publishedAt: status === 'PUBLISHED' ? new Date() : undefined },
    });
  }

  async applications(userId: string, jobId: string) {
    const job = await this.requireJob(userId, jobId);
    const rows = await this.prisma.application.findMany({
      where: { jobId: job.id },
      include: { candidate: { include: { skills: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      candidate: {
        id: row.candidate.id,
        firstName: row.candidate.firstName,
        lastName: row.candidate.lastName,
        city: row.candidate.city,
        skills: row.candidate.skills.map((item) => item.name),
        highestEducation: row.candidate.highestEducation,
      },
      job: { id: job.id, title: job.title },
      match: this.intelligence.match(
        {
          city: row.candidate.city,
          careerInterests: parseList(row.candidate.careerInterests),
          skills: row.candidate.skills.map((item) => item.name),
          hasExperience: row.candidate.hasExperience,
        },
        {
          city: job.city,
          category: job.category,
          requiredSkills: parseList(job.requiredSkills),
          experience: job.experience,
        },
      ),
    }));
  }

  async candidateView(userId: string, candidateId: string) {
    const employer = await this.requireEmployer(userId);
    const applied = await this.prisma.application.findFirst({
      where: { candidateId, job: { employerId: employer.id } },
      include: { candidate: { include: { skills: true, education: true } } },
    });
    if (!applied) {
      throw new ForbiddenException({
        code: SharedError.FORBIDDEN,
        message: 'You can view this candidate after they apply.',
      });
    }
    const candidate = applied.candidate;
    return {
      id: candidate.id,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      city: candidate.city,
      highestEducation: candidate.highestEducation,
      skills: candidate.skills.map((item) => item.name),
      education: candidate.education.map((item) => ({
        qualification: item.qualification,
        institution: item.institution,
      })),
      status: applied.status,
    };
  }

  async changeStatus(userId: string, applicationId: string, action: string) {
    const employer = await this.requireEmployer(userId);
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, job: { employerId: employer.id } },
    });
    if (!application) {
      throw new NotFoundException({ code: SharedError.RESOURCE_NOT_FOUND, message: 'Application was not found' });
    }
    const status = ACTION_STATUS[action];
    if (!status) {
      throw new ForbiddenException({ code: SharedError.BUSINESS_RULE_VIOLATION, message: 'This action is not allowed.' });
    }
    return this.prisma.application.update({ where: { id: application.id }, data: { status } });
  }

  private async requireEmployer(userId: string) {
    const employer = await this.prisma.employer.findUnique({ where: { userId } });
    if (!employer) {
      throw new NotFoundException({ code: SharedError.RESOURCE_NOT_FOUND, message: 'Employer profile was not found' });
    }
    return employer;
  }

  private async requireJob(userId: string, id: string) {
    const employer = await this.requireEmployer(userId);
    const job = await this.prisma.job.findFirst({ where: { id, employerId: employer.id } });
    if (!job) {
      throw new NotFoundException({ code: SharedError.RESOURCE_NOT_FOUND, message: 'Job was not found' });
    }
    return job;
  }

  private toProfile(employer: { id: string; companyName: string; industry: string | null; city: string | null; contactName: string | null; verified: boolean }) {
    return {
      id: employer.id,
      companyName: employer.companyName,
      industry: employer.industry,
      city: employer.city,
      contactName: employer.contactName,
      verified: employer.verified,
    };
  }
}

function assertSalaryRange(salaryMin?: number, salaryMax?: number) {
  if (salaryMin != null && salaryMax != null && salaryMin > salaryMax) {
    throw new BadRequestException({
      code: SharedError.VALIDATION_ERROR,
      message: 'Maximum salary cannot be less than starting salary.',
    });
  }
}

type CreateJobInput = {
  title: string;
  description: string;
  city: string;
  salaryMin?: number;
  salaryMax?: number;
  jobType?: string;
  category: string;
  experience?: string;
  requiredSkills?: string[];
  preferredSkills?: string[];
  benefits?: string;
};

function parseList(raw: string) {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}
