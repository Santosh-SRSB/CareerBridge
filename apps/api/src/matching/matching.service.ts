import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCode as SharedError, employerCandidateUnlockLimit } from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { IntelligenceService } from '../intelligence/intelligence.service';

@Injectable()
export class MatchingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intelligence: IntelligenceService,
    private readonly config: ConfigService,
  ) {}

  async getSkillProfile(userId: string, jobId: string) {
    const job = await this.requireJob(userId, jobId);
    const profile = await this.prisma.jobSkillProfile.findUnique({ where: { jobId: job.id } });
    return profile ? this.toSkillProfile(profile) : this.fallbackProfile(job);
  }

  async extractSkillProfile(userId: string, jobId: string) {
    const job = await this.requireJob(userId, jobId);
    const extracted = this.intelligence.extractSkillsFromJobText({
      title: job.title,
      description: job.description,
      requiredSkills: parseList(job.requiredSkills),
      preferredSkills: parseList(job.preferredSkills),
    });
    const profile = await this.prisma.jobSkillProfile.upsert({
      where: { jobId: job.id },
      create: {
        jobId: job.id,
        source: 'AI_EXTRACTED',
        requiredSkillsJson: JSON.stringify(extracted.requiredSkills),
        preferredSkillsJson: JSON.stringify(extracted.preferredSkills),
        experienceYearsMin: extracted.experienceYearsMin,
        educationMin: job.educationMin,
        interviewReadinessMin: extracted.interviewReadinessMin,
        extractionRawJson: JSON.stringify(extracted.extractionRaw),
      },
      update: {
        source: 'AI_EXTRACTED',
        requiredSkillsJson: JSON.stringify(extracted.requiredSkills),
        preferredSkillsJson: JSON.stringify(extracted.preferredSkills),
        experienceYearsMin: extracted.experienceYearsMin,
        educationMin: job.educationMin,
        interviewReadinessMin: extracted.interviewReadinessMin,
        extractionRawJson: JSON.stringify(extracted.extractionRaw),
      },
    });
    await this.prisma.job.update({
      where: { id: job.id },
      data: { requiredSkills: JSON.stringify(extracted.requiredSkills) },
    });
    return this.toSkillProfile(profile);
  }

  async saveSkillProfile(
    userId: string,
    jobId: string,
    input: {
      requiredSkills: string[];
      preferredSkills?: string[];
      experienceYearsMin?: number;
      educationMin?: string;
      interviewReadinessMin?: number;
    },
  ) {
    const job = await this.requireJob(userId, jobId);
    const profile = await this.prisma.jobSkillProfile.upsert({
      where: { jobId: job.id },
      create: {
        jobId: job.id,
        source: 'MANUAL',
        requiredSkillsJson: JSON.stringify(input.requiredSkills || []),
        preferredSkillsJson: JSON.stringify(input.preferredSkills || []),
        experienceYearsMin: input.experienceYearsMin || 0,
        educationMin: input.educationMin || job.educationMin,
        interviewReadinessMin: input.interviewReadinessMin || 0,
      },
      update: {
        source: 'HYBRID',
        requiredSkillsJson: JSON.stringify(input.requiredSkills || []),
        preferredSkillsJson: JSON.stringify(input.preferredSkills || []),
        experienceYearsMin: input.experienceYearsMin ?? 0,
        educationMin: input.educationMin || job.educationMin,
        interviewReadinessMin: input.interviewReadinessMin ?? 0,
      },
    });
    await this.prisma.job.update({
      where: { id: job.id },
      data: {
        requiredSkills: JSON.stringify(input.requiredSkills || []),
        preferredSkills: JSON.stringify(input.preferredSkills || []),
        educationMin: input.educationMin || job.educationMin,
      },
    });
    return this.toSkillProfile(profile);
  }

  async recomputeMatches(userId: string, jobId: string) {
    await this.assertJobUnlocked(userId, jobId);
    await this.recomputeMatchesForJob(jobId);
    return this.listMatches(userId, jobId);
  }

  /** Internal recompute (no employer ownership check) — used after candidate apply. */
  async recomputeMatchesForJob(jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException({
        code: SharedError.RESOURCE_NOT_FOUND,
        message: 'Job was not found',
      });
    }
    const profile = await this.prisma.jobSkillProfile.findUnique({ where: { jobId: job.id } });
    const requiredSkills = profile
      ? parseList(profile.requiredSkillsJson)
      : parseList(job.requiredSkills);
    const experienceYearsMin = profile?.experienceYearsMin || 0;

    const applications = await this.prisma.application.findMany({
      where: { jobId: job.id, status: { not: 'WITHDRAWN' } },
      select: { id: true, candidateId: true },
    });
    const applicationByCandidate = new Map(applications.map((row) => [row.candidateId, row.id]));

    const candidates = await this.prisma.candidate.findMany({
      include: {
        skills: true,
        interviews: { where: { score: { not: null } }, select: { score: true } },
        resumes: { select: { id: true }, take: 1 },
      },
      take: 200,
    });

    const scored = candidates.map((candidate) => {
      const base = this.intelligence.match(
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
      );
      const years =
        (candidate.totalExperienceYears || 0) + (candidate.totalExperienceMonths || 0) / 12;
      const experienceScore =
        experienceYearsMin <= 0
          ? base.experienceScore
          : years >= experienceYearsMin
            ? 30
            : Math.round((years / experienceYearsMin) * 30);
      const interviewReadinessScore = this.intelligence.interviewReadinessScore({
        interviewScores: candidate.interviews
          .map((item) => item.score)
          .filter((score): score is number => typeof score === 'number'),
        hasResume: candidate.resumes.length > 0,
        profileCompletion: candidate.profileCompletion || 0,
      });
      const skillsScore = Math.min(40, base.skillScore);
      const totalScore = Math.min(
        100,
        skillsScore + experienceScore + Math.round(interviewReadinessScore * 0.3),
      );
      return {
        applicationId: applicationByCandidate.get(candidate.id) || null,
        candidateId: candidate.id,
        skillsScore,
        experienceScore,
        interviewReadinessScore,
        totalScore,
        reasons: base.reasons,
        gaps: base.gaps,
      };
    });

    scored.sort((a, b) => b.totalScore - a.totalScore);
    const top = scored.slice(0, 40);

    await this.prisma.$transaction(
      top.map((item, index) =>
        this.prisma.candidateMatch.upsert({
          where: {
            jobId_candidateId: { jobId: job.id, candidateId: item.candidateId },
          },
          create: {
            jobId: job.id,
            candidateId: item.candidateId,
            applicationId: item.applicationId,
            skillsScore: item.skillsScore,
            experienceScore: item.experienceScore,
            interviewReadinessScore: item.interviewReadinessScore,
            totalScore: item.totalScore,
            rank: index + 1,
            reasonsJson: JSON.stringify(item.reasons),
            gapsJson: JSON.stringify(item.gaps),
            computedAt: new Date(),
          },
          update: {
            applicationId: item.applicationId,
            skillsScore: item.skillsScore,
            experienceScore: item.experienceScore,
            interviewReadinessScore: item.interviewReadinessScore,
            totalScore: item.totalScore,
            rank: index + 1,
            reasonsJson: JSON.stringify(item.reasons),
            gapsJson: JSON.stringify(item.gaps),
            computedAt: new Date(),
          },
        }),
      ),
    );

    const rows = await this.prisma.candidateMatch.findMany({
      where: { jobId: job.id },
      orderBy: [{ rank: 'asc' }, { totalScore: 'desc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      jobId: row.jobId,
      applicationId: row.applicationId,
      rank: row.rank,
      totalScore: row.totalScore,
      skillsScore: row.skillsScore,
      experienceScore: row.experienceScore,
      interviewReadinessScore: row.interviewReadinessScore,
    }));
  }

  jobPostingProviderRef(jobId: string) {
    return `job_post:${jobId}`;
  }

  async ensureJobPostingPayment(employerId: string, jobId: string, jobTitle: string) {
    if (this.skipPostingPaymentGate()) {
      const providerRef = this.jobPostingProviderRef(jobId);
      const existing = await this.prisma.employerPayment.findFirst({
        where: { employerId, jobId, providerRef },
      });
      if (existing) return existing;
      return this.prisma.employerPayment.create({
        data: {
          employerId,
          jobId,
          amountPaise: 0,
          currency: 'INR',
          status: 'PAID',
          provider: 'FREE',
          providerRef,
          description: `Free access · ${jobTitle}`,
          paidAt: new Date(),
        },
      });
    }
    const providerRef = this.jobPostingProviderRef(jobId);
    const existing = await this.prisma.employerPayment.findFirst({
      where: { employerId, jobId, providerRef },
    });
    if (existing) return existing;
    return this.prisma.employerPayment.create({
      data: {
        employerId,
        jobId,
        amountPaise: 99900,
        currency: 'INR',
        status: 'PENDING',
        provider: 'STATIC',
        providerRef,
        description: `Job posting fee · ${jobTitle}`,
      },
    });
  }

  async isJobPostingPaid(employerId: string, jobId: string) {
    const payment = await this.prisma.employerPayment.findFirst({
      where: {
        employerId,
        jobId,
        providerRef: this.jobPostingProviderRef(jobId),
        status: 'PAID',
      },
    });
    return Boolean(payment);
  }

  async getJobPostingPayment(userId: string, jobId: string) {
    const employer = await this.requireEmployer(userId);
    await this.requireJob(userId, jobId);
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    const payment = await this.ensureJobPostingPayment(
      employer.id,
      jobId,
      job?.title || 'Job',
    );
    return {
      id: payment.id,
      jobId: payment.jobId,
      amountPaise: payment.amountPaise,
      currency: payment.currency,
      status: payment.status,
      provider: payment.provider,
      description: payment.description,
      paidAt: payment.paidAt?.toISOString() || null,
      createdAt: payment.createdAt.toISOString(),
      unlocked: payment.status === 'PAID' || this.skipPostingPaymentGate(),
      unlockLimit:
        payment.status === 'PAID'
          ? employerCandidateUnlockLimit(payment.amountPaise)
          : this.skipPostingPaymentGate()
            ? 40
            : 0,
    };
  }

  async listMatches(userId: string, jobId: string) {
    await this.assertJobUnlocked(userId, jobId);
    const employer = await this.requireEmployer(userId);
    const job = await this.requireJob(userId, jobId);
    const unlockLimit = await this.candidateUnlockLimit(employer.id, jobId);
    const rows = await this.prisma.candidateMatch.findMany({
      where: { jobId: job.id },
      orderBy: [{ rank: 'asc' }, { totalScore: 'desc' }],
      take: unlockLimit > 0 ? unlockLimit : 0,
    });
    const candidates = await this.prisma.candidate.findMany({
      where: { id: { in: rows.map((row) => row.candidateId) } },
      include: { skills: true },
    });
    const byId = new Map(candidates.map((item) => [item.id, item]));
    return rows.map((row) => {
      const candidate = byId.get(row.candidateId);
      return {
        id: row.id,
        jobId: row.jobId,
        applicationId: row.applicationId,
        rank: row.rank,
        totalScore: row.totalScore,
        skillsScore: row.skillsScore,
        experienceScore: row.experienceScore,
        interviewReadinessScore: row.interviewReadinessScore,
        reasons: parseList(row.reasonsJson),
        gaps: parseList(row.gapsJson),
        computedAt: row.computedAt.toISOString(),
        candidate: candidate
          ? {
              id: candidate.id,
              firstName: candidate.firstName,
              lastName: candidate.lastName,
              city: candidate.city,
              skills: candidate.skills.map((item) => item.name),
            }
          : null,
      };
    });
  }

  async recordHiringOutcome(
    userId: string,
    applicationId: string,
    outcome: 'HIRED' | 'OFFER_EXTENDED' | 'OFFER_DECLINED' | 'REJECTED' | 'POSITION_FILLED',
    notes?: string,
  ) {
    const employer = await this.requireEmployer(userId);
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, job: { employerId: employer.id } },
      include: { job: true },
    });
    if (!application) {
      throw new NotFoundException({
        code: SharedError.RESOURCE_NOT_FOUND,
        message: 'Application was not found',
      });
    }
    const status =
      outcome === 'HIRED'
        ? 'HIRED'
        : outcome === 'REJECTED' || outcome === 'OFFER_DECLINED'
          ? 'REJECTED'
          : outcome === 'OFFER_EXTENDED'
            ? 'SELECTED'
            : application.status;

    const [hiringOutcome] = await this.prisma.$transaction([
      this.prisma.hiringOutcome.upsert({
        where: { applicationId: application.id },
        create: {
          employerId: employer.id,
          jobId: application.jobId,
          candidateId: application.candidateId,
          applicationId: application.id,
          outcome,
          notes: notes || null,
        },
        update: {
          outcome,
          notes: notes || null,
          decidedAt: new Date(),
        },
      }),
      this.prisma.application.update({
        where: { id: application.id },
        data: { status },
      }),
    ]);

    let payment = null as Awaited<ReturnType<typeof this.prisma.employerPayment.findFirst>> | null;
    if (outcome === 'HIRED' && !this.skipPostingPaymentGate()) {
      payment = await this.prisma.employerPayment.upsert({
        where: { hiringOutcomeId: hiringOutcome.id },
        create: {
          employerId: employer.id,
          jobId: application.jobId,
          hiringOutcomeId: hiringOutcome.id,
          amountPaise: 499900,
          currency: 'INR',
          status: 'PENDING',
          provider: 'MANUAL',
          description: `Hiring fee for ${application.job.title}`,
        },
        update: {
          status: 'PENDING',
          description: `Hiring fee for ${application.job.title}`,
        },
      });
    }

    return {
      outcome: {
        id: hiringOutcome.id,
        applicationId: hiringOutcome.applicationId,
        jobId: hiringOutcome.jobId,
        candidateId: hiringOutcome.candidateId,
        outcome: hiringOutcome.outcome,
        notes: hiringOutcome.notes,
        decidedAt: hiringOutcome.decidedAt.toISOString(),
      },
      payment: payment
        ? {
            id: payment.id,
            amountPaise: payment.amountPaise,
            currency: payment.currency,
            status: payment.status,
            description: payment.description,
          }
        : null,
    };
  }

  async listPayments(userId: string) {
    const employer = await this.requireEmployer(userId);
    const rows = await this.prisma.employerPayment.findMany({
      where: { employerId: employer.id },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      jobId: row.jobId,
      hiringOutcomeId: row.hiringOutcomeId,
      amountPaise: row.amountPaise,
      currency: row.currency,
      status: row.status,
      provider: row.provider,
      description: row.description,
      paidAt: row.paidAt?.toISOString() || null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async markPaymentPaid(userId: string, paymentId: string) {
    const employer = await this.requireEmployer(userId);
    const payment = await this.prisma.employerPayment.findFirst({
      where: { id: paymentId, employerId: employer.id },
    });
    if (!payment) {
      throw new NotFoundException({
        code: SharedError.RESOURCE_NOT_FOUND,
        message: 'Payment was not found',
      });
    }
    if (payment.status === 'PAID') {
      throw new ForbiddenException({
        code: SharedError.BUSINESS_RULE_VIOLATION,
        message: 'Payment is already marked paid.',
      });
    }
    const updated = await this.prisma.employerPayment.update({
      where: { id: payment.id },
      data: { status: 'PAID', paidAt: new Date(), provider: payment.provider || 'STATIC' },
    });
    if (payment.jobId && payment.providerRef?.startsWith('job_post:')) {
      await this.recomputeMatchesForJob(payment.jobId);
    }
    return {
      id: updated.id,
      status: updated.status,
      paidAt: updated.paidAt?.toISOString() || null,
      jobId: updated.jobId,
      unlocked: true,
    };
  }

  async candidateUnlockLimit(employerId: string, jobId: string) {
    if (this.skipPostingPaymentGate()) return 40;
    const payment = await this.prisma.employerPayment.findFirst({
      where: {
        employerId,
        jobId,
        providerRef: this.jobPostingProviderRef(jobId),
        status: 'PAID',
      },
    });
    if (!payment) return 0;
    return employerCandidateUnlockLimit(payment.amountPaise);
  }

  async assertCandidateVisibleForJob(userId: string, jobId: string, candidateId: string) {
    const employer = await this.requireEmployer(userId);
    await this.assertJobUnlocked(userId, jobId);
    const applied = await this.prisma.application.findFirst({
      where: {
        jobId,
        candidateId,
        status: { not: 'WITHDRAWN' },
        job: { employerId: employer.id },
      },
    });
    if (applied) return;

    const limit = await this.candidateUnlockLimit(employer.id, jobId);
    const match = await this.prisma.candidateMatch.findUnique({
      where: { jobId_candidateId: { jobId, candidateId } },
    });
    if (!match || match.rank == null || match.rank > limit) {
      throw new ForbiddenException({
        code: SharedError.BUSINESS_RULE_VIOLATION,
        message:
          'This candidate profile is not included in your current payment plan. Pay the job posting fee or upgrade to view more matches.',
      });
    }
  }

  async assertJobUnlocked(userId: string, jobId: string) {
    if (this.skipPostingPaymentGate()) return;
    const employer = await this.requireEmployer(userId);
    await this.requireJob(userId, jobId);
    const paid = await this.isJobPostingPaid(employer.id, jobId);
    if (!paid) {
      throw new ForbiddenException({
        code: SharedError.BUSINESS_RULE_VIOLATION,
        message: 'Complete the job posting payment to unlock matched candidate profiles.',
      });
    }
  }

  /** Free by default. Set EMPLOYER_SKIP_POSTING_PAYMENT=false to re-enable fees. */
  private skipPostingPaymentGate() {
    const raw = this.config.get<string>('EMPLOYER_SKIP_POSTING_PAYMENT')?.trim().toLowerCase();
    if (raw === 'false' || raw === '0' || raw === 'no') return false;
    return true;
  }

  private fallbackProfile(job: {
    id: string;
    requiredSkills: string;
    preferredSkills: string;
    educationMin: string | null;
    experience: string | null;
  }) {
    return {
      jobId: job.id,
      source: 'MANUAL' as const,
      requiredSkills: parseList(job.requiredSkills),
      preferredSkills: parseList(job.preferredSkills),
      experienceYearsMin: 0,
      educationMin: job.educationMin,
      interviewReadinessMin: 0,
      extractionRaw: {},
    };
  }

  private toSkillProfile(profile: {
    jobId: string;
    source: string;
    requiredSkillsJson: string;
    preferredSkillsJson: string;
    experienceYearsMin: number;
    educationMin: string | null;
    interviewReadinessMin: number;
    extractionRawJson: string;
  }) {
    return {
      jobId: profile.jobId,
      source: profile.source,
      requiredSkills: parseList(profile.requiredSkillsJson),
      preferredSkills: parseList(profile.preferredSkillsJson),
      experienceYearsMin: profile.experienceYearsMin,
      educationMin: profile.educationMin,
      interviewReadinessMin: profile.interviewReadinessMin,
      extractionRaw: safeJson(profile.extractionRawJson),
    };
  }

  private async requireEmployer(userId: string) {
    const employer = await this.prisma.employer.findUnique({ where: { userId } });
    if (!employer) {
      throw new NotFoundException({
        code: SharedError.RESOURCE_NOT_FOUND,
        message: 'Employer profile was not found',
      });
    }
    return employer;
  }

  private async requireJob(userId: string, id: string) {
    const employer = await this.requireEmployer(userId);
    const job = await this.prisma.job.findFirst({ where: { id, employerId: employer.id } });
    if (!job) {
      throw new NotFoundException({
        code: SharedError.RESOURCE_NOT_FOUND,
        message: 'Job was not found',
      });
    }
    return job;
  }
}

function parseList(raw: string | null | undefined) {
  try {
    const value = JSON.parse(raw || '[]') as unknown;
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

function safeJson(raw: string) {
  try {
    return JSON.parse(raw || '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}
