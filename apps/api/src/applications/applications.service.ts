import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ErrorCode, type ApplicationStatus } from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { USABLE_RESUME_WHERE } from '../resumes/resume-eligibility';
import { MatchingService } from '../matching/matching.service';
import { NotificationsService } from '../notifications/notifications.service';
import { renderDefaultNotification } from '../notifications/notification-templates';
import { InterviewWhatsAppService } from '../whatsapp/interview-whatsapp.service';
import { EmailService } from '../auth/email.service';
import { ConfigService } from '@nestjs/config';
import { TestimonialsService } from '../testimonials/testimonials.service';
import { InterviewAvailabilityService } from '../interview-availability/interview-availability.service';
import { interviewMeetingUrl } from '../common/web/public-web-url';
import {
  DEFAULT_INTERVIEW_TIMEZONE,
  formatAvailabilityWindow,
  isReschedulePending,
} from '../employers/employer-policy';

const FLOW: ApplicationStatus[] = ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'SELECTED'];

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

function parseRescheduleReason(notes: string | null | undefined) {
  const match = (notes || '').match(RESCHEDULE_REASON_RE);
  return match?.[1]?.trim() || null;
}

/** Hiring decision on the application behind an interview, as the candidate may see it. */
function interviewOutcome(status: string | undefined) {
  if (status === 'SELECTED' || status === 'HIRED') return 'SELECTED' as const;
  if (status === 'REJECTED') return 'NOT_SELECTED' as const;
  if (status === 'ON_HOLD') return 'ON_HOLD' as const;
  if (status === 'WITHDRAWN') return 'WITHDRAWN' as const;
  return null;
}

