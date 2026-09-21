import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApplicationStatus, EmployerInterviewStatus, JobStatus } from '../prisma/client';
import {
  ErrorCode as SharedError,
  designationError,
  emailError,
  lookupCityCentroid,
  normalizeHttpUrl,
} from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { IntelligenceService } from '../intelligence/intelligence.service';
import { MatchingService } from '../matching/matching.service';
import { InterviewWhatsAppService } from '../whatsapp/interview-whatsapp.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { WhatsAppWebhookService } from '../whatsapp/whatsapp.webhook.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';
import { ResumesService } from '../resumes/resumes.service';
import { EmailService } from '../auth/email.service';
import { JobsService } from '../jobs/jobs.service';
import { StorageService } from '../common/storage/storage.service';

const ACTION_STATUS: Record<string, ApplicationStatus> = {
  REVIEW: 'UNDER_REVIEW',
  SHORTLIST: 'SHORTLISTED',
  INTERVIEW: 'INTERVIEW',
  SELECT: 'SELECTED',
  REJECT: 'REJECTED',
  HIRE: 'HIRED',
};

const RESCHEDULE_PREF_RE = /\[\[RESCHEDULE_PREF:([^\]]+)\]\]/;
const RESCHEDULE_REASON_RE = /\[\[RESCHEDULE_REASON:([^\]]*)\]\]/;

