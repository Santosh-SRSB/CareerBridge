import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ErrorCode, type ApplicationStatus } from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MatchingService } from '../matching/matching.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InterviewWhatsAppService } from '../whatsapp/interview-whatsapp.service';
import { EmailService } from '../auth/email.service';
import { ConfigService } from '@nestjs/config';
import { TestimonialsService } from '../testimonials/testimonials.service';

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

function withRescheduleMarkers(notes: string | null | undefined, preferredAt: Date, reason?: string) {
  const base = stripRescheduleMarkers(notes);
  const bits = [
    `[[RESCHEDULE_PREF:${preferredAt.toISOString()}]]`,
    reason?.trim() ? `[[RESCHEDULE_REASON:${reason.trim().slice(0, 280)}]]` : '',
    base,
  ].filter(Boolean);
  return bits.join('\n');
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
    // Keep employer match ranks in sync when a candidate applies.
    await this.matching.recomputeMatchesForJob(jobId).catch(() => undefined);

    const candidateName =
      [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim() || 'A candidate';

    await this.notifications
      .create({
        userId,
        title: 'Application submitted',
        body: `Your application for ${job.title} at ${job.employer.companyName} was sent.`,
        type: 'APPLICATION',
        link: `/applications/${application.id}`,
      })
      .catch(() => undefined);

    if (job.employer.userId) {
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
      where: {
        candidateId: candidate.id,
        status: { not: 'CANCELLED' },
      },
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

    const portalBase = (this.config.get<string>('WEB_ORIGIN', 'http://localhost:3000') || '')
      .split(',')[0]
      .trim();
    const portalUrl = `${portalBase}/interviews/scheduled/${row.id}`;
    const location = (row.location || '').trim();
    const meetingUrl =
      (location && /^https?:\/\//i.test(location) ? location : null) || row.meetingUrl || portalUrl;

    const updated = await this.prisma.employerInterview.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        whatsappStatus: 'CONFIRMED_VIA_PORTAL',
        meetingUrl,
        notes: stripRescheduleMarkers(row.notes) || null,
      },
      include: {
        application: {
          include: {
            job: { include: { employer: true } },
            candidate: { include: { user: true } },
          },
        },
      },
    });

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

  async requestRescheduleInterview(
    userId: string,
    id: string,
    body: {
      preferredAt?: string;
      preferredDate?: string;
      preferredTime?: string;
      reason?: string;
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

    let preferredAt: Date | null = null;
    if (body.preferredAt) {
      preferredAt = new Date(body.preferredAt);
    } else if (body.preferredDate && body.preferredTime) {
      preferredAt = new Date(`${body.preferredDate}T${body.preferredTime}`);
    }
    if (!preferredAt || Number.isNaN(preferredAt.getTime())) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Choose a preferred date and time for the reschedule.',
      });
    }
    if (preferredAt.getTime() < Date.now() - 60_000) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Preferred date and time cannot be in the past.',
      });
    }

    const updated = await this.prisma.employerInterview.update({
      where: { id },
      data: {
        status: 'RESCHEDULE_REQUESTED',
        confirmedAt: null,
        whatsappStatus: 'RESCHEDULE_REQUESTED_VIA_PORTAL',
        notes: withRescheduleMarkers(row.notes, preferredAt, body.reason),
      },
      include: {
        application: {
          include: {
            job: { include: { employer: true } },
            candidate: { include: { user: true } },
          },
        },
      },
    });

    const candidateName =
      [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim() || 'A candidate';
    const preferredLabel = formatWhenLabel(preferredAt);
    const portalBase = (this.config.get<string>('WEB_ORIGIN', 'http://localhost:3000') || '')
      .split(',')[0]
      .trim();
    const employerUser = row.employer.user;

    if (employerUser?.id) {
      await this.notifications
        .create({
          userId: employerUser.id,
          title: 'Reschedule requested',
          body: `${candidateName} wants to reschedule ${updated.application.job.title} to ${preferredLabel}.`,
          type: 'INTERVIEW',
          link: `/employer/interviews`,
        })
        .catch(() => undefined);

      if (employerUser.email) {
        await this.email
          .sendEmployerInterviewRescheduleRequest({
            to: employerUser.email,
            employerName: row.employer.contactName || 'there',
            candidateName,
            jobTitle: updated.application.job.title,
            preferredLabel,
            portalUrl: `${portalBase}/employer/interviews`,
          })
          .catch(() => undefined);
      }

      await this.interviewWhatsApp
        .notifyEmployerRescheduleRequest({
          employerUserId: employerUser.id,
          employerPhone: employerUser.phone,
          candidateName,
          jobTitle: updated.application.job.title,
          preferredAt,
          interviewId: updated.id,
        })
        .catch(() => undefined);
    }

    return this.toScheduledInterview(updated);
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
    candidateFeedbackRating?: number | null;
    candidateFeedbackText?: string | null;
    candidateFeedbackAt?: Date | null;
    feedbackRequestedAt?: Date | null;
    application: {
      job: {
        title: string;
        employer: { companyName: string };
      };
    };
  }) {
    const scheduledAt = row.scheduledAt;
    const dateLabel = scheduledAt.toISOString().slice(0, 10);
    const timeLabel = new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    }).format(scheduledAt);
    const status =
      row.status === 'CONFIRMED'
        ? 'CONFIRMED'
        : row.status === 'RESCHEDULE_REQUESTED'
          ? 'RESCHEDULE_REQUESTED'
          : row.status === 'COMPLETED'
            ? 'COMPLETED'
            : row.status === 'CANCELLED'
              ? 'CANCELLED'
              : 'PENDING_CONFIRMATION';
    const mode = row.mode?.toUpperCase().includes('VIDEO') ? 'VIDEO' : 'IN_PERSON';
    const preferredAt = parsePreferredReschedule(row.notes);
    const portalBase = (this.config.get<string>('WEB_ORIGIN', 'http://localhost:3000') || '')
      .split(',')[0]
      .trim();
    return {
      id: row.id,
      jobTitle: row.application.job.title,
      companyName: row.application.job.employer.companyName,
      scheduledDate: dateLabel,
      scheduledTime: timeLabel,
      status,
      location: row.location || (mode === 'VIDEO' ? 'Video interview' : 'To be confirmed'),
      mode,
      applicationId: row.applicationId,
      durationMin: row.durationMin,
      scheduledAt: scheduledAt.toISOString(),
      meetingUrl: row.meetingUrl || `${portalBase}/interviews/scheduled/${row.id}`,
      preferredRescheduleAt: preferredAt?.toISOString() || null,
      preferredRescheduleReason: parseRescheduleReason(row.notes),
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