function formatWhenLabel(value: Date) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(value);
}

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: MatchingService,
    private readonly notifications: NotificationsService,
    private readonly interviewWhatsApp: InterviewWhatsAppService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly testimonials: TestimonialsService,
    private readonly availability: InterviewAvailabilityService,
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
      ? await this.prisma.resume.findFirst({ where: { id: resumeId, candidateId: candidate.id, ...USABLE_RESUME_WHERE } })
      : await this.prisma.resume.findFirst({
          where: { candidateId: candidate.id, ...USABLE_RESUME_WHERE },
          orderBy: { updatedAt: 'desc' },
        });
    if (resumeId && !resume) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'That resume was not found or is not ready to use. Choose another resume.',
      });
    }
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

    const submittedVars = { jobTitle: job.title, company: job.employer.companyName };
    await this.notifications
      .create({
        userId,
        ...renderDefaultNotification('APPLICATION_SUBMITTED', submittedVars),
        templateKey: 'APPLICATION_SUBMITTED',
        templateVars: submittedVars,
        type: 'APPLICATION',
        link: `/applications/${application.id}`,
      })
      .catch(() => undefined);

    if (job.employer.userId) {
      const receivedVars = { candidateName, jobTitle: job.title };
      await this.notifications
        .create({
          userId: job.employer.userId,
          ...renderDefaultNotification('APPLICATION_RECEIVED', receivedVars),
          templateKey: 'APPLICATION_RECEIVED',
          templateVars: receivedVars,
          type: 'APPLICATION',
          link: `/employer/jobs/${job.id}`,
        })
        .catch(() => undefined);
    }

    const applicationCount = await this.prisma.application.count({
      where: { candidateId: candidate.id, status: { not: 'WITHDRAWN' } },
    });
    if (applicationCount >= 5) {
      await this.testimonials
        .markEligible(userId, 'AFTER_5_APPLICATIONS')
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
      where: { candidateId: candidate.id },
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
    const candidate = await this.requireCandidate(userId);
    const row = await this.prisma.employerInterview.findFirst({
      where: { id, candidateId: candidate.id },
      include: {
        employer: { include: { user: true } },
        application: {
          include: {
            job: { include: { employer: true } },
            candidate: { include: { user: true } },
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
    if (row.status === 'CANCELLED' || row.status === 'COMPLETED') {
      throw new BadRequestException({
        code: ErrorCode.BUSINESS_RULE_VIOLATION,
        message: 'This interview can no longer be confirmed.',
      });
    }
    if (isReschedulePending(row.status)) {
      throw new ConflictException({
        code: ErrorCode.BUSINESS_RULE_VIOLATION,
        message: 'You asked for another time. The employer will send you a new interview time to confirm.',
      });
    }

    const meetingUrl = interviewMeetingUrl(this.config, row);
    // Atomic claim so a double click or a parallel WhatsApp confirm never sends notifications twice.
    const claimed = await this.prisma.employerInterview.updateMany({
      where: { id, candidateId: candidate.id, status: { in: ['PROPOSED', 'SCHEDULED'] } },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        whatsappStatus: 'CONFIRMED_VIA_PORTAL',
        meetingUrl,
        notes: stripRescheduleMarkers(row.notes) || null,
      },
    });
    const updated = await this.prisma.employerInterview.findUniqueOrThrow({
      where: { id },
      include: {
        application: {
          include: {
            job: { include: { employer: true } },
            candidate: { include: { user: true } },
          },
        },
      },
    });
    if (claimed.count === 0) return this.toScheduledInterview(updated);

    const candidateName =
      [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim() || 'Candidate';
    const whenLabel = formatWhenLabel(updated.scheduledAt);
    const candidateEmail = updated.application.candidate.user.email;

    await this.interviewWhatsApp.sendConfirmationNow(updated.id).catch(() => undefined);
    if (candidateEmail) {
      await this.email
        .sendEmployerInterviewConfirmation({
          to: candidateEmail,
          candidateName: candidate.firstName || 'there',
          companyName: updated.application.job.employer.companyName,
          jobTitle: updated.application.job.title,
          whenLabel,
          meetingUrl,
        })
        .catch(() => undefined);
    }

    const employerUserId = row.employer.userId;
    if (employerUserId) {
      await this.notifications
        .create({
          userId: employerUserId,
          title: 'Interview confirmed',
          body: `${candidateName} confirmed the interview for ${updated.application.job.title}.`,
          type: 'INTERVIEW',
          link: `/employer/interviews`,
        })
        .catch(() => undefined);
    }

    return this.toScheduledInterview(updated);
  }

  /**
   * No availability fields: the candidate clicked "Reschedule" (→ RESCHEDULE_NEEDED).
   * date + availableFrom + availableUntil: availability submitted (→ RESCHEDULE_REQUESTED).
   */
  async requestRescheduleInterview(
    userId: string,
    id: string,
    body: {
      date?: string;
      availableFrom?: string;
      availableUntil?: string;
      timezone?: string;
    } = {},
  ) {
    const candidate = await this.requireCandidate(userId);
    const row = await this.prisma.employerInterview.findFirst({
      where: { id, candidateId: candidate.id },
      include: {
        employer: { include: { user: true } },
        application: {
          include: {
            job: { include: { employer: true } },
            candidate: { include: { user: true } },
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
    if (row.status === 'CANCELLED' || row.status === 'COMPLETED') {
      throw new BadRequestException({
        code: ErrorCode.BUSINESS_RULE_VIOLATION,
        message: 'This interview can no longer be rescheduled.',
      });
    }

    const include = {
      application: {
        include: {
          job: { include: { employer: true } },
          candidate: { include: { user: true } },
        },
      },
    } as const;

    const submitsAvailability = Boolean(body.date || body.availableFrom || body.availableUntil);
    if (!submitsAvailability) {
      await this.interviewWhatsApp.markRescheduleNeeded(row.id, 'PORTAL');
      return this.toScheduledInterview(
        await this.prisma.employerInterview.findUniqueOrThrow({ where: { id: row.id }, include }),
      );
    }

    const result = await this.availability.submitAvailability({
      interviewId: row.id,
      candidateId: candidate.id,
      body,
      source: 'PORTAL',
    });
    if (!result.ok) {
      if (result.reason === 'not_found') {
        throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: result.message });
      }
      throw new BadRequestException({
        code: result.reason === 'invalid' ? ErrorCode.VALIDATION_ERROR : ErrorCode.BUSINESS_RULE_VIOLATION,
        message: result.message,
      });
    }
    return this.toScheduledInterview(
      await this.prisma.employerInterview.findUniqueOrThrow({ where: { id: row.id }, include }),
    );
  }

  async submitScheduledInterviewFeedback(
    userId: string,
    id: string,
    body: { rating?: number; text?: string },
  ) {
    const candidate = await this.requireCandidate(userId);
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Rating must be a whole number from 1 to 5.',
      });
    }
    const text = (body.text || '').trim().slice(0, 2000) || null;

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
    if (!['CONFIRMED', 'COMPLETED'].includes(row.status)) {
      throw new BadRequestException({
        code: ErrorCode.BUSINESS_RULE_VIOLATION,
        message: 'Feedback is available after the interview is confirmed or completed.',
      });
    }
    if (row.candidateFeedbackAt) {
      throw new BadRequestException({
        code: ErrorCode.BUSINESS_RULE_VIOLATION,
        message: 'You have already submitted feedback for this interview.',
      });
    }

    const updated = await this.prisma.employerInterview.update({
      where: { id: row.id },
      data: {
        candidateFeedbackRating: rating,
        candidateFeedbackText: text,
        candidateFeedbackAt: new Date(),
      },
      include: {
        application: {
          include: {
            job: { include: { employer: true } },
          },
        },
      },
    });

    const employerUserId = await this.prisma.employer.findUnique({
      where: { id: row.employerId },
      select: { userId: true },
    });
    if (employerUserId?.userId) {
      const candidateName =
        [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim() || 'A candidate';
      await this.notifications
        .create({
          userId: employerUserId.userId,
          title: 'Interview feedback received',
          body: `${candidateName} shared feedback for ${row.application.job.title} (${rating}/5).`,
          type: 'INTERVIEW_FEEDBACK',
          link: `/employer/interviews`,
        })
        .catch(() => undefined);
    }

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
    meetingUrl?: string | null;
    notes?: string | null;
    candidateNotes?: string | null;
    candidateFeedbackRating?: number | null;
    candidateFeedbackText?: string | null;
    candidateFeedbackAt?: Date | null;
    feedbackRequestedAt?: Date | null;
    timezone?: string | null;
    candidateAvailableFrom?: Date | null;
    candidateAvailableUntil?: Date | null;
    candidateTimezone?: string | null;
    whatsappStatus?: string | null;
    application: {
      status?: string;
      job: {
        title: string;
        employer: { companyName: string };
      };
    };
  }) {
    const scheduledAt = row.scheduledAt;
    const dateLabel = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Kolkata',
    }).format(scheduledAt);
    const timeLabel = new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    }).format(scheduledAt);
    const status =
      row.status === 'CONFIRMED' ||
      row.status === 'RESCHEDULE_NEEDED' ||
      row.status === 'RESCHEDULE_REQUESTED' ||
      row.status === 'COMPLETED' ||
      row.status === 'CANCELLED'
        ? row.status
        : 'PENDING_CONFIRMATION';
    const mode = row.mode?.toUpperCase().includes('VIDEO') ? 'VIDEO' : 'IN_PERSON';
    const preferredAt = parsePreferredReschedule(row.notes);
    // The agreed time is void while a new one is being arranged, so its meeting link is not shown.
    const linkWithheld = isReschedulePending(row.status) && mode === 'VIDEO';
    const availabilityTz = row.candidateTimezone || row.timezone || DEFAULT_INTERVIEW_TIMEZONE;
    return {
      id: row.id,
      jobTitle: row.application.job.title,
      companyName: row.application.job.employer.companyName,
      scheduledDate: dateLabel,
      scheduledTime: timeLabel,
      status,
      // A WhatsApp "Decline" is the only candidate-side path to CANCELLED; every other cancel is the employer's.
      cancelledBy:
        status === 'CANCELLED' ? (row.whatsappStatus === 'DECLINED_VIA_WA' ? 'CANDIDATE' : 'EMPLOYER') : null,
      location: linkWithheld
        ? 'Video interview'
        : row.location || (mode === 'VIDEO' ? 'Video interview' : 'To be confirmed'),
      mode,
      applicationId: row.applicationId,
      durationMin: row.durationMin,
      scheduledAt: scheduledAt.toISOString(),
      meetingUrl: linkWithheld ? null : interviewMeetingUrl(this.config, row),
      candidateAvailability:
        row.candidateAvailableFrom && row.candidateAvailableUntil
          ? {
              from: row.candidateAvailableFrom.toISOString(),
              until: row.candidateAvailableUntil.toISOString(),
              timezone: availabilityTz,
              label: formatAvailabilityWindow(row.candidateAvailableFrom, row.candidateAvailableUntil, availabilityTz),
            }
          : null,
      preferredRescheduleAt: preferredAt?.toISOString() || null,
      preferredRescheduleReason: parseRescheduleReason(row.notes),
      candidateNotes: row.candidateNotes?.trim() || null,
      candidateFeedback:
        row.candidateFeedbackAt && row.candidateFeedbackRating
          ? {
              rating: row.candidateFeedbackRating,
              text: row.candidateFeedbackText || null,
              submittedAt: row.candidateFeedbackAt.toISOString(),
            }
          : null,
      feedbackRequestedAt: row.feedbackRequestedAt?.toISOString() || null,
      canSubmitFeedback:
        ['CONFIRMED', 'COMPLETED'].includes(row.status) && !row.candidateFeedbackAt,
      outcome: interviewOutcome(row.application.status),
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
      status: string;
      employer: { companyName: string };
    };
  }) {
    const reached = FLOW.indexOf(
      row.status === 'HIRED' ? 'SELECTED' : row.status === 'ON_HOLD' ? 'UNDER_REVIEW' : row.status,
    );
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
        status: row.job.status,
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