function stripRescheduleMarkers(notes: string | null | undefined) {
  return (notes || '')
    .replace(RESCHEDULE_PREF_RE, '')
    .replace(RESCHEDULE_REASON_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parsePreferredReschedule(notes: string | null | undefined) {
  const match = (notes || '').match(RESCHEDULE_PREF_RE);
  if (!match?.[1]) return null;
  const date = new Date(match[1]);
  return Number.isNaN(date.getTime()) ? null : date;
}

@Injectable()
export class EmployersService {
  private readonly logger = new Logger(EmployersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly intelligence: IntelligenceService,
    private readonly matching: MatchingService,
    private readonly interviewWhatsApp: InterviewWhatsAppService,
    private readonly whatsapp: WhatsAppService,
    private readonly whatsappWebhook: WhatsAppWebhookService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly resumes: ResumesService,
    private readonly email: EmailService,
    private readonly jobsService: JobsService,
    private readonly storage: StorageService,
  ) {}

  async me(userId: string) {
    return this.toProfile(await this.requireEmployer(userId));
  }

  async uploadLogoFile(
    userId: string,
    file: { buffer: Buffer; mimetype: string; size: number; originalname?: string },
  ) {
    const mime = (file.mimetype || '').toLowerCase();
    const allowed =
      mime.startsWith('image/jpeg') ||
      mime.startsWith('image/jpg') ||
      mime.startsWith('image/png') ||
      mime.startsWith('image/webp');
    if (!allowed) {
      throw new BadRequestException({
        code: SharedError.VALIDATION_ERROR,
        message: 'Please upload a JPG, PNG, or WebP logo.',
      });
    }
    if (!file.buffer?.length || file.size > 5 * 1024 * 1024) {
      throw new BadRequestException({
        code: SharedError.VALIDATION_ERROR,
        message: 'Logo must be under 5 MB.',
      });
    }

    const employer = await this.requireEmployer(userId);
    const ext = mime.includes('png') ? '.png' : mime.includes('webp') ? '.webp' : '.jpg';
    const contentType = mime.includes('png')
      ? 'image/png'
      : mime.includes('webp')
        ? 'image/webp'
        : 'image/jpeg';
    let storedUrl: string;

    if (this.storage.isConfigured()) {
      try {
        const path = this.storage.imageObjectPath(
          `logo-${Date.now()}${ext}`,
          employer.id.slice(0, 8),
        );
        const uploaded = await this.storage.uploadFile(path, file.buffer, {
          contentType,
          isPublic: true,
          metadata: { employerId: employer.id, source: 'company-logo' },
        });
        storedUrl = uploaded.publicUrl;
      } catch (err) {
        this.logger.error(
          `Company logo GCS upload failed for ${employer.id}: ${(err as Error).message}`,
        );
        storedUrl = `data:${contentType};base64,${file.buffer.toString('base64')}`;
      }
    } else {
      storedUrl = `data:${contentType};base64,${file.buffer.toString('base64')}`;
    }

    const updated = await this.prisma.employer.update({
      where: { id: employer.id },
      data: { logoUrl: storedUrl },
    });
    this.logger.log(`Saved company logo for employer ${employer.id} (${file.size} bytes)`);
    return this.toProfile(updated);
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
      cin?: string;
      website: string;
      panNumber: string;
      trademark?: string;
    },
  ) {
    const employer = await this.requireEmployer(userId);
    const gst = dto.gstNumber.trim().toUpperCase();
    const cin = (dto.cin || '').trim().toUpperCase();
    const pan = dto.panNumber.trim().toUpperCase();
    const websiteRaw = dto.website.trim();
    const trademark = dto.trademark?.trim().replace(/\s+/g, ' ') || '';
    if (![gst, pan, websiteRaw].every((value) => value.length > 0)) {
      throw new HttpException(
        { code: SharedError.VALIDATION_ERROR, message: 'GSTIN, PAN, and website are required.' },
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
        cin: cin || null,
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

    const now = new Date();
    const monthBuckets = Array.from({ length: 6 }, (_, index) => {
      const offset = 5 - index;
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      return {
        year: date.getFullYear(),
        month: date.getMonth(),
        label: date.toLocaleString('en-IN', { month: 'short' }),
        count: 0,
        start: date,
        end: new Date(date.getFullYear(), date.getMonth() + 1, 1),
      };
    });
    const seriesStart = monthBuckets[0]?.start || new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [applications, shortlisted, interviewApps, scheduledInterviews, recent, monthlyApps] =
      await Promise.all([
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
        jobIds.length
          ? this.prisma.application.findMany({
              where: { jobId: { in: jobIds }, createdAt: { gte: seriesStart } },
              select: { createdAt: true },
            })
          : Promise.resolve([] as Array<{ createdAt: Date }>),
      ]);

    for (const row of monthlyApps) {
      const created = row.createdAt;
      const bucket = monthBuckets.find(
        (item) => created >= item.start && created < item.end,
      );
      if (bucket) bucket.count += 1;
    }

    return {
      openJobs: jobs.filter((item) => item.status === 'PUBLISHED').length,
      applications,
      shortlisted,
      interviews: Math.max(interviewApps, scheduledInterviews),
      applicationsByMonth: monthBuckets.map(({ year, month, label, count }) => ({
        year,
        month,
        label,
        count,
      })),
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
    const city = dto.city.trim();
    const geo = lookupCityCentroid(city);
    const job = await this.prisma.job.create({
      data: {
        employerId: employer.id,
        title: dto.title.trim(),
        description: dto.description.trim(),
        city,
        latitude: geo?.lat ?? null,
        longitude: geo?.lng ?? null,
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
      await this.matching.recomputeMatchesForJob(job.id);
      await this.jobsService.notifyCandidatesForPublishedJob(job.id).catch(() => undefined);
    }
    return job;
  }

  async job(userId: string, id: string) {
    return this.requireJob(userId, id);
  }

  async updateJob(userId: string, id: string, dto: CreateJobInput) {
    const existing = await this.requireJob(userId, id);
    const screeningQuestions = normalizeScreeningQuestions(dto.screeningQuestions);
    const city = dto.city.trim();
    const geo = lookupCityCentroid(city);
    const updated = await this.prisma.job.update({
      where: { id },
      data: {
        title: dto.title.trim(),
        description: dto.description.trim(),
        city,
        latitude: geo?.lat ?? null,
        longitude: geo?.lng ?? null,
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
    if (existing.status === 'PUBLISHED') {
      await this.matching.recomputeMatchesForJob(id);
    }
    return updated;
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
      await this.matching.recomputeMatchesForJob(job.id);
      await this.jobsService.notifyCandidatesForPublishedJob(job.id).catch(() => undefined);
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
      include: {
        candidate: {
          include: {
            skills: true,
            education: { select: { id: true } },
            resumes: { orderBy: { updatedAt: 'desc' }, take: 1, select: { id: true, score: true } },
          },
        },
      },
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
      match: this.scoreApplicationMatch(row.candidate, job),
    }));
  }

  async allApplications(userId: string) {
    const employer = await this.requireEmployer(userId);
    const rows = await this.prisma.application.findMany({
      where: { job: { employerId: employer.id } },
      include: {
        candidate: {
          include: {
            skills: true,
            education: { select: { id: true } },
            resumes: { orderBy: { updatedAt: 'desc' }, take: 1, select: { id: true, score: true } },
          },
        },
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
      match: this.scoreApplicationMatch(row.candidate, row.job),
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

    let matchRows = await this.prisma.candidateMatch.findMany({
      where: { jobId: job.id },
      orderBy: [{ rank: 'asc' }, { totalScore: 'desc' }],
      take: unlockLimit > 0 ? unlockLimit : 0,
    });

    // First open of a published job: score candidates automatically from live profiles.
    if (!matchRows.length && unlockLimit > 0) {
      await this.matching.recomputeMatchesForJob(job.id);
      matchRows = await this.prisma.candidateMatch.findMany({
        where: { jobId: job.id },
        orderBy: [{ rank: 'asc' }, { totalScore: 'desc' }],
        take: unlockLimit,
      });
    }

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
        experiences: { orderBy: { startDate: 'desc' }, take: 3 },
        applications: {
          where: { jobId: job.id, status: { not: 'WITHDRAWN' } },
          take: 1,
          select: {
            id: true,
            status: true,
            screeningAnswersJson: true,
          },
        },
      },
    });
    const candidateById = new Map(candidates.map((row) => [row.id, row]));
    const questionMap = new Map(
      parseScreeningQuestions(job.screeningQuestionsJson).map((item) => [item.id, item.prompt]),
    );

    const filtered = matchRows
      .map((match) => {
        const candidate = candidateById.get(match.candidateId);
        if (!candidate) return null;
        if (cityFilter && !candidate.city?.toLowerCase().includes(cityFilter.toLowerCase())) {
          return null;
        }
        if (experienceMin > 0) {
          const candidateYears =
            (candidate.totalExperienceYears || 0) + (candidate.totalExperienceMonths || 0) / 12;
          if (candidateYears + 1e-9 < experienceMin) return null;
        }
        if (skillFilter && !candidate.skills.some((item) => item.name.toLowerCase().includes(skillFilter))) {
          return null;
        }
        if (q) {
          const haystack = [
            candidate.firstName,
            candidate.lastName,
            candidate.city,
            candidate.state,
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
        const currentlyEmployed = candidate.experiences.some((item) => item.stillInCompany);
        const application = candidate.applications[0] || null;
        const noticeAnswer = extractNoticePeriodAnswer(
          application?.screeningAnswersJson,
          questionMap,
        );
        const availability = resolveCandidateAvailability({
          stillInCollege: candidate.stillInCollege,
          currentlyEmployed,
          noticeAnswer,
          experienceYears: candidate.totalExperienceYears || 0,
        });
        const skillNames = candidate.skills.map((item) => item.name);
        const matchScore = Math.round(match.totalScore);
        return {
          id: candidate.id,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          city: candidate.city,
          state: candidate.state,
          highestEducation: candidate.highestEducation,
          experienceYears: candidate.totalExperienceYears || 0,
          experienceMonths: candidate.totalExperienceMonths || 0,
          stillInCollege: candidate.stillInCollege,
          openToRelocating: candidate.openToRelocating,
          currentlyEmployed,
          availabilityLabel: availability.label,
          availabilityTone: availability.tone,
          profileCompletion: candidate.profileCompletion,
          skills: skillNames.slice(0, 6),
          skillsTotal: skillNames.length,
          latestRole: latestRole
            ? { title: latestRole.jobTitle, company: latestRole.company }
            : null,
          matchScore,
          appliedToEmployer: Boolean(application),
          applicationId: application?.id || null,
          applicationStatus: application?.status || null,
        };
      }),
    };
  }

  async notifyMatchedCandidate(userId: string, candidateId: string, jobId: string) {
    const employer = await this.requireEmployer(userId);
    const job = await this.requireJob(userId, jobId);
    await this.matching.assertCandidateVisibleForJob(userId, jobId, candidateId);

    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      select: {
        id: true,
        userId: true,
        firstName: true,
        whatsappOptIn: true,
        whatsappNumber: true,
        user: { select: { phone: true } },
      },
    });
    if (!candidate) {
      throw new NotFoundException({
        code: SharedError.RESOURCE_NOT_FOUND,
        message: 'Candidate was not found',
      });
    }

    const company = employer.companyName?.trim() || 'An employer';
    const firstName = candidate.firstName?.trim() || 'there';
    const portalBase = (this.config.get<string>('WEB_ORIGIN', 'http://localhost:3000') || '')
      .split(',')[0]
      .trim();
    const jobUrl = `${portalBase}/jobs/${job.id}`;

    await this.notifications.create({
      userId: candidate.userId,
      title: 'Invited to apply',
      body: `You were invited by ${company} for ${job.title}.`,
      type: 'JOB_INVITE',
      link: `/jobs/${job.id}`,
    });

    let whatsappSent = false;
    const phone = this.whatsappWebhook.resolveNotifyPhone(candidate);
    if (phone) {
      try {
        await this.whatsapp.sendText({
          to: phone,
          candidateId: candidate.id,
          messageType: 'job_invite',
          body: `Hi ${firstName}, ${company} invited you to apply for ${job.title} on CareerBridge.\n\nView the role: ${jobUrl}`,
        });
        whatsappSent = true;
      } catch {
        // In-app notify already sent; WhatsApp is best-effort.
      }
    }

    return { ok: true as const, candidateId, jobId, whatsappSent };
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
        resumes: {
          select: { id: true, score: true },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
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
    const match = job ? this.scoreApplicationMatch(candidate, job) : null;

    const resumeId = applied?.resumeId || candidate.resumes[0]?.id || null;

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
      hasResume: Boolean(resumeId),
      resumeId,
      application: applied
        ? {
            id: applied.id,
            status: applied.status,
            jobId: applied.job.id,
            jobTitle: applied.job.title,
          }
        : null,
      match,
      view: 'CONTROLLED_PASSPORT',
    };
  }

  async downloadCandidateResume(userId: string, candidateId: string, jobId?: string) {
    const employer = await this.requireEmployer(userId);
    const applied = await this.prisma.application.findFirst({
      where: { candidateId, job: { employerId: employer.id } },
      include: { candidate: { select: { userId: true } } },
    });
    if (!applied) {
      throw new ForbiddenException({
        code: SharedError.BUSINESS_RULE_VIOLATION,
        message: 'Resume is available only for candidates who applied to your jobs.',
      });
    }
    if (jobId && applied.jobId !== jobId) {
      throw new ForbiddenException({
        code: SharedError.BUSINESS_RULE_VIOLATION,
        message: 'This application does not match the selected job.',
      });
    }

    const resumeId =
      applied.resumeId ||
      (
        await this.prisma.resume.findFirst({
          where: { candidateId },
          orderBy: { updatedAt: 'desc' },
          select: { id: true },
        })
      )?.id;

    if (!resumeId) {
      throw new NotFoundException({
        code: SharedError.RESOURCE_NOT_FOUND,
        message: 'This candidate has not uploaded a resume yet.',
      });
    }

    return this.resumes.download(applied.candidate.userId, resumeId);
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
      include: { candidate: { include: { user: true } }, job: true },
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
    const scheduledEnd = new Date(scheduledAt.getTime() + durationMin * 60_000);
    const portalBase = (this.config.get<string>('WEB_ORIGIN', 'http://localhost:3000') || '')
      .split(',')[0]
      .trim();
    const locationRaw = dto.location?.trim() || '';
    if (mode === 'VIDEO') {
      const meetingUrl = normalizeHttpUrl(locationRaw);
      if (!meetingUrl) {
        throw new HttpException(
          {
            code: SharedError.VALIDATION_ERROR,
            message: 'Enter a valid meeting link (e.g. Google Meet or Zoom URL) before scheduling.',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    } else if (!locationRaw) {
      throw new HttpException(
        {
          code: SharedError.VALIDATION_ERROR,
          message:
            mode === 'IN_PERSON'
              ? 'Enter the venue address before scheduling.'
              : 'Enter the phone / dial-in details before scheduling.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    const location =
      mode === 'VIDEO' ? (normalizeHttpUrl(locationRaw) as string) : locationRaw;
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
          scheduledEnd,
          timezone: 'Asia/Kolkata',
          durationMin,
          mode,
          location,
          meetingUrl: null,
          notes,
          status: 'SCHEDULED',
          whatsappStatus: dto.notifyWhatsApp === false ? 'SKIPPED_BY_EMPLOYER' : 'QUEUED',
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

    const portalMeetingUrl = `${portalBase}/interviews/scheduled/${interview.id}`;
    const joinUrl =
      (location && /^https?:\/\//i.test(location) ? location : null) || portalMeetingUrl;

    const withMeeting = await this.prisma.employerInterview.update({
      where: { id: interview.id },
      data: { meetingUrl: joinUrl },
      include: {
        application: {
          include: {
            candidate: { include: { skills: true } },
            job: { select: { id: true, title: true } },
          },
        },
      },
    });

    // System of record is PostgreSQL. WhatsApp is async via Cloud Tasks / local queue.
    if (dto.notifyWhatsApp !== false) {
      await this.interviewWhatsApp.enqueueInvitation(withMeeting.id).catch(() => undefined);
    }

    const whenLabel = new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    }).format(scheduledAt);
    const candidateName =
      [application.candidate.firstName, application.candidate.lastName].filter(Boolean).join(' ').trim() ||
      'there';
    const candidateEmail = application.candidate.user?.email?.trim() || '';

    await this.notifications
      .create({
        userId: application.candidate.userId,
        title: 'Interview scheduled',
        body: `${employer.companyName || 'An employer'} scheduled an interview for ${application.job.title} on ${whenLabel}.`,
        type: 'INTERVIEW',
        link: `/interviews/scheduled/${withMeeting.id}`,
      })
      .catch(() => undefined);

    if (dto.notifyEmail !== false && candidateEmail) {
      await this.email
        .sendEmployerInterviewScheduled({
          to: candidateEmail,
          candidateName: application.candidate.firstName || candidateName,
          companyName: employer.companyName || 'Employer',
          jobTitle: application.job.title,
          whenLabel,
          mode,
          portalUrl: portalMeetingUrl,
          meetingUrl: joinUrl,
          location,
        })
        .catch(() => undefined);
    }

    return this.toInterview(withMeeting);
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
            candidate: { include: { user: true, skills: true } },
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
    let notifyCandidate: 'approved' | 'rescheduled' | null = null;

    if (action === 'notes') {
      notes = (payload?.notes || '').trim() || null;
    } else if (action === 'confirm') {
      // Approve candidate reschedule request (preferred slot) or confirm pending interview.
      const preferred = parsePreferredReschedule(interview.notes);
      const next = payload?.scheduledAt ? new Date(payload.scheduledAt) : preferred;
      if (next && !Number.isNaN(next.getTime())) {
        if (next.getTime() < Date.now() - 60_000) {
          throw new HttpException(
            { code: SharedError.VALIDATION_ERROR, message: 'Interview time cannot be in the past.' },
            HttpStatus.BAD_REQUEST,
          );
        }
        scheduledAt = next;
      }
      status = 'CONFIRMED';
      confirmedAt = new Date();
      notes = stripRescheduleMarkers(notes) || null;
      if (payload?.notes !== undefined) notes = payload.notes.trim() || notes;
      notifyCandidate = interview.status === 'RESCHEDULE_REQUESTED' ? 'approved' : null;
    } else if (action === 'reschedule') {
      const next = payload?.scheduledAt ? new Date(payload.scheduledAt) : null;
      if (!next || Number.isNaN(next.getTime())) {
        throw new HttpException(
          { code: SharedError.VALIDATION_ERROR, message: 'Provide a valid reschedule time.' },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (next.getTime() < Date.now() - 60_000) {
        throw new HttpException(
          { code: SharedError.VALIDATION_ERROR, message: 'Interview time cannot be in the past.' },
          HttpStatus.BAD_REQUEST,
        );
      }
      scheduledAt = next;
      // Employer-proposed new time — candidate should confirm again.
      status = 'SCHEDULED';
      confirmedAt = null;
      notes = stripRescheduleMarkers(notes) || null;
      if (payload?.notes !== undefined) notes = payload.notes.trim() || notes;
      notifyCandidate = 'rescheduled';
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

    const portalBase = (this.config.get<string>('WEB_ORIGIN', 'http://localhost:3000') || '')
      .split(',')[0]
      .trim();
    const location = (interview.location || '').trim();
    const meetingUrl =
      (location && /^https?:\/\//i.test(location) ? location : null) ||
      interview.meetingUrl ||
      `${portalBase}/interviews/scheduled/${interview.id}`;
    const scheduledEnd = new Date(scheduledAt.getTime() + interview.durationMin * 60_000);

    const updated = await this.prisma.employerInterview.update({
      where: { id: interview.id },
      data: { status, scheduledAt, scheduledEnd, confirmedAt, notes, meetingUrl },
      include: {
        application: {
          include: {
            candidate: { include: { user: true, skills: true } },
            job: { select: { id: true, title: true } },
          },
        },
      },
    });

    if (notifyCandidate) {
      const candidateUser = updated.application.candidate.user;
      const candidateName =
        [updated.application.candidate.firstName, updated.application.candidate.lastName]
          .filter(Boolean)
          .join(' ')
          .trim() || 'there';
      const whenLabel = new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata',
      }).format(updated.scheduledAt);

      await this.notifications
        .create({
          userId: candidateUser.id,
          title: notifyCandidate === 'approved' ? 'Reschedule approved' : 'Interview rescheduled',
          body:
            notifyCandidate === 'approved'
              ? `${employer.companyName || 'Employer'} approved your preferred time for ${updated.application.job.title}.`
              : `${employer.companyName || 'Employer'} proposed a new time for ${updated.application.job.title}. Please confirm.`,
          type: 'INTERVIEW',
          link: `/interviews/scheduled/${updated.id}`,
        })
        .catch(() => undefined);

      if (candidateUser.email) {
        await this.email
          .sendEmployerInterviewRescheduleUpdate({
            to: candidateUser.email,
            candidateName,
            companyName: employer.companyName || 'Employer',
            jobTitle: updated.application.job.title,
            whenLabel,
            meetingUrl,
            approved: notifyCandidate === 'approved',
          })
          .catch(() => undefined);
      }

      if (notifyCandidate === 'approved') {
        await this.interviewWhatsApp.sendConfirmationNow(updated.id).catch(() => undefined);
      } else {
        await this.interviewWhatsApp.enqueueInvitation(updated.id).catch(() => undefined);
      }
    }

    return this.toInterview(updated);
  }

  async requestInterviewFeedback(userId: string, interviewId: string) {
    const employer = await this.requireEmployer(userId);
    const interview = await this.prisma.employerInterview.findFirst({
      where: { id: interviewId, employerId: employer.id },
      include: {
        application: {
          include: {
            candidate: { include: { user: true, skills: true } },
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
    if (interview.candidateFeedbackAt) {
      return this.toInterview(interview);
    }
    if (!['CONFIRMED', 'COMPLETED'].includes(interview.status)) {
      throw new BadRequestException({
        code: SharedError.BUSINESS_RULE_VIOLATION,
        message: 'Feedback can be requested after the interview is confirmed or completed.',
      });
    }

    const updated = await this.prisma.employerInterview.update({
      where: { id: interview.id },
      data: { feedbackRequestedAt: new Date() },
      include: {
        application: {
          include: {
            candidate: { include: { skills: true } },
            job: { select: { id: true, title: true } },
          },
        },
      },
    });

    const company = employer.companyName?.trim() || 'the employer';
    const jobTitle = interview.application.job.title;
    const portalBase = (this.config.get<string>('WEB_ORIGIN', 'http://localhost:3000') || '')
      .split(',')[0]
      .trim();
    const feedbackUrl = `${portalBase}/interviews/scheduled/${interview.id}`;
    const candidate = interview.application.candidate;
    const firstName = candidate.firstName?.trim() || 'there';

    await this.notifications.create({
      userId: candidate.userId,
      title: 'Share interview feedback',
      body: `${company} asked for your feedback on the ${jobTitle} interview.`,
      type: 'INTERVIEW_FEEDBACK_REQUEST',
      link: `/interviews/scheduled/${interview.id}`,
    });

    const phone = this.whatsappWebhook.resolveNotifyPhone(candidate);
    if (phone) {
      try {
        await this.whatsapp.sendText({
          to: phone,
          candidateId: candidate.id,
          interviewId: interview.id,
          messageType: 'interview_feedback_request',
          body: `Hi ${firstName}, ${company} would like your feedback on the ${jobTitle} interview.\n\nShare feedback: ${feedbackUrl}`,
        });
      } catch {
        // Notification already created.
      }
    }

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
    meetingUrl?: string | null;
    status: EmployerInterviewStatus;
    notes: string | null;
    confirmedAt: Date | null;
    createdAt: Date;
    candidateFeedbackRating?: number | null;
    candidateFeedbackText?: string | null;
    candidateFeedbackAt?: Date | null;
    feedbackRequestedAt?: Date | null;
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
    const preferredRescheduleAt = parsePreferredReschedule(row.notes);
    return {
      id: row.id,
      applicationId: row.applicationId,
      jobId: row.jobId,
      candidateId: row.candidateId,
      scheduledAt: row.scheduledAt.toISOString(),
      durationMin: row.durationMin,
      mode: row.mode,
      location: row.location,
      meetingUrl: row.meetingUrl || null,
      status: row.status,
      notes: stripRescheduleMarkers(row.notes) || null,
      preferredRescheduleAt: preferredRescheduleAt?.toISOString() || null,
      confirmedAt: row.confirmedAt?.toISOString() || null,
      createdAt: row.createdAt.toISOString(),
      applicationStatus: row.application.status,
      candidateFeedback:
        row.candidateFeedbackAt && row.candidateFeedbackRating
          ? {
              rating: row.candidateFeedbackRating,
              text: row.candidateFeedbackText || null,
              submittedAt: row.candidateFeedbackAt.toISOString(),
            }
          : null,
      feedbackRequestedAt: row.feedbackRequestedAt?.toISOString() || null,
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
    logoUrl?: string | null;
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
      logoUrl: employer.logoUrl || null,
      verificationStatus,
      verified: employer.verified || verificationStatus === 'VERIFIED',
    };
  }

  private scoreApplicationMatch(candidate: MatchCandidateRow, job: MatchJobRow) {
    return scoreApplicationMatchImpl(this.intelligence, candidate, job);
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

type MatchCandidateRow = {
  city: string | null;
  careerInterests: string;
  hasExperience: string | null;
  highestEducation?: string | null;
  totalExperienceYears?: number | null;
  totalExperienceMonths?: number | null;
  certifications?: string | null;
  skills: Array<{ name: string }>;
  education?: Array<{ id: string }>;
  resumes?: Array<{ id: string; score?: number | null }>;
};

type MatchJobRow = {
  city: string;
  category: string;
  requiredSkills: string;
  preferredSkills?: string;
  experience: string | null;
  title?: string;
};

/** Shared ATS scorer for employer application + passport views (PDF hybrid model). */
function scoreApplicationMatchImpl(
  intelligence: IntelligenceService,
  candidate: MatchCandidateRow,
  job: MatchJobRow,
) {
  return intelligence.match(
    {
      city: candidate.city,
      careerInterests: parseList(candidate.careerInterests),
      skills: candidate.skills.map((item) => item.name),
      hasExperience: candidate.hasExperience,
      experienceYears:
        (candidate.totalExperienceYears || 0) + (candidate.totalExperienceMonths || 0) / 12,
      hasEducation: Boolean(
        candidate.highestEducation?.trim() || (candidate.education?.length || 0) > 0,
      ),
      highestEducation: candidate.highestEducation || null,
      educationCount: candidate.education?.length || 0,
      hasResume: (candidate.resumes?.length || 0) > 0,
      resumeScore: candidate.resumes?.[0]?.score ?? null,
      certifications: parseList(candidate.certifications || '[]'),
    },
    {
      city: job.city,
      category: job.category,
      requiredSkills: parseList(job.requiredSkills),
      preferredSkills: parseList(job.preferredSkills || '[]'),
      experience: job.experience,
      title: job.title,
    },
  );
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

function extractNoticePeriodAnswer(
  rawAnswers: string | null | undefined,
  questionMap: Map<string, string>,
) {
  const answers = parseScreeningAnswers(rawAnswers);
  for (const item of answers) {
    const prompt = (questionMap.get(item.questionId) || '').toLowerCase();
    const answer = item.answer.trim();
    if (!answer) continue;
    if (prompt.includes('notice') || /notice|immediate|joining/i.test(answer)) {
      return answer;
    }
  }
  return null;
}

function resolveCandidateAvailability(input: {
  stillInCollege: boolean;
  currentlyEmployed: boolean;
  noticeAnswer: string | null;
  experienceYears: number;
}): { label: string; tone: 'immediate' | 'notice' | 'neutral' } {
  if (input.noticeAnswer) {
    const raw = input.noticeAnswer.trim();
    const lower = raw.toLowerCase();
    if (/immediate|asap|0\s*(day|week|month)?|serving notice|available now/.test(lower)) {
      return { label: formatAvailabilityLabel(raw, 'Immediate'), tone: 'immediate' };
    }
    return { label: formatAvailabilityLabel(raw, raw), tone: 'notice' };
  }
  if (input.stillInCollege) return { label: 'Student', tone: 'neutral' };
  if (input.currentlyEmployed) return { label: 'Employed', tone: 'notice' };
  if (input.experienceYears <= 0) return { label: 'Immediate', tone: 'immediate' };
  return { label: 'Immediate', tone: 'immediate' };
}

function formatAvailabilityLabel(raw: string, fallback: string) {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return fallback;
  if (cleaned.length > 18) return `${cleaned.slice(0, 16)}…`;
  return cleaned;
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
