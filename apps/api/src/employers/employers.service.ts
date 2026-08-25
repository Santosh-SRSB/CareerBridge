import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationStatus, JobStatus } from '../prisma/client';
import {
  ErrorCode as SharedError,
  cinError,
  companyWebsiteError,
  designationError,
  emailError,
  gstNumberError,
  normalizeHttpUrl,
  panNumberError,
} from '@careerbridge/shared';
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

  async saveKyc(
    userId: string,
    dto: { gstNumber: string; cin: string; website: string; panNumber: string },
  ) {
    const employer = await this.requireEmployer(userId);
    const gst = dto.gstNumber.trim().toUpperCase();
    const cin = dto.cin.trim().toUpperCase();
    const pan = dto.panNumber.trim().toUpperCase();
    const websiteRaw = dto.website.trim();
    const website = normalizeHttpUrl(
      websiteRaw.startsWith('http') ? websiteRaw : `https://${websiteRaw}`,
    );

    const error =
      gstNumberError(gst) ||
      cinError(cin) ||
      companyWebsiteError(websiteRaw) ||
      panNumberError(pan);
    if (error || !website) {
      throw new HttpException(
        { code: SharedError.VALIDATION_ERROR, message: error || 'Enter a valid company website.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const nextStatus =
      employer.verificationStatus === 'UNVERIFIED' ? 'KYC_COMPLETE' : employer.verificationStatus;

    const updated = await this.prisma.employer.update({
      where: { id: employer.id },
      data: {
        gstNumber: gst,
        cin,
        website,
        panNumber: pan,
        verificationStatus: nextStatus,
      },
    });
    return this.toProfile(updated);
  }

  async submitVerification(
    userId: string,
    dto: { companyName: string; workEmail: string; designation: string },
  ) {
    const employer = await this.requireEmployer(userId);
    if (
      employer.verificationStatus === 'UNVERIFIED' ||
      (!employer.gstNumber && !employer.cin && !employer.panNumber)
    ) {
      throw new HttpException(
        {
          code: SharedError.BUSINESS_RULE_VIOLATION,
          message: 'Complete company KYC details before affiliation verification.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const companyName = dto.companyName.trim().replace(/\s+/g, ' ');
    const workEmail = dto.workEmail.trim().toLowerCase();
    const designation = dto.designation.trim().replace(/\s+/g, ' ');
    const error =
      (companyName.length < 2 ? 'Enter the company name.' : null) ||
      emailError(workEmail) ||
      designationError(designation);
    if (error) {
      throw new HttpException(
        { code: SharedError.VALIDATION_ERROR, message: error },
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = await this.prisma.employer.update({
      where: { id: employer.id },
      data: {
        companyName,
        workEmail,
        designation,
        verificationStatus: 'PENDING',
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
        jobId: item.job.id,
      })),
    };
  }

  async jobs(userId: string) {
    const employer = await this.requireEmployer(userId);
    const rows = await this.prisma.job.findMany({
      where: { employerId: employer.id },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { applications: true } } },
    });
    return rows.map((job) => ({
      id: job.id,
      title: job.title,
      city: job.city,
      status: job.status,
      applicantCount: job._count.applications,
      publishedAt: job.publishedAt?.toISOString() || null,
      createdAt: job.createdAt.toISOString(),
    }));
  }

  async createJob(userId: string, dto: CreateJobInput) {
    const employer = await this.requireEmployer(userId);
    const screeningQuestions = normalizeScreeningQuestions(dto.screeningQuestions);
    return this.prisma.job.create({
      data: {
        employerId: employer.id,
        title: dto.title.trim(),
        description: dto.description.trim(),
        city: dto.city.trim(),
        department: dto.department?.trim() || null,
        hiringManager: dto.hiringManager?.trim() || null,
        openings: dto.openings && dto.openings > 0 ? dto.openings : 1,
        workMode: dto.workMode || null,
        educationMin: dto.educationMin || null,
        salaryMin: dto.salaryMin,
        salaryMax: dto.salaryMax,
        jobType: dto.jobType || 'FULL_TIME',
        category: dto.category,
        experience: dto.experience || 'NONE',
        requiredSkills: JSON.stringify(dto.requiredSkills || []),
        preferredSkills: JSON.stringify(dto.preferredSkills || []),
        benefits: dto.benefits,
        screeningQuestionsJson: JSON.stringify(screeningQuestions),
        status: dto.publish ? 'PUBLISHED' : 'DRAFT',
        publishedAt: dto.publish ? new Date() : null,
      },
    });
  }

  async job(userId: string, id: string) {
    return this.requireJob(userId, id);
  }

  async updateJob(userId: string, id: string, dto: CreateJobInput) {
    await this.requireJob(userId, id);
    const screeningQuestions = normalizeScreeningQuestions(dto.screeningQuestions);
    return this.prisma.job.update({
      where: { id },
      data: {
        title: dto.title.trim(),
        description: dto.description.trim(),
        city: dto.city.trim(),
        department: dto.department?.trim() || null,
        hiringManager: dto.hiringManager?.trim() || null,
        openings: dto.openings && dto.openings > 0 ? dto.openings : 1,
        workMode: dto.workMode || null,
        educationMin: dto.educationMin || null,
        salaryMin: dto.salaryMin,
        salaryMax: dto.salaryMax,
        jobType: dto.jobType || 'FULL_TIME',
        category: dto.category,
        experience: dto.experience,
        requiredSkills: JSON.stringify(dto.requiredSkills || []),
        preferredSkills: JSON.stringify(dto.preferredSkills || []),
        benefits: dto.benefits,
        screeningQuestionsJson: JSON.stringify(screeningQuestions),
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
    const questions = parseScreeningQuestions(job.screeningQuestionsJson);
    const questionMap = new Map(questions.map((item) => [item.id, item.prompt]));
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
      screeningAnswers: parseScreeningAnswers(row.screeningAnswersJson).map((item) => ({
        questionId: item.questionId,
        answer: item.answer,
        prompt: questionMap.get(item.questionId) || item.questionId,
      })),
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

  private toProfile(employer: {
    id: string;
    companyName: string;
    industry: string | null;
    city: string | null;
    contactName: string | null;
    gstNumber: string | null;
    cin: string | null;
    website: string | null;
    panNumber: string | null;
    workEmail: string | null;
    designation: string | null;
    verificationStatus: string;
    verified: boolean;
  }) {
    const verificationStatus =
      employer.verified && employer.verificationStatus === 'UNVERIFIED'
        ? 'VERIFIED'
        : employer.verificationStatus;
    return {
      id: employer.id,
      companyName: employer.companyName,
      industry: employer.industry,
      city: employer.city,
      contactName: employer.contactName,
      gstNumber: employer.gstNumber,
      cin: employer.cin,
      website: employer.website,
      panNumber: employer.panNumber,
      workEmail: employer.workEmail,
      designation: employer.designation,
      verificationStatus,
      verified: employer.verified || verificationStatus === 'VERIFIED',
    };
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
  department?: string;
  hiringManager?: string;
  openings?: number;
  workMode?: string;
  educationMin?: string;
  screeningQuestions?: Array<{
    id: string;
    prompt: string;
    type: string;
    options?: string[];
    required?: boolean;
  }>;
  publish?: boolean;
};

function parseList(raw: string) {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function parseScreeningAnswers(raw: string | null | undefined) {
  try {
    const value = JSON.parse(raw || '[]') as unknown;
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is { questionId: string; answer: string } => {
        return (
          Boolean(item) &&
          typeof item === 'object' &&
          typeof (item as { questionId?: unknown }).questionId === 'string' &&
          typeof (item as { answer?: unknown }).answer === 'string'
        );
      })
      .map((item) => ({ questionId: item.questionId, answer: item.answer }));
  } catch {
    return [];
  }
}

function parseScreeningQuestions(raw: string | null | undefined) {
  try {
    const value = JSON.parse(raw || '[]') as unknown;
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is { id: string; prompt: string; type: string } => {
        return (
          Boolean(item) &&
          typeof item === 'object' &&
          typeof (item as { id?: unknown }).id === 'string' &&
          typeof (item as { prompt?: unknown }).prompt === 'string'
        );
      })
      .map((item) => ({ id: item.id, prompt: item.prompt, type: item.type }));
  } catch {
    return [];
  }
}

function normalizeScreeningQuestions(
  questions?: Array<{
    id: string;
    prompt: string;
    type: string;
    options?: string[];
    required?: boolean;
  }>,
) {
  if (!questions?.length) return [];
  return questions
    .map((item) => ({
      id: item.id.trim(),
      prompt: item.prompt.trim(),
      type: item.type,
      options: (item.options || []).map((option) => option.trim()).filter(Boolean).slice(0, 6),
      required: item.required !== false,
    }))
    .filter((item) => item.id && item.prompt.length >= 3)
    .slice(0, 5);
}
