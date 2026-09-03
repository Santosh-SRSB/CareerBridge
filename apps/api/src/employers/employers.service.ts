import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApplicationStatus, EmployerInterviewStatus, JobStatus } from '../prisma/client';
import {
  ErrorCode as SharedError,
  designationError,
  emailError,
  normalizeHttpUrl,
} from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { IntelligenceService } from '../intelligence/intelligence.service';
import { MatchingService } from '../matching/matching.service';

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
    private readonly matching: MatchingService,
  ) {}

  async me(userId: string) {
    return this.toProfile(await this.requireEmployer(userId));
  }

  async updateMe(
    userId: string,
    dto: {
      companyName?: string;
      industry?: string;
      city?: string;
      contactName?: string;
      website?: string;
      workEmail?: string;
      designation?: string;
    },
  ) {
    const employer = await this.requireEmployer(userId);
    const websiteRaw = dto.website?.trim();
    const website =
      websiteRaw === undefined
        ? undefined
        : websiteRaw.length === 0
          ? null
          : normalizeHttpUrl(websiteRaw.startsWith('http') ? websiteRaw : `https://${websiteRaw}`) ||
            (websiteRaw.startsWith('http') ? websiteRaw : `https://${websiteRaw}`);
    const updated = await this.prisma.employer.update({
      where: { id: employer.id },
      data: {
        ...(dto.companyName ? { companyName: dto.companyName.trim() } : {}),
        ...(dto.industry !== undefined ? { industry: dto.industry } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.contactName !== undefined ? { contactName: dto.contactName } : {}),
        ...(website !== undefined ? { website } : {}),
        ...(dto.workEmail !== undefined ? { workEmail: dto.workEmail.trim() || null } : {}),
        ...(dto.designation !== undefined ? { designation: dto.designation.trim() || null } : {}),
      },
    });
    return this.toProfile(updated);
  }

  async saveKyc(
    userId: string,
    dto: {
      gstNumber: string;
      cin: string;
      website: string;
      panNumber: string;
      trademark?: string;
    },
  ) {
    const employer = await this.requireEmployer(userId);
    const gst = dto.gstNumber.trim().toUpperCase();
    const cin = dto.cin.trim().toUpperCase();
    const pan = dto.panNumber.trim().toUpperCase();
    const websiteRaw = dto.website.trim();
    const trademark = dto.trademark?.trim().replace(/\s+/g, ' ') || '';
    // Temporary: skip strict GST/CIN/PAN/website format checks so onboarding can proceed.
    if (![gst, cin, pan, websiteRaw].every((value) => value.length > 0)) {
      throw new HttpException(
        { code: SharedError.VALIDATION_ERROR, message: 'Fill in all KYC fields to continue.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const website =
      normalizeHttpUrl(websiteRaw.startsWith('http') ? websiteRaw : `https://${websiteRaw}`) ||
      (websiteRaw.startsWith('http') ? websiteRaw : `https://${websiteRaw}`);

    const nextStatus =
      employer.verificationStatus === 'UNVERIFIED' ? 'KYC_COMPLETE' : employer.verificationStatus;

    const updated = await this.prisma.employer.update({
      where: { id: employer.id },
      data: {
        gstNumber: gst,
        cin,
        website,
        panNumber: pan,
        ...(trademark.length >= 2 ? { companyName: trademark } : {}),
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
    const [applications, shortlisted, interviewApps, scheduledInterviews, recent] = await Promise.all([
      this.prisma.application.count({ where: { jobId: { in: jobIds } } }),
      this.prisma.application.count({ where: { jobId: { in: jobIds }, status: 'SHORTLISTED' } }),
      this.prisma.application.count({ where: { jobId: { in: jobIds }, status: 'INTERVIEW' } }),
      this.prisma.employerInterview.count({
        where: {
          employerId: employer.id,
          status: { in: ['PROPOSED', 'SCHEDULED', 'CONFIRMED', 'RESCHEDULE_REQUESTED'] },
        },
      }),
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
      interviews: Math.max(interviewApps, scheduledInterviews),
      recent: recent.map((item) => ({
        candidateName: [item.candidate.firstName, item.candidate.lastName].filter(Boolean).join(' ') || 'Candidate',
        candidateId: item.candidate.id,
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
    const job = await this.prisma.job.create({
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
        experience: dto.experience || 'Fresher',
        requiredSkills: JSON.stringify(dto.requiredSkills || []),
        preferredSkills: JSON.stringify(dto.preferredSkills || []),
        benefits: dto.benefits,
        screeningQuestionsJson: JSON.stringify(screeningQuestions),
        status: dto.publish ? 'PUBLISHED' : 'DRAFT',
        publishedAt: dto.publish ? new Date() : null,
      },
    });
    if (dto.publish) {
      await this.matching.ensureJobPostingPayment(employer.id, job.id, job.title);
    }
    return job;
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
    const job = await this.requireJob(userId, id);
    const employer = await this.requireEmployer(userId);
    const updated = await this.prisma.job.update({
      where: { id },
      data: { status, publishedAt: status === 'PUBLISHED' ? new Date() : undefined },
    });
    if (status === 'PUBLISHED') {
      await this.matching.ensureJobPostingPayment(employer.id, job.id, job.title);
    }
    return updated;
  }

  async applications(userId: string, jobId: string) {
    // Applied candidates stay visible; payment unlocks search/match pool only.
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
        experienceYears: row.candidate.totalExperienceYears || 0,
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

  async allApplications(userId: string) {
    const employer = await this.requireEmployer(userId);
    const rows = await this.prisma.application.findMany({
      where: { job: { employerId: employer.id } },
      include: {
        candidate: { include: { skills: true } },
        job: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
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
        experienceYears: row.candidate.totalExperienceYears || 0,
      },
      job: { id: row.job.id, title: row.job.title },
      match: this.intelligence.match(
        {
          city: row.candidate.city,
          careerInterests: parseList(row.candidate.careerInterests),
          skills: row.candidate.skills.map((item) => item.name),
          hasExperience: row.candidate.hasExperience,
        },
        {
          city: row.job.city,
          category: row.job.category,
          requiredSkills: parseList(row.job.requiredSkills),
          experience: row.job.experience,
        },
      ),
    }));
  }

  async searchCandidates(
    userId: string,
    query: { q?: string; city?: string; skill?: string; experienceMin?: number; jobId?: string },
  ) {
    const employer = await this.requireEmployer(userId);
    if (employer.verificationStatus === 'UNVERIFIED') {
      throw new ForbiddenException({
        code: SharedError.BUSINESS_RULE_VIOLATION,
        message: 'Complete company KYC before searching candidates.',
      });
    }

    const jobId = query.jobId?.trim();
    if (!jobId) {
      throw new BadRequestException({
        code: SharedError.VALIDATION_ERROR,
        message: 'Select a job to search matched candidates.',
      });
    }

    await this.matching.assertJobUnlocked(userId, jobId);
    const job = await this.requireJob(userId, jobId);
    const unlockLimit = await this.matching.candidateUnlockLimit(employer.id, jobId);

    const skillFilter = query.skill?.trim().toLowerCase();
    const cityFilter = query.city?.trim();
    const q = query.q?.trim();
    const experienceMin = query.experienceMin && query.experienceMin > 0 ? query.experienceMin : 0;

    const matchRows = await this.prisma.candidateMatch.findMany({
      where: { jobId: job.id },
      orderBy: [{ rank: 'asc' }, { totalScore: 'desc' }],
      take: unlockLimit > 0 ? unlockLimit : 0,
    });

    const totalMatched = await this.prisma.candidateMatch.count({ where: { jobId: job.id } });

    if (!matchRows.length) {
      return {
        jobId,
        unlocked: true,
        unlockLimit,
        totalMatched,
        candidates: [],
      };
    }

    const candidates = await this.prisma.candidate.findMany({
      where: { id: { in: matchRows.map((row) => row.candidateId) } },
      include: {
        skills: true,
        experiences: { orderBy: { startDate: 'desc' }, take: 1 },
        applications: {
          where: { jobId: job.id, status: { not: 'WITHDRAWN' } },
          take: 1,
        },
      },
    });
    const candidateById = new Map(candidates.map((row) => [row.id, row]));
    const matchByCandidate = new Map(matchRows.map((row) => [row.candidateId, row]));

    const filtered = matchRows
      .map((match) => {
        const candidate = candidateById.get(match.candidateId);
        if (!candidate) return null;
        if (cityFilter && !candidate.city?.toLowerCase().includes(cityFilter.toLowerCase())) {
          return null;
        }
        if (experienceMin > 0 && (candidate.totalExperienceYears || 0) < experienceMin) {
          return null;
        }
        if (skillFilter && !candidate.skills.some((item) => item.name.toLowerCase().includes(skillFilter))) {
          return null;
        }
        if (q) {
          const haystack = [
            candidate.firstName,
            candidate.lastName,
            candidate.city,
            candidate.highestEducation,
            ...candidate.skills.map((item) => item.name),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(q.toLowerCase())) return null;
        }
        return { match, candidate };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    return {
      jobId,
      unlocked: true,
      unlockLimit,
      totalMatched,
      candidates: filtered.map(({ match, candidate }) => {
        const latestRole = candidate.experiences[0];
        const matchScore = Math.round(match.totalScore);
        return {
          id: candidate.id,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          city: candidate.city,
          highestEducation: candidate.highestEducation,
          experienceYears: candidate.totalExperienceYears,
          profileCompletion: candidate.profileCompletion,
          skills: candidate.skills.map((item) => item.name).slice(0, 8),
          latestRole: latestRole
            ? { title: latestRole.jobTitle, company: latestRole.company }
            : null,
          matchScore,
          appliedToEmployer: candidate.applications.length > 0,
          applicationId: candidate.applications[0]?.id || null,
        };
      }),
    };
  }

  async candidateView(userId: string, candidateId: string, jobId?: string) {
    const employer = await this.requireEmployer(userId);
    const applied = await this.prisma.application.findFirst({
      where: { candidateId, job: { employerId: employer.id } },
      include: {
        job: { select: { id: true, title: true } },
      },
    });

    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        skills: true,
        education: { orderBy: { yearCompleted: 'desc' }, take: 4 },
        experiences: { orderBy: { startDate: 'desc' }, take: 3 },
        resumes: { select: { id: true }, take: 1 },
      },
    });
    if (!candidate || !candidate.onboardingCompleted) {
      throw new NotFoundException({
        code: SharedError.RESOURCE_NOT_FOUND,
        message: 'Candidate profile was not found',
      });
    }

    if (employer.verificationStatus === 'UNVERIFIED' && !applied) {
      throw new ForbiddenException({
        code: SharedError.BUSINESS_RULE_VIOLATION,
        message: 'Complete company KYC before viewing candidate profiles.',
      });
    }

    const resolvedJobId = jobId || applied?.job.id;
    if (resolvedJobId && !applied) {
      await this.matching.assertCandidateVisibleForJob(userId, resolvedJobId, candidateId);
    } else if (resolvedJobId && applied) {
      await this.matching.assertJobUnlocked(userId, resolvedJobId);
    } else if (!applied) {
      throw new ForbiddenException({
        code: SharedError.BUSINESS_RULE_VIOLATION,
        message: 'Select a paid job to view this candidate profile.',
      });
    }

    const job = resolvedJobId
      ? await this.requireJob(userId, resolvedJobId)
      : applied
        ? await this.prisma.job.findUnique({ where: { id: applied.job.id } })
        : null;
    const match = job
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
            requiredSkills: parseList(job.requiredSkills),
            experience: job.experience,
          },
        )
      : null;

    return {
      id: candidate.id,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      city: candidate.city,
      state: candidate.state,
      highestEducation: candidate.highestEducation,
      experienceYears: candidate.totalExperienceYears,
      experienceMonths: candidate.totalExperienceMonths,
      profileCompletion: candidate.profileCompletion,
      about: candidate.about,
      openToRelocating: candidate.openToRelocating,
      skills: candidate.skills.map((item) => item.name),
      education: candidate.education.map((item) => ({
        qualification: item.qualification,
        institution: item.institution,
        fieldOfStudy: item.fieldOfStudy,
        yearCompleted: item.yearCompleted,
      })),
      experiences: candidate.experiences.map((item) => ({
        company: item.company,
        jobTitle: item.jobTitle,
        isInternship: item.isInternship,
        stillInCompany: item.stillInCompany,
      })),
      hasResume: candidate.resumes.length > 0,
      application: applied
        ? {
            id: applied.id,
            status: applied.status,
            jobId: applied.job.id,
            jobTitle: applied.job.title,
          }
        : null,
      match: match
        ? { score: match.score, reasons: match.reasons, gaps: match.gaps }
        : null,
      view: 'CONTROLLED_PASSPORT',
    };
  }

  async listInterviews(userId: string) {
    const employer = await this.requireEmployer(userId);
    const rows = await this.prisma.employerInterview.findMany({
      where: { employerId: employer.id },
      include: {
        application: {
          include: {
            candidate: { include: { skills: true } },
            job: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 100,
    });
    return rows.map((row) => this.toInterview(row));
  }

  async scheduleInterview(
    userId: string,
    dto: {
      applicationId: string;
      scheduledAt: string;
      durationMin?: number;
      mode?: string;
      location?: string;
      notes?: string;
      notifyWhatsApp?: boolean;
      notifyEmail?: boolean;
    },
  ) {
    const employer = await this.requireEmployer(userId);
    const application = await this.prisma.application.findFirst({
      where: { id: dto.applicationId, job: { employerId: employer.id } },
      include: { candidate: true, job: true },
    });
    if (!application) {
      throw new NotFoundException({
        code: SharedError.RESOURCE_NOT_FOUND,
        message: 'Application was not found',
      });
    }

    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() - 60_000) {
      throw new HttpException(
        { code: SharedError.VALIDATION_ERROR, message: 'Choose a valid future interview time.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const mode = dto.mode?.trim().toUpperCase() || 'VIDEO';
    const durationMin = dto.durationMin && dto.durationMin > 0 ? dto.durationMin : 30;
    const notifyBits = [
      dto.notifyWhatsApp !== false ? 'WhatsApp notify: yes' : 'WhatsApp notify: no',
      dto.notifyEmail !== false ? 'Email notify: yes' : 'Email notify: no',
    ];
    const notes = [dto.notes?.trim(), ...notifyBits].filter(Boolean).join('\n') || null;

    const interview = await this.prisma.$transaction(async (tx) => {
      if (application.status !== 'INTERVIEW' && application.status !== 'SELECTED') {
        await tx.application.update({
          where: { id: application.id },
          data: { status: 'INTERVIEW' },
        });
      }
      return tx.employerInterview.create({
        data: {
          employerId: employer.id,
          applicationId: application.id,
          jobId: application.jobId,
          candidateId: application.candidateId,
          scheduledAt,
          durationMin,
          mode,
          location: dto.location?.trim() || null,
          notes,
          status: 'SCHEDULED',
        },
        include: {
          application: {
            include: {
              candidate: { include: { skills: true } },
              job: { select: { id: true, title: true } },
            },
          },
        },
      });
    });

    // Notification Service hook (WhatsApp/email) — event-ready stub for Sprint 3 provider wiring.
    return this.toInterview(interview);
  }

  async updateInterviewStatus(
    userId: string,
    interviewId: string,
    action: 'confirm' | 'reschedule' | 'complete' | 'cancel' | 'notes',
    payload?: { scheduledAt?: string; notes?: string },
  ) {
    const employer = await this.requireEmployer(userId);
    const interview = await this.prisma.employerInterview.findFirst({
      where: { id: interviewId, employerId: employer.id },
      include: {
        application: {
          include: {
            candidate: { include: { skills: true } },
            job: { select: { id: true, title: true } },
          },
        },
      },
    });
    if (!interview) {
      throw new NotFoundException({
        code: SharedError.RESOURCE_NOT_FOUND,
        message: 'Interview was not found',
      });
    }

    let status: EmployerInterviewStatus = interview.status;
    let scheduledAt = interview.scheduledAt;
    let confirmedAt = interview.confirmedAt;
    let notes = interview.notes;

    if (action === 'notes') {
      notes = (payload?.notes || '').trim() || null;
    } else if (action === 'confirm') {
      status = 'CONFIRMED';
      confirmedAt = new Date();
      if (payload?.notes !== undefined) notes = payload.notes.trim();
    } else if (action === 'reschedule') {
      const next = payload?.scheduledAt ? new Date(payload.scheduledAt) : null;
      if (!next || Number.isNaN(next.getTime())) {
        throw new HttpException(
          { code: SharedError.VALIDATION_ERROR, message: 'Provide a valid reschedule time.' },
          HttpStatus.BAD_REQUEST,
        );
      }
      scheduledAt = next;
      status = 'RESCHEDULE_REQUESTED';
      confirmedAt = null;
      if (payload?.notes !== undefined) notes = payload.notes.trim();
    } else if (action === 'complete') {
      status = 'COMPLETED';
      if (payload?.notes !== undefined) notes = payload.notes.trim();
    } else if (action === 'cancel') {
      status = 'CANCELLED';
      if (payload?.notes !== undefined) notes = payload.notes.trim();
    } else {
      throw new ForbiddenException({
        code: SharedError.BUSINESS_RULE_VIOLATION,
        message: 'This action is not allowed.',
      });
    }

    const updated = await this.prisma.employerInterview.update({
      where: { id: interview.id },
      data: { status, scheduledAt, confirmedAt, notes },
      include: {
        application: {
          include: {
            candidate: { include: { skills: true } },
            job: { select: { id: true, title: true } },
          },
        },
      },
    });
    return this.toInterview(updated);
  }

  private toInterview(row: {
    id: string;
    applicationId: string;
    jobId: string;
    candidateId: string;
    scheduledAt: Date;
    durationMin: number;
    mode: string;
    location: string | null;
    status: EmployerInterviewStatus;
    notes: string | null;
    confirmedAt: Date | null;
    createdAt: Date;
    application: {
      status: ApplicationStatus;
      candidate: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        city: string | null;
        skills: Array<{ name: string }>;
      };
      job: { id: string; title: string };
    };
  }) {
    const candidate = row.application.candidate;
    return {
      id: row.id,
      applicationId: row.applicationId,
      jobId: row.jobId,
      candidateId: row.candidateId,
      scheduledAt: row.scheduledAt.toISOString(),
      durationMin: row.durationMin,
      mode: row.mode,
      location: row.location,
      status: row.status,
      notes: row.notes,
      confirmedAt: row.confirmedAt?.toISOString() || null,
      createdAt: row.createdAt.toISOString(),
      applicationStatus: row.application.status,
      candidate: {
        id: candidate.id,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        city: candidate.city,
        skills: candidate.skills.map((item) => item.name),
      },
      job: row.application.job,
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
