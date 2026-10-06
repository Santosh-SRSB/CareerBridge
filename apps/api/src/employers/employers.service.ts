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
  CANDIDATE_SEARCH_MAX_SKILLS,
  type CandidateSearchSort,
  ErrorCode as SharedError,
  activeJobLimitMessage,
  activeJobLimitReached,
  candidateViewLimitMessage,
  designationError,
  emailError,
  experienceFilterRange,
  lookupCityCentroid,
  meetsEducationFilter,
  normalizeHttpUrl,
  COMPANY_ABOUT_MAX,
  isCompanySize,
  jobSalaryRequiredError,
  parseLinkedinUrl,
} from '@careerbridge/shared';
import { GstService } from '../gst/gst.service';
import { normalizeGstin, validateGstinFormat } from '../gst/gst.validator';
import {
  ACTIVE_INTERVIEW_STATUSES,
  applicationTransitionError,
  assertKycComplete,
  DEFAULT_INTERVIEW_TIMEZONE,
  formatAvailabilityWindow,
  hasCompletedKyc,
  intervalsOverlap,
  interviewActionCheck,
  parseCompanyWebsite,
  parseInterviewInstant,
  parseNotifyPrefs,
  salaryRangeError,
  stripNotifyMarkers,
  withEffectiveVerification,
  withNotifyPrefs,
} from './employer-policy';
import {
  LOGO_VALIDATION_MESSAGES,
  canonicalCompanyLogoPaths,
  companyLogoPath,
  companyLogoUrl,
  readableCompanyLogoUrl,
  validateCompanyLogo,
} from './company-logo.util';
import { PrismaService } from '../prisma/prisma.service';
import { USABLE_RESUME_WHERE } from '../resumes/resume-eligibility';
import { IntelligenceService } from '../intelligence/intelligence.service';
import { MatchingService } from '../matching/matching.service';
import { InterviewWhatsAppService } from '../whatsapp/interview-whatsapp.service';
import { consentedWhatsAppNumber } from '../whatsapp/interview-lifecycle.util';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { WhatsAppWebhookService } from '../whatsapp/whatsapp.webhook.service';
import { NotificationsService } from '../notifications/notifications.service';
import { renderDefaultNotification, type NotificationTemplateKey } from '../notifications/notification-templates';
import { CatalogService } from '../catalog/catalog.service';
import { ConfigService } from '@nestjs/config';
import { ResumesService } from '../resumes/resumes.service';
import { EmailService } from '../auth/email.service';
import { JobsService } from '../jobs/jobs.service';
import { StorageService } from '../common/storage/storage.service';
import { candidateInterviewUrl, interviewMeetingUrl } from '../common/web/public-web-url';
import { TestimonialsService } from '../testimonials/testimonials.service';
import { employerPlanUsage, usagePeriod } from './employer-plan';

const APPLICATION_STATUS_NOTICE: Partial<Record<ApplicationStatus, NotificationTemplateKey>> = {
  SHORTLISTED: 'APPLICATION_SHORTLISTED',
  ON_HOLD: 'APPLICATION_ON_HOLD',
  SELECTED: 'APPLICATION_SELECTED',
  HIRED: 'APPLICATION_SELECTED',
  REJECTED: 'APPLICATION_REJECTED',
};

const ACTION_STATUS: Record<string, ApplicationStatus> = {
  REVIEW: 'UNDER_REVIEW',
  SHORTLIST: 'SHORTLISTED',
  INTERVIEW: 'INTERVIEW',
  HOLD: 'ON_HOLD',
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
    private readonly testimonials: TestimonialsService,
    private readonly gst: GstService,
    private readonly catalog: CatalogService,
  ) {}

  private async assertJobCategory(category: string, existingCategory?: string | null) {
    const value = category?.trim();
    if (value && value === existingCategory) return;
    if (!value || !(await this.catalog.isActiveValue('JOB_CATEGORY', value))) {
      throw new BadRequestException({
        code: SharedError.VALIDATION_ERROR,
        message: 'Select a valid job category.',
      });
    }
  }

  async me(userId: string) {
    return this.profile(await this.requireEmployer(userId));
  }

  async uploadLogoFile(
    userId: string,
    file: { buffer: Buffer; mimetype: string; size: number; originalname?: string },
  ) {
    const validation = await validateCompanyLogo(file);
    if (!validation.ok) {
      throw new BadRequestException({
        code: SharedError.VALIDATION_ERROR,
        message: LOGO_VALIDATION_MESSAGES[validation.reason],
      });
    }

    const employer = await this.requireEmployer(userId);
    const contentType = validation.contentType;
    let storedUrl: string;

    if (this.storage.isConfigured()) {
      try {
        const path = companyLogoPath(employer.id, validation.type);
        await this.storage.uploadFile(path, file.buffer, {
          contentType,
          isPublic: false,
          metadata: { employerId: employer.id, source: 'company-logo' },
        });
        storedUrl = companyLogoUrl(this.storage.getBucketName(), employer.id, validation.type);
        for (const stale of canonicalCompanyLogoPaths(employer.id).filter((p) => p !== path)) {
          await this.storage.deleteFile(stale);
        }
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
    return this.profile(updated);
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
      companySize?: string;
      about?: string;
      linkedinUrl?: string;
    },
  ) {
    const employer = await this.requireEmployer(userId);
    const invalid = (message: string) =>
      new BadRequestException({ code: SharedError.VALIDATION_ERROR, message });
    let website: string | null | undefined;
    if (dto.website !== undefined) {
      const parsed = parseCompanyWebsite(dto.website);
      if (!parsed.ok) throw invalid(parsed.message);
      website = parsed.value;
    }
    if (dto.industry !== undefined && !dto.industry.trim()) throw invalid('Please select an industry.');
    const companySize = dto.companySize?.trim();
    if (companySize !== undefined && !isCompanySize(companySize)) throw invalid('Please select company size.');
    const about = dto.about?.trim();
    if (about !== undefined && about.length > COMPANY_ABOUT_MAX) {
      throw invalid(`About the company can be up to ${COMPANY_ABOUT_MAX} characters.`);
    }
    let linkedinUrl: string | null | undefined;
    if (dto.linkedinUrl !== undefined) {
      const parsed = parseLinkedinUrl(dto.linkedinUrl);
      if (!parsed.ok) throw invalid(parsed.message);
      linkedinUrl = parsed.value;
    }
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
        ...(companySize !== undefined ? { companySize } : {}),
        ...(about !== undefined ? { about: about || null } : {}),
        ...(linkedinUrl !== undefined ? { linkedinUrl } : {}),
      },
    });
    return this.profile(updated);
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
    const gst = normalizeGstin(dto.gstNumber || '');
    const cin = (dto.cin || '').trim().toUpperCase();
    const pan = (dto.panNumber || '').trim().toUpperCase();
    if (![gst, pan, (dto.website || '').trim()].every((value) => value.length > 0)) {
      throw new HttpException(
        { code: SharedError.VALIDATION_ERROR, message: 'GSTIN, PAN, and website are required.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const formatError = validateGstinFormat(gst);
    if (formatError) {
      throw new BadRequestException({ code: SharedError.VALIDATION_ERROR, message: formatError });
    }
    const site = parseCompanyWebsite(dto.website);
    if (!site.ok || !site.value) {
      throw new BadRequestException({
        code: SharedError.VALIDATION_ERROR,
        message: site.ok ? 'GSTIN, PAN, and website are required.' : site.message,
      });
    }

    const verification = await this.gst.verify(gst, userId);
    if (verification.status === 'UNKNOWN') {
      throw new HttpException(
        { code: SharedError.INTERNAL_ERROR, message: verification.message, status: 'UNKNOWN', verified: false },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (!verification.verified || verification.status !== 'ACTIVE') {
      throw new BadRequestException({
        code: SharedError.BUSINESS_RULE_VIOLATION,
        message: verification.message || 'This GSTIN is not active. Enter an active GSTIN to continue.',
        status: verification.status,
        verified: false,
      });
    }

    const duplicate = await this.prisma.employer.findFirst({
      where: { gstNumber: { equals: gst, mode: 'insensitive' }, id: { not: employer.id } },
      select: { id: true },
    });
    if (duplicate) {
      throw new HttpException(
        {
          code: SharedError.DUPLICATE_RESOURCE,
          message: 'This GSTIN is already registered to another employer account.',
        },
        HttpStatus.CONFLICT,
      );
    }

    // Only a live lookup may rename the company; client-supplied and mock trade names are not proof.
    const verifiedTradeName = verification.mock ? '' : (verification.trademark || '').trim().replace(/\s+/g, ' ');
    const gstChanged = (employer.gstNumber || '').trim().toUpperCase() !== gst;
    const current = employer.verificationStatus;
    const nextStatus =
      current === 'UNVERIFIED' || (gstChanged && ['PENDING', 'VERIFIED', 'REJECTED'].includes(current))
        ? 'KYC_COMPLETE'
        : current;

    const updated = await this.prisma.employer.update({
      where: { id: employer.id },
      data: {
        gstNumber: gst,
        cin: cin || null,
        website: site.value,
        panNumber: pan,
        ...(verifiedTradeName.length >= 2 ? { companyName: verifiedTradeName } : {}),
        verificationStatus: nextStatus as typeof employer.verificationStatus,
        verified: nextStatus === 'VERIFIED',
      },
    });
    return {
      ...(await this.profile(updated)),
      gstVerification: { status: verification.status, provider: verification.provider, mock: verification.mock },
    };
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
        // Resubmitting details never downgrades an already verified employer.
        verificationStatus: employer.verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'PENDING',
        verified: employer.verificationStatus === 'VERIFIED',
      },
    });
    return this.profile(updated);
  }

  async dashboard(userId: string) {
    const employer = await this.requireEmployer(userId);
    const jobs = await this.prisma.job.findMany({
      where: { employerId: employer.id },
      select: { id: true, status: true, title: true, viewCount: true, _count: { select: { applications: true } } },
    });
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
            status: { in: [...ACTIVE_INTERVIEW_STATUSES] },
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
      jobPerformance: jobs
        .filter((item) => item.status === 'PUBLISHED')
        .map((item) => ({
          jobId: item.id,
          title: item.title,
          applications: item._count.applications,
          views: item.viewCount,
        }))
        .sort((a, b) => b.applications - a.applications || b.views - a.views)
        .slice(0, 10),
      recent: recent.map((item) => ({
        candidateName: [item.candidate.firstName, item.candidate.lastName].filter(Boolean).join(' ') || 'Candidate',
        candidateId: item.candidate.id,
        jobTitle: item.job.title,
        status: item.status,
        applicationId: item.id,
        jobId: item.job.id,
        appliedAt: item.createdAt.toISOString(),
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
    assertKycComplete(employer, 'Complete company KYC before posting jobs.');
    if (dto.publish) this.assertPublishSalary(dto.salaryMin, dto.salaryMax);
    this.assertSalaryRange(dto.salaryMin, dto.salaryMax);
    await this.assertJobCategory(dto.category);
    const screeningQuestions = normalizeScreeningQuestions(dto.screeningQuestions);
    const city = dto.city.trim();
    const geo = lookupCityCentroid(city);
    if (dto.publish) await this.assertActiveJobAllowance(employer.id);
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
        status: dto.publish ? 'PENDING_REVIEW' : 'DRAFT',
        publishedAt: null,
      },
    });
    if (dto.publish) {
      await this.matching.ensureJobPostingPayment(employer.id, job.id, job.title);
      return { ...job, reviewRequired: true };
    }
    return job;
  }

  async job(userId: string, id: string) {
    return this.requireJob(userId, id);
  }

  async updateJob(userId: string, id: string, dto: CreateJobInput) {
    const existing = await this.requireJob(userId, id);
    if (existing.status === 'PUBLISHED' || existing.status === 'PENDING_REVIEW') {
      this.assertPublishSalary(dto.salaryMin, dto.salaryMax);
    }
    this.assertSalaryRange(dto.salaryMin, dto.salaryMax);
    await this.assertJobCategory(dto.category, existing.category);
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
      return { ...updated, matching: await this.recomputeMatchesAfterPublish(id) };
    }
    return updated;
  }

  /**
   * Employer publish requests: a job that has never been approved goes to PENDING_REVIEW and only an admin
   * can make it live. Resuming a paused job that was already approved goes straight back to PUBLISHED.
   */
  async setStatus(userId: string, id: string, status: JobStatus) {
    const job = await this.requireJob(userId, id);
    const employer = await this.requireEmployer(userId);
    if (status === 'PENDING_REVIEW') status = 'PUBLISHED';
    if (status === 'PUBLISHED') {
      if (job.status === 'PENDING_REVIEW') return { ...job, reviewRequired: true };
      assertKycComplete(employer, 'Complete company KYC before publishing jobs.');
      if (!job.publishedAt) this.assertPublishSalary(job.salaryMin, job.salaryMax);
      if (job.status !== 'PUBLISHED') await this.assertActiveJobAllowance(employer.id);
      await this.matching.ensureJobPostingPayment(employer.id, job.id, job.title);
      if (!job.publishedAt && job.status !== 'PUBLISHED') {
        const pending = await this.prisma.job.update({ where: { id }, data: { status: 'PENDING_REVIEW' } });
        return { ...pending, reviewRequired: true };
      }
    }
    const updated = await this.prisma.job.update({
      where: { id },
      data: { status, publishedAt: status === 'PUBLISHED' ? new Date() : undefined },
    });
    if (status !== 'PUBLISHED') return updated;
    const followUps = await this.runPublishFollowUps(job.id);
    await this.maybeFirstJobPublishedPrompt(userId, employer.id);
    return { ...updated, ...followUps };
  }

  /** Called after an admin approves a PENDING_REVIEW job: the job is live, so matching and alerts run now. */
  async completeJobApproval(jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, include: { employer: true } });
    if (!job || job.status !== 'PUBLISHED') return null;
    const followUps = await this.runPublishFollowUps(job.id);
    await this.maybeFirstJobPublishedPrompt(job.employer.userId, job.employerId);
    await this.notifications
      .create({
        userId: job.employer.userId,
        ...renderDefaultNotification('JOB_APPROVED', { jobTitle: job.title }),
        templateKey: 'JOB_APPROVED',
        templateVars: { jobTitle: job.title },
        type: 'JOB',
        link: `/employer/jobs/${job.id}`,
      })
      .catch(() => undefined);
    return followUps;
  }

  async notifyJobRejected(jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, include: { employer: true } });
    if (!job) return;
    await this.notifications
      .create({
        userId: job.employer.userId,
        ...renderDefaultNotification('JOB_REJECTED', { jobTitle: job.title }),
        templateKey: 'JOB_REJECTED',
        templateVars: { jobTitle: job.title },
        type: 'JOB',
        link: `/employer/jobs/${job.id}`,
      })
      .catch(() => undefined);
  }

  async planUsage(userId: string) {
    const employer = await this.requireEmployer(userId);
    return employerPlanUsage(this.prisma, employer.id);
  }

  /**
   * Each distinct candidate profile opened in a month uses one view credit. Profiles of candidates who
   * applied to the employer's jobs are always viewable, but still counted in usage.
   */
  private async recordCandidateView(employerId: string, candidateId: string, jobId: string | null, applied: boolean) {
    const period = usagePeriod();
    const existing = await this.prisma.employerCandidateView.findUnique({
      where: { employerId_candidateId_period: { employerId, candidateId, period } },
    });
    if (existing) return;
    if (!applied) {
      const usage = await employerPlanUsage(this.prisma, employerId);
      if (usage.candidateViewCredits > 0 && usage.candidateViews >= usage.candidateViewCredits) {
        throw new ForbiddenException({
          code: SharedError.BUSINESS_RULE_VIOLATION,
          message: candidateViewLimitMessage(usage.candidateViewCredits),
        });
      }
    }
    await this.prisma.employerCandidateView
      .create({ data: { employerId, candidateId, jobId, period } })
      .catch((err: unknown) => {
        // A concurrent request may have inserted the same (employer, candidate, month) row.
        if (!(err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2002')) throw err;
      });
  }

  private async assertActiveJobAllowance(employerId: string) {
    const usage = await employerPlanUsage(this.prisma, employerId);
    if (activeJobLimitReached(usage)) {
      throw new ForbiddenException({
        code: SharedError.BUSINESS_RULE_VIOLATION,
        message: activeJobLimitMessage(usage.activeJobLimit),
      });
    }
  }

  /**
   * Matching and candidate alerts run after the publish is persisted. Their failure must not report
   * the publish itself as failed; the outcome is returned so the client can show the real state.
   */
  private async runPublishFollowUps(jobId: string) {
    const matching = await this.recomputeMatchesAfterPublish(jobId);
    await this.jobsService.notifyCandidatesForPublishedJob(jobId).catch((err: unknown) => {
      this.logger.warn(
        `Candidate alerts failed for published job ${jobId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
    return { matching };
  }

  private async recomputeMatchesAfterPublish(
    jobId: string,
  ): Promise<{ status: 'COMPUTED' | 'FAILED'; message?: string }> {
    try {
      await this.matching.recomputeMatchesForJob(jobId);
      return { status: 'COMPUTED' };
    } catch (err) {
      this.logger.error(
        `ATS match recompute failed for job ${jobId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        status: 'FAILED',
        message:
          'The job is saved, but candidate matching could not be computed yet. Open Matches or use Recompute to retry.',
      };
    }
  }

  private assertPublishSalary(salaryMin?: number | null, salaryMax?: number | null) {
    const error = jobSalaryRequiredError(salaryMin, salaryMax);
    if (error) {
      throw new BadRequestException({ code: SharedError.VALIDATION_ERROR, message: error });
    }
  }

  private assertSalaryRange(salaryMin?: number, salaryMax?: number) {
    const error = salaryRangeError(salaryMin, salaryMax);
    if (error) {
      throw new BadRequestException({ code: SharedError.VALIDATION_ERROR, message: error });
    }
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
            resumes: { where: USABLE_RESUME_WHERE, orderBy: { updatedAt: 'desc' }, take: 1, select: { id: true, score: true } },
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
      employerNote: row.employerNote,
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
            resumes: { where: USABLE_RESUME_WHERE, orderBy: { updatedAt: 'desc' }, take: 1, select: { id: true, score: true } },
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
      employerNote: row.employerNote,
      match: this.scoreApplicationMatch(row.candidate, row.job),
    }));
  }

  async searchCandidates(
    userId: string,
    query: {
      q?: string;
      city?: string;
      skill?: string;
      skills?: string[];
      experienceMin?: number;
      experience?: string;
      language?: string;
      education?: string;
      availability?: string;
      sort?: CandidateSearchSort;
      page?: number;
      pageSize?: number;
      jobId?: string;
    },
  ) {
    const employer = await this.requireEmployer(userId);
    assertKycComplete(employer, 'Complete company KYC before searching candidates.');

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

    const skillFilters = Array.from(
      new Set(
        [...(query.skills || []), ...(query.skill ? [query.skill] : [])]
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    if (skillFilters.length > CANDIDATE_SEARCH_MAX_SKILLS) {
      throw new BadRequestException({
        code: SharedError.VALIDATION_ERROR,
        message: `You can filter by up to ${CANDIDATE_SEARCH_MAX_SKILLS} skills.`,
      });
    }
    const cityFilter = query.city?.trim();
    const q = query.q?.trim();
    const experienceMin = query.experienceMin && query.experienceMin > 0 ? query.experienceMin : 0;
    const experienceBand = experienceFilterRange(query.experience);
    const languageFilter = query.language?.trim().toLowerCase();
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(Math.max(1, query.pageSize || 20), 50);

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
        total: 0,
        page,
        pageSize,
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
        const candidateYears =
          (candidate.totalExperienceYears || 0) + (candidate.totalExperienceMonths || 0) / 12;
        if (experienceMin > 0 && candidateYears + 1e-9 < experienceMin) return null;
        if (experienceBand) {
          const inBand =
            experienceBand.max === experienceBand.min
              ? candidateYears <= experienceBand.max
              : candidateYears >= experienceBand.min && candidateYears <= experienceBand.max;
          if (!inBand) return null;
        }
        if (
          skillFilters.length &&
          !skillFilters.every((wanted) =>
            candidate.skills.some((item) => item.name.toLowerCase().includes(wanted)),
          )
        ) {
          return null;
        }
        if (
          languageFilter &&
          !String(candidate.preferredLanguage || '')
            .toLowerCase()
            .split(/[,/|]/)
            .some((item) => item.trim() && (item.includes(languageFilter) || languageFilter.includes(item.trim())))
        ) {
          return null;
        }
        if (!meetsEducationFilter(candidate.highestEducation, query.education)) return null;
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
        const currentlyEmployed = candidate.experiences.some((item) => item.stillInCompany);
        const application = candidate.applications[0] || null;
        const noticeAnswer =
          (candidate as { noticePeriod?: string | null }).noticePeriod?.trim() ||
          extractNoticePeriodAnswer(application?.screeningAnswersJson, questionMap);
        const availability = resolveCandidateAvailability({
          stillInCollege: candidate.stillInCollege,
          currentlyEmployed,
          noticeAnswer,
          experienceYears: candidate.totalExperienceYears || 0,
        });
        if (query.availability) {
          const kind =
            availability.label === 'Student' ? 'student' : availability.tone === 'immediate' ? 'immediate' : 'notice';
          if (kind !== query.availability) return null;
        }
        return { match, candidate, candidateYears, currentlyEmployed, application, availability };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    if (query.sort === 'recent') {
      filtered.sort((a, b) => b.candidate.updatedAt.getTime() - a.candidate.updatedAt.getTime());
    } else if (query.sort === 'experience') {
      filtered.sort((a, b) => b.candidateYears - a.candidateYears || b.match.totalScore - a.match.totalScore);
    }
    const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
    const talentShortlisted = new Set(
      pageRows.length
        ? (
            await this.prisma.employerTalentShortlist.findMany({
              where: {
                employerId: employer.id,
                jobId: job.id,
                candidateId: { in: pageRows.map((row) => row.candidate.id) },
              },
              select: { candidateId: true },
            })
          ).map((row) => row.candidateId)
        : [],
    );

    return {
      jobId,
      unlocked: true,
      unlockLimit,
      totalMatched,
      total: filtered.length,
      page,
      pageSize,
      candidates: pageRows.map(({ match, candidate, currentlyEmployed, application, availability }) => {
        const latestRole = candidate.experiences[0];
        const skillNames = candidate.skills.map((item) => item.name);
        const matchScore = Math.round(match.totalScore);
        return {
          id: candidate.id,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          city: candidate.city,
          state: candidate.state,
          highestEducation: candidate.highestEducation,
          preferredLanguage: candidate.preferredLanguage,
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
          talentShortlisted: talentShortlisted.has(candidate.id),
        };
      }),
    };
  }

  /** Private per-job shortlist for matched candidates who have not applied (applicants use the application status). */
  async setTalentShortlist(
    userId: string,
    candidateId: string,
    jobId: string,
    shortlisted: boolean,
    note?: string,
  ) {
    const employer = await this.requireEmployer(userId);
    assertKycComplete(employer, 'Complete company KYC before shortlisting candidates.');
    const job = await this.requireJob(userId, jobId);
    await this.matching.assertCandidateVisibleForJob(userId, jobId, candidateId);

    const key = { employerId: employer.id, candidateId, jobId: job.id };
    if (shortlisted) {
      const employerNote = note?.trim().slice(0, 500) || null;
      await this.prisma.employerTalentShortlist.upsert({
        where: { employerId_candidateId_jobId: key },
        create: { ...key, note: employerNote },
        update: employerNote ? { note: employerNote } : {},
      });
    } else {
      await this.prisma.employerTalentShortlist.deleteMany({ where: key });
    }
    return { ok: true as const, candidateId, jobId: job.id, shortlisted };
  }

  async candidateView(userId: string, candidateId: string, jobId?: string) {
    const employer = await this.requireEmployer(userId);
    const appliedInclude = { job: { select: { id: true, title: true } } } as const;
    const appliedForJob = jobId
      ? await this.prisma.application.findFirst({
          where: { candidateId, jobId, job: { employerId: employer.id } },
          include: appliedInclude,
        })
      : null;
    const applied =
      appliedForJob ||
      (await this.prisma.application.findFirst({
        where: { candidateId, job: { employerId: employer.id } },
        include: appliedInclude,
        orderBy: { createdAt: 'desc' },
      }));

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

    if (!hasCompletedKyc(employer) && !applied) {
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
    await this.recordCandidateView(employer.id, candidateId, resolvedJobId || null, Boolean(applied));

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
    const requestedJobId = jobId?.trim() || undefined;
    // The application must link this candidate to this employer, and to the requested job when one is given.
    const applied = await this.prisma.application.findFirst({
      where: {
        candidateId,
        job: { employerId: employer.id },
        ...(requestedJobId ? { jobId: requestedJobId } : {}),
      },
      include: { candidate: { select: { userId: true } } },
      orderBy: { createdAt: 'desc' },
    });
    if (!applied) {
      throw new ForbiddenException({
        code: SharedError.BUSINESS_RULE_VIOLATION,
        message: requestedJobId
          ? 'This candidate has not applied to the selected job.'
          : 'Resume is available only for candidates who applied to your jobs.',
      });
    }

    const resumeId =
      applied.resumeId ||
      (
        await this.prisma.resume.findFirst({
          where: { candidateId, ...USABLE_RESUME_WHERE },
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
    const transitionError = applicationTransitionError(application.status, 'INTERVIEW');
    if (transitionError) {
      throw new HttpException(
        { code: SharedError.BUSINESS_RULE_VIOLATION, message: transitionError },
        HttpStatus.CONFLICT,
      );
    }

    const scheduledAt = parseInterviewInstant(dto.scheduledAt);
    if (!scheduledAt || scheduledAt.getTime() < Date.now() - 60_000) {
      throw new HttpException(
        { code: SharedError.VALIDATION_ERROR, message: 'Choose a valid future interview time.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const mode = dto.mode?.trim().toUpperCase() || 'VIDEO';
    const durationMin = dto.durationMin && dto.durationMin > 0 ? dto.durationMin : 30;
    const scheduledEnd = new Date(scheduledAt.getTime() + durationMin * 60_000);
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
    const prefs = { whatsapp: dto.notifyWhatsApp !== false, email: dto.notifyEmail !== false };
    const notes = withNotifyPrefs(dto.notes?.trim(), prefs);
    const waConsented = Boolean(consentedWhatsAppNumber(application.candidate));

    const interview = await this.prisma.$transaction(async (tx) => {
      // Serialise scheduling per candidate so concurrent requests cannot both pass the checks below.
      // $executeRaw: pg_advisory_xact_lock returns void, which $queryRaw cannot deserialize.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`employer-interview:${application.candidateId}`}))`;
      const open = await tx.employerInterview.findMany({
        where: {
          employerId: employer.id,
          candidateId: application.candidateId,
          status: { in: [...ACTIVE_INTERVIEW_STATUSES] },
        },
        select: { id: true, applicationId: true, scheduledAt: true, scheduledEnd: true, durationMin: true },
      });
      if (open.some((row) => row.applicationId === application.id)) {
        throw new HttpException(
          {
            code: SharedError.DUPLICATE_RESOURCE,
            message: 'An interview is already scheduled for this application. Reschedule or cancel it instead.',
          },
          HttpStatus.CONFLICT,
        );
      }
      const clash = open.find((row) =>
        intervalsOverlap(
          scheduledAt,
          scheduledEnd,
          row.scheduledAt,
          row.scheduledEnd || new Date(row.scheduledAt.getTime() + row.durationMin * 60_000),
        ),
      );
      if (clash) {
        throw new HttpException(
          {
            code: SharedError.BUSINESS_RULE_VIOLATION,
            message: 'This candidate already has an interview with you that overlaps this time. Choose another slot.',
          },
          HttpStatus.CONFLICT,
        );
      }
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
          candidateNotes: dto.notes?.trim() || null,
          status: 'SCHEDULED',
          whatsappStatus: !prefs.whatsapp
            ? 'SKIPPED_BY_EMPLOYER'
            : waConsented
              ? 'QUEUED'
              : 'SKIPPED_NO_PHONE_OR_OPT_IN',
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

    const joinUrl = interviewMeetingUrl(this.config, { id: interview.id, location });

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
    let whatsappDelivery: 'QUEUED' | 'FAILED' | 'SKIPPED_NO_OPT_IN' | 'SKIPPED_BY_EMPLOYER' = 'SKIPPED_BY_EMPLOYER';
    if (prefs.whatsapp && !waConsented) {
      whatsappDelivery = 'SKIPPED_NO_OPT_IN';
    } else if (prefs.whatsapp) {
      whatsappDelivery = await this.interviewWhatsApp
        .enqueueInvitation(withMeeting.id)
        .then(() => 'QUEUED' as const)
        .catch((err: unknown) => {
          this.logger.error(
            `WhatsApp invitation enqueue failed for interview ${withMeeting.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
          return 'FAILED' as const;
        });
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

    const inApp = await this.notifications
      .create({
        userId: application.candidate.userId,
        ...renderDefaultNotification('INTERVIEW_SCHEDULED', {
          company: employer.companyName || 'An employer',
          jobTitle: application.job.title,
          when: whenLabel,
        }),
        templateKey: 'INTERVIEW_SCHEDULED',
        templateVars: { company: employer.companyName || 'An employer', jobTitle: application.job.title, when: whenLabel },
        type: 'INTERVIEW',
        link: `/interviews/scheduled/${withMeeting.id}`,
      })
      .then(() => 'CREATED' as const)
      .catch((err: unknown) => {
        this.logger.error(
          `In-app interview notification failed for interview ${withMeeting.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
        return 'FAILED' as const;
      });

    const email = await this.deliverEmail(prefs.email, candidateEmail, () =>
      this.email.sendEmployerInterviewScheduled({
        to: candidateEmail,
        candidateName: application.candidate.firstName || candidateName,
        companyName: employer.companyName || 'Employer',
        jobTitle: application.job.title,
        whenLabel,
        mode,
        portalUrl: candidateInterviewUrl(this.config, withMeeting.id),
        meetingUrl: joinUrl,
        location,
      }),
    );

    return { ...this.toInterview(withMeeting), delivery: { inApp, whatsapp: whatsappDelivery, email } };
  }

  /** Email outcome as it really happened; never reports SENT unless SMTP accepted the message. */
  private async deliverEmail(
    enabled: boolean,
    to: string | null | undefined,
    send: () => Promise<boolean>,
  ): Promise<'SENT' | 'FAILED' | 'NOT_CONFIGURED' | 'NO_EMAIL' | 'SKIPPED_BY_EMPLOYER'> {
    if (!enabled) return 'SKIPPED_BY_EMPLOYER';
    if (!to) return 'NO_EMAIL';
    if (!this.email.isConfigured()) return 'NOT_CONFIGURED';
    const sent = await send().catch(() => false);
    return sent ? 'SENT' : 'FAILED';
  }

  async updateInterviewStatus(
    userId: string,
    interviewId: string,
    action: 'confirm' | 'reschedule' | 'complete' | 'cancel' | 'notes',
    payload?: { scheduledAt?: string; notes?: string; meetingUrl?: string },
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

    const check = interviewActionCheck(interview.status, action);
    if (check === 'noop') return this.toInterview(interview);
    if (check) {
      throw new HttpException(
        { code: SharedError.BUSINESS_RULE_VIOLATION, message: check },
        HttpStatus.CONFLICT,
      );
    }

    const prefs = parseNotifyPrefs(interview.notes);
    let status: EmployerInterviewStatus = interview.status;
    let scheduledAt = interview.scheduledAt;
    let confirmedAt = interview.confirmedAt;
    let notes = interview.notes;
    let location = interview.location;
    let notifyCandidate: 'approved' | 'rescheduled' | 'cancelled' | null = null;
    const cancelReason = payload?.notes?.trim() || null;

    if (action === 'notes') {
      const pendingReschedule = [
        interview.notes?.match(RESCHEDULE_PREF_RE)?.[0],
        interview.notes?.match(RESCHEDULE_REASON_RE)?.[0],
      ].filter(Boolean);
      notes = [(payload?.notes || '').trim(), ...pendingReschedule].filter(Boolean).join('\n') || null;
    } else if (action === 'confirm') {
      // Approve candidate reschedule request (preferred slot) or confirm pending interview.
      const preferred = parsePreferredReschedule(interview.notes);
      const next = payload?.scheduledAt ? parseInterviewInstant(payload.scheduledAt) : preferred;
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
      const next = payload?.scheduledAt ? parseInterviewInstant(payload.scheduledAt) : null;
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
      const newMeetingUrl = payload?.meetingUrl?.trim();
      if (newMeetingUrl) {
        const normalized = interview.mode === 'VIDEO' ? normalizeHttpUrl(newMeetingUrl) : null;
        if (!normalized) {
          throw new HttpException(
            {
              code: SharedError.VALIDATION_ERROR,
              message: 'Enter a valid meeting link (e.g. Google Meet or Zoom URL) for a video interview.',
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        location = normalized;
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
      if (cancelReason) {
        notes = [interview.notes?.trim(), `Cancellation reason: ${cancelReason}`].filter(Boolean).join('\n');
      }
      notifyCandidate = 'cancelled';
    } else {
      throw new ForbiddenException({
        code: SharedError.BUSINESS_RULE_VIOLATION,
        message: 'This action is not allowed.',
      });
    }

    const meetingUrl = interviewMeetingUrl(this.config, { id: interview.id, location, meetingUrl: interview.meetingUrl });
    const scheduledEnd = new Date(scheduledAt.getTime() + interview.durationMin * 60_000);
    if (scheduledAt.getTime() !== interview.scheduledAt.getTime()) {
      await this.assertNoOverlappingInterview(employer.id, interview.candidateId, interview.id, scheduledAt, scheduledEnd);
    }
    notes = withNotifyPrefs(notes, prefs);

    const updated = await this.prisma.employerInterview.update({
      where: { id: interview.id },
      data: { status, scheduledAt, scheduledEnd, confirmedAt, notes, location, meetingUrl },
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

      if (notifyCandidate === 'cancelled') {
        const companyName = employer.companyName || 'The employer';
        const cancelVars = {
          company: companyName,
          jobTitle: updated.application.job.title,
          when: whenLabel,
          reason: cancelReason ? ` Reason: ${cancelReason.slice(0, 300)}` : '',
        };
        const inAppCancel = await this.notifications
          .create({
            userId: candidateUser.id,
            ...renderDefaultNotification('INTERVIEW_CANCELLED', cancelVars),
            templateKey: 'INTERVIEW_CANCELLED',
            templateVars: cancelVars,
            type: 'INTERVIEW',
            link: `/interviews/scheduled/${updated.id}`,
          })
          .then(() => 'CREATED' as const)
          .catch((err: unknown) => {
            this.logger.error(
              `Cancellation notification failed for interview ${updated.id}: ${err instanceof Error ? err.message : String(err)}`,
            );
            return 'FAILED' as const;
          });
        const emailCancel = await this.deliverEmail(prefs.email, candidateUser.email, () =>
          this.email.sendEmployerInterviewCancelled({
            to: candidateUser.email as string,
            candidateName,
            companyName,
            jobTitle: updated.application.job.title,
            whenLabel,
            reason: cancelReason,
          }),
        );
        return {
          ...this.toInterview(updated),
          delivery: { inApp: inAppCancel, email: emailCancel, whatsapp: 'NOT_SUPPORTED' as const },
        };
      }

      const rescheduleKey: NotificationTemplateKey =
        notifyCandidate === 'approved' ? 'INTERVIEW_RESCHEDULE_APPROVED' : 'INTERVIEW_RESCHEDULED';
      const rescheduleVars = {
        company: employer.companyName || 'Employer',
        jobTitle: updated.application.job.title,
      };
      const inApp = await this.notifications
        .create({
          userId: candidateUser.id,
          ...renderDefaultNotification(rescheduleKey, rescheduleVars),
          templateKey: rescheduleKey,
          templateVars: rescheduleVars,
          type: 'INTERVIEW',
          link: `/interviews/scheduled/${updated.id}`,
        })
        .then(() => 'CREATED' as const)
        .catch(() => 'FAILED' as const);

      const email = await this.deliverEmail(prefs.email, candidateUser.email, () =>
        this.email.sendEmployerInterviewRescheduleUpdate({
          to: candidateUser.email as string,
          candidateName,
          companyName: employer.companyName || 'Employer',
          jobTitle: updated.application.job.title,
          whenLabel,
          meetingUrl: notifyCandidate === 'approved' ? meetingUrl : null,
          portalUrl: candidateInterviewUrl(this.config, updated.id),
          approved: notifyCandidate === 'approved',
        }),
      );

      let whatsapp: 'SENT' | 'QUEUED' | 'FAILED' | 'SKIPPED_NO_OPT_IN' | 'SKIPPED_BY_EMPLOYER' = 'SKIPPED_BY_EMPLOYER';
      if (prefs.whatsapp && !consentedWhatsAppNumber(updated.application.candidate)) {
        whatsapp = 'SKIPPED_NO_OPT_IN';
      } else if (prefs.whatsapp && notifyCandidate === 'approved') {
        const sent = await this.interviewWhatsApp
          .sendConfirmationNow(updated.id)
          .catch(() => ({ ok: false as const, reason: 'error' }));
        whatsapp = sent.ok ? 'SENT' : 'reason' in sent && sent.reason === 'no_phone' ? 'SKIPPED_NO_OPT_IN' : 'FAILED';
      } else if (prefs.whatsapp) {
        whatsapp = await this.interviewWhatsApp
          .enqueueInvitation(updated.id, 'reschedule')
          .then(() => 'QUEUED' as const)
          .catch(() => 'FAILED' as const);
      }
      return { ...this.toInterview(updated), delivery: { inApp, whatsapp, email } };
    }

    return this.toInterview(updated);
  }

  private async assertNoOverlappingInterview(
    employerId: string,
    candidateId: string,
    excludeInterviewId: string,
    start: Date,
    end: Date,
  ) {
    const others = await this.prisma.employerInterview.findMany({
      where: {
        employerId,
        candidateId,
        id: { not: excludeInterviewId },
        status: { in: [...ACTIVE_INTERVIEW_STATUSES] },
      },
      select: { scheduledAt: true, scheduledEnd: true, durationMin: true },
    });
    const clash = others.some((row) =>
      intervalsOverlap(
        start,
        end,
        row.scheduledAt,
        row.scheduledEnd || new Date(row.scheduledAt.getTime() + row.durationMin * 60_000),
      ),
    );
    if (clash) {
      throw new HttpException(
        {
          code: SharedError.BUSINESS_RULE_VIOLATION,
          message: 'This candidate already has an interview with you that overlaps this time. Choose another slot.',
        },
        HttpStatus.CONFLICT,
      );
    }
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
    const feedbackUrl = candidateInterviewUrl(this.config, interview.id);
    const candidate = interview.application.candidate;
    const firstName = candidate.firstName?.trim() || 'there';

    await this.notifications.create({
      userId: candidate.userId,
      title: 'Share interview feedback',
      body: `${company} asked for your feedback on the ${jobTitle} interview.`,
      type: 'INTERVIEW_FEEDBACK_REQUEST',
      link: `/interviews/scheduled/${interview.id}`,
    });

    let whatsapp: 'SENT' | 'FAILED' | 'SKIPPED_NO_OPT_IN' | 'SKIPPED_BY_EMPLOYER' = 'SKIPPED_BY_EMPLOYER';
    if (parseNotifyPrefs(interview.notes).whatsapp) {
      const phone = this.whatsappWebhook.resolveNotifyPhone(candidate);
      whatsapp = 'SKIPPED_NO_OPT_IN';
      if (phone) {
        const sent = await this.whatsapp
          .sendText({
            to: phone,
            candidateId: candidate.id,
            interviewId: interview.id,
            messageType: 'interview_feedback_request',
            body: `Hi ${firstName}, ${company} would like your feedback on the ${jobTitle} interview.\n\nShare feedback: ${feedbackUrl}`,
          })
          .catch(() => ({ ok: false as const }));
        whatsapp = sent.ok ? 'SENT' : 'FAILED';
      }
    }

    return { ...this.toInterview(updated), delivery: { inApp: 'CREATED' as const, whatsapp } };
  }

  private toInterview(row: {
    id: string;
    applicationId: string;
    jobId: string;
    candidateId: string;
    scheduledAt: Date;
    durationMin: number;
    timezone?: string | null;
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
    candidateAvailableFrom?: Date | null;
    candidateAvailableUntil?: Date | null;
    candidateTimezone?: string | null;
    candidateRescheduleRequestedAt?: Date | null;
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
      notes: stripNotifyMarkers(stripRescheduleMarkers(row.notes)) || null,
      notify: parseNotifyPrefs(row.notes),
      preferredRescheduleAt: preferredRescheduleAt?.toISOString() || null,
      candidateAvailability:
        row.candidateAvailableFrom && row.candidateAvailableUntil
          ? {
              from: row.candidateAvailableFrom.toISOString(),
              until: row.candidateAvailableUntil.toISOString(),
              timezone: row.candidateTimezone || row.timezone || DEFAULT_INTERVIEW_TIMEZONE,
              label: formatAvailabilityWindow(
                row.candidateAvailableFrom,
                row.candidateAvailableUntil,
                row.candidateTimezone || row.timezone || DEFAULT_INTERVIEW_TIMEZONE,
              ),
            }
          : null,
      rescheduleRequestedAt: row.candidateRescheduleRequestedAt?.toISOString() || null,
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

  async changeStatus(userId: string, applicationId: string, action: string, reason?: string, note?: string) {
    const employer = await this.requireEmployer(userId);
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, job: { employerId: employer.id } },
      include: { job: { select: { title: true } }, candidate: { select: { userId: true } } },
    });
    if (!application) {
      throw new NotFoundException({ code: SharedError.RESOURCE_NOT_FOUND, message: 'Application was not found' });
    }
    const status = ACTION_STATUS[action];
    if (!status) {
      throw new ForbiddenException({ code: SharedError.BUSINESS_RULE_VIOLATION, message: 'This action is not allowed.' });
    }
    if (application.status === status) return application;
    const transitionError = applicationTransitionError(application.status, status);
    if (transitionError) {
      throw new HttpException(
        { code: SharedError.BUSINESS_RULE_VIOLATION, message: transitionError },
        HttpStatus.CONFLICT,
      );
    }
    const employerNote = note?.trim().slice(0, 500);
    const updated = await this.prisma.application.update({
      where: { id: application.id },
      data: { status, ...(employerNote ? { employerNote } : {}) },
    });
    const noticeKey = APPLICATION_STATUS_NOTICE[status];
    let notification: 'CREATED' | 'FAILED' | 'NOT_APPLICABLE' = 'NOT_APPLICABLE';
    if (noticeKey) {
      const noticeVars = {
        jobTitle: application.job.title,
        company: employer.companyName || 'The employer',
        feedback: status === 'REJECTED' && reason?.trim() ? ` Feedback: ${reason.trim().slice(0, 300)}` : '',
      };
      notification = await this.notifications
        .create({
          userId: application.candidate.userId,
          ...renderDefaultNotification(noticeKey, noticeVars),
          templateKey: noticeKey,
          templateVars: noticeVars,
          type: 'APPLICATION',
          link: `/applications/${application.id}`,
        })
        .then(() => 'CREATED' as const)
        .catch((err: unknown) => {
          this.logger.error(
            `Application status notification failed for ${application.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
          return 'FAILED' as const;
        });
    }
    if (status === 'SHORTLISTED' || status === 'INTERVIEW') {
      await this.testimonials
        .markEligible(userId, 'AFTER_SHORTLIST_OR_INTERVIEW')
        .catch(() => undefined);
    }
    if (status === 'SELECTED' || status === 'HIRED') {
      await this.testimonials.markEligible(userId, 'AFTER_HIRE_OR_SELECT').catch(() => undefined);
    }
    return { ...updated, notification };
  }

  private async maybeFirstJobPublishedPrompt(userId: string, employerId: string) {
    const publishedCount = await this.prisma.job.count({
      where: { employerId, status: 'PUBLISHED' },
    });
    if (publishedCount === 1) {
      await this.testimonials.markEligible(userId, 'FIRST_JOB_PUBLISHED').catch(() => undefined);
    }
  }

  private async requireEmployer(userId: string) {
    const employer = await this.prisma.employer.findUnique({ where: { userId } });
    if (!employer) {
      throw new NotFoundException({ code: SharedError.RESOURCE_NOT_FOUND, message: 'Employer profile was not found' });
    }
    return withEffectiveVerification(employer);
  }

  private async profile(employer: Parameters<EmployersService['toProfile']>[0] & { id: string }) {
    const logoUrl = await readableCompanyLogoUrl(this.storage, employer.id, employer.logoUrl);
    return this.toProfile({ ...employer, logoUrl });
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
    companySize?: string | null;
    about?: string | null;
    linkedinUrl?: string | null;
    logoUrl?: string | null;
    verificationStatus: string;
    verified: boolean;
  }) {
    const { verificationStatus, verified } = withEffectiveVerification(employer);
    return {
      companySize: employer.companySize ?? null,
      about: employer.about ?? null,
      linkedinUrl: employer.linkedinUrl ?? null,
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
      verified,
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
    if (/immediate|asap|0\s*(day|week|month)?|available now/.test(lower)) {
      return { label: formatAvailabilityLabel(raw, 'Immediate'), tone: 'immediate' };
    }
    return { label: formatAvailabilityLabel(raw, raw), tone: 'notice' };
  }
  if (input.stillInCollege) return { label: 'Student', tone: 'neutral' };
  if (input.experienceYears <= 0) return { label: 'Immediate', tone: 'immediate' };
  // Prefer not to show vague "Employed" — ask for notice period from onboarding.
  if (input.currentlyEmployed) return { label: 'Notice TBD', tone: 'notice' };
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
