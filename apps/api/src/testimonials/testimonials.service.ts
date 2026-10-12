import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ErrorCode } from '@careerbridge/shared';
import type {
  TestimonialAudience,
  TestimonialSource,
} from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const SOURCE_COPY: Record<
  TestimonialSource,
  { title: string; subtitle: string; audience: TestimonialAudience }
> = {
  AFTER_5_APPLICATIONS: {
    audience: 'CANDIDATE',
    title: 'How is CareerBridge helping your job search?',
    subtitle: 'You have applied to 5 jobs — share a short note for our testimonials page.',
  },
  AFTER_FIRST_MOCK_INTERVIEW: {
    audience: 'CANDIDATE',
    title: 'How was your mock interview?',
    subtitle: 'Your feedback helps other candidates feel confident starting practice.',
  },
  PROFILE_80_COMPLETE: {
    audience: 'CANDIDATE',
    title: 'Your Career Passport looks strong',
    subtitle: 'Tell others how CareerBridge helped you get job-ready.',
  },
  DASHBOARD_SOFT_PROMPT: {
    audience: 'CANDIDATE',
    title: 'Got 30 seconds for feedback?',
    subtitle: 'A short quote from you can inspire the next youth on CareerBridge.',
  },
  FIRST_JOB_PUBLISHED: {
    audience: 'EMPLOYER',
    title: 'First job posted — how did it feel?',
    subtitle: 'Share a quick note about hiring with CareerBridge.',
  },
  AFTER_SHORTLIST_OR_INTERVIEW: {
    audience: 'EMPLOYER',
    title: 'How is shortlisting going?',
    subtitle: 'Tell others if matching and interviews felt more structured.',
  },
  AFTER_HIRE_OR_SELECT: {
    audience: 'EMPLOYER',
    title: 'Congrats on selecting a candidate',
    subtitle: 'Your story is the strongest social proof for other employers.',
  },
  MANUAL: {
    audience: 'CANDIDATE',
    title: 'Share your CareerBridge experience',
    subtitle: 'Your words may appear on our testimonials page after review.',
  },
  EMPLOYER_DASHBOARD_SOFT_PROMPT: {
    audience: 'EMPLOYER',
    title: 'Got 30 seconds for feedback?',
    subtitle: 'Tell other employers how hiring with CareerBridge is going.',
  },
};

export const TESTIMONIAL_SOURCES = Object.keys(SOURCE_COPY) as TestimonialSource[];

/** A user sees at most one feedback prompt per window, counted from the last time one was shown. */
export const FEEDBACK_PROMPT_INTERVAL_MS = 360 * 60 * 60 * 1000;

/**
 * Prompt chosen when a window opens: the first ELIGIBLE milestone in this order (furthest along the
 * hiring journey first), otherwise the audience's generic dashboard prompt.
 */
const MILESTONE_PRIORITY: Record<TestimonialAudience, TestimonialSource[]> = {
  CANDIDATE: ['AFTER_5_APPLICATIONS', 'AFTER_FIRST_MOCK_INTERVIEW', 'PROFILE_80_COMPLETE'],
  EMPLOYER: ['AFTER_HIRE_OR_SELECT', 'AFTER_SHORTLIST_OR_INTERVIEW', 'FIRST_JOB_PUBLISHED'],
};

const DASHBOARD_SOURCE: Record<TestimonialAudience, TestimonialSource> = {
  CANDIDATE: 'DASHBOARD_SOFT_PROMPT',
  EMPLOYER: 'EMPLOYER_DASHBOARD_SOFT_PROMPT',
};

function audienceForUserType(userType: string): TestimonialAudience | null {
  if (userType === 'CANDIDATE') return 'CANDIDATE';
  if (userType === 'EMPLOYER_ADMIN' || userType === 'EMPLOYER_RECRUITER') return 'EMPLOYER';
  return null;
}

function isTestimonialSource(value: unknown): value is TestimonialSource {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(SOURCE_COPY, value);
}

function isUniqueViolation(err: unknown) {
  return (err as { code?: unknown } | null)?.code === 'P2002';
}

function unknownSourceError() {
  return new BadRequestException({
    code: ErrorCode.VALIDATION_ERROR,
    message: 'Unknown feedback source.',
  });
}

@Injectable()
export class TestimonialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Scheduling clock. Always the API server's time, never the browser's; replaced in tests. */
  now: () => Date = () => new Date();

  async listPublic(audience?: TestimonialAudience) {
    const rows = await this.prisma.testimonial.findMany({
      where: {
        status: 'APPROVED',
        ...(audience ? { audience } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 60,
      include: {
        user: {
          select: {
            userType: true,
            candidate: { select: { firstName: true, lastName: true } },
            employer: { select: { contactName: true, companyName: true } },
          },
        },
      },
    });
    return rows.map((row) => this.toPublic(row));
  }

  /**
   * Returns a prompt only when this request claims the user's feedback window; every other call within
   * FEEDBACK_PROMPT_INTERVAL_MS of the last shown prompt returns null.
   */
  async getActivePrompt(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { userType: true },
    });
    const audience = user ? audienceForUserType(user.userType) : null;
    if (!audience) return null;

    const now = this.now();
    if (!(await this.claimPromptWindow(userId, now))) return null;

    const source = await this.selectPromptSource(userId, audience, now);
    const copy = SOURCE_COPY[source];
    return {
      source,
      audience: copy.audience,
      title: copy.title,
      subtitle: copy.subtitle,
    };
  }

  async dismissPrompt(userId: string, source: TestimonialSource) {
    if (!isTestimonialSource(source)) throw unknownSourceError();
    const now = this.now();
    await this.prisma.testimonialPrompt.upsert({
      where: { userId_source: { userId, source } },
      create: {
        userId,
        source,
        status: 'DISMISSED',
        dismissedAt: now,
      },
      update: {
        status: 'DISMISSED',
        dismissedAt: now,
      },
    });
    return { dismissed: true };
  }

  async submit(
    userId: string,
    payload: {
      rating: number;
      quote: string;
      source?: TestimonialSource;
      displayName?: string;
      headline?: string;
    },
  ) {
    const rating = Math.round(Number(payload.rating));
    const quote = (payload.quote || '').trim();
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Rating must be between 1 and 5.',
      });
    }
    if (quote.length < 20) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Please write at least 20 characters.',
      });
    }
    if (quote.length > 600) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Please keep your feedback under 600 characters.',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        candidate: true,
        employer: true,
      },
    });
    if (!user) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Account was not found.',
      });
    }

    const isEmployer =
      user.userType === 'EMPLOYER_ADMIN' || user.userType === 'EMPLOYER_RECRUITER';
    const audience: TestimonialAudience = isEmployer ? 'EMPLOYER' : 'CANDIDATE';
    const source = payload.source || 'MANUAL';
    if (!isTestimonialSource(source)) throw unknownSourceError();
    const copy = SOURCE_COPY[source];
    if (copy.audience !== audience && source !== 'MANUAL') {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'This feedback source is not available for your account type.',
      });
    }

    const displayName =
      payload.displayName?.trim() ||
      (isEmployer
        ? user.employer?.contactName || user.employer?.companyName || 'Employer'
        : [user.candidate?.firstName, user.candidate?.lastName].filter(Boolean).join(' ') ||
          'Candidate');
    const headline =
      payload.headline?.trim() ||
      (isEmployer
        ? user.employer?.companyName || user.employer?.designation || null
        : user.candidate?.careerInterests
          ? safeFirstInterest(user.candidate.careerInterests)
          : null);

    const row = await this.prisma.testimonial.create({
      data: {
        userId,
        audience,
        source,
        rating,
        quote,
        displayName,
        headline,
        status: 'PENDING',
      },
    });

    const submittedAt = this.now();
    await this.prisma.testimonialPrompt.upsert({
      where: { userId_source: { userId, source } },
      create: {
        userId,
        source,
        status: 'SUBMITTED',
        submittedAt,
      },
      update: {
        status: 'SUBMITTED',
        submittedAt,
      },
    });

    await this.notifyAdminsOfPending(row.id, audience, displayName).catch(() => undefined);

    return {
      id: row.id,
      status: row.status,
      message: 'Thanks! Your feedback was sent for admin review.',
    };
  }

  /**
   * Records that a milestone was reached. Eligibility only queues a source for the next feedback window;
   * whether a prompt is shown is decided by getActivePrompt. A milestone notifies the user once when first
   * reached, and again only when a dismissed milestone is re-armed outside the user's current window.
   * Submitted milestones stay closed: the generic dashboard prompt carries the recurring cadence.
   */
  async markEligible(userId: string, source: TestimonialSource, notifyUser = true) {
    const existing = await this.prisma.testimonialPrompt.findUnique({
      where: { userId_source: { userId, source } },
    });
    const now = this.now();

    if (!existing) {
      try {
        const row = await this.prisma.testimonialPrompt.create({
          data: { userId, source, status: 'ELIGIBLE', eligibleAt: now },
        });
        if (notifyUser) await this.notifyPromptEligible(userId, source);
        return { created: true, id: row.id };
      } catch (err) {
        if (isUniqueViolation(err)) return { created: false };
        throw err;
      }
    }

    if (existing.status !== 'DISMISSED') return { created: false };
    if (await this.isWithinPromptWindow(userId, now)) return { created: false };

    const rearmed = await this.prisma.testimonialPrompt.updateMany({
      where: { id: existing.id, status: 'DISMISSED' },
      data: { status: 'ELIGIBLE', eligibleAt: now },
    });
    if (rearmed.count !== 1) return { created: false };
    if (notifyUser) await this.notifyPromptEligible(userId, source);
    return { created: true, id: existing.id };
  }

  async adminList(status?: string) {
    const where =
      status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)
        ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' }
        : {};
    const rows = await this.prisma.testimonial.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: {
          select: {
            email: true,
            phone: true,
            userType: true,
            candidate: { select: { firstName: true, lastName: true } },
            employer: { select: { companyName: true, contactName: true } },
          },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      audience: row.audience,
      source: row.source,
      rating: row.rating,
      quote: row.quote,
      displayName: row.displayName,
      headline: row.headline,
      status: row.status,
      rejectReason: row.rejectReason,
      reviewedAt: row.reviewedAt?.toISOString() || null,
      createdAt: row.createdAt.toISOString(),
      user: {
        email: row.user.email,
        phone: row.user.phone,
        userType: row.user.userType,
        name:
          row.user.candidate
            ? [row.user.candidate.firstName, row.user.candidate.lastName].filter(Boolean).join(' ')
            : row.user.employer?.contactName || row.user.employer?.companyName || null,
        company: row.user.employer?.companyName || null,
      },
    }));
  }

  async adminReview(
    adminUserId: string,
    id: string,
    action: 'APPROVE' | 'REJECT',
    rejectReason?: string,
  ) {
    const row = await this.prisma.testimonial.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Testimonial was not found.',
      });
    }
    if (action === 'REJECT' && !(rejectReason || '').trim()) {
      // Allow empty reason but store a default.
    }
    const updated = await this.prisma.testimonial.update({
      where: { id },
      data: {
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        reviewedByUserId: adminUserId,
        reviewedAt: new Date(),
        rejectReason: action === 'REJECT' ? (rejectReason || '').trim() || 'Not suitable for public page' : null,
      },
    });

    await this.notifications
      .create({
        userId: row.userId,
        title: action === 'APPROVE' ? 'Testimonial approved' : 'Testimonial not published',
        body:
          action === 'APPROVE'
            ? 'Thanks — your feedback may now appear on the CareerBridge testimonials page.'
            : 'Your feedback was reviewed and will not appear on the public testimonials page.',
        type: 'TESTIMONIAL',
        link: action === 'APPROVE' ? '/testimonials' : '/feedback',
      })
      .catch(() => undefined);

    return {
      id: updated.id,
      status: updated.status,
      reviewedAt: updated.reviewedAt?.toISOString() || null,
    };
  }

  private async isWithinPromptWindow(userId: string, now: Date) {
    const schedule = await this.prisma.testimonialPromptSchedule.findUnique({
      where: { userId },
      select: { lastShownAt: true },
    });
    const lastShownAt = schedule?.lastShownAt;
    return Boolean(lastShownAt && now.getTime() - lastShownAt.getTime() < FEEDBACK_PROMPT_INTERVAL_MS);
  }

  /**
   * Atomically moves the user's lastShownAt to `now` when no prompt was shown in the last
   * FEEDBACK_PROMPT_INTERVAL_MS. At most one concurrent caller gets true: the conditional UPDATE is
   * re-evaluated by Postgres under the row lock, and the first-ever claim relies on the primary key.
   */
  private async claimPromptWindow(userId: string, now: Date) {
    if (await this.isWithinPromptWindow(userId, now)) return false;
    const cutoff = new Date(now.getTime() - FEEDBACK_PROMPT_INTERVAL_MS);
    const claimed = await this.prisma.testimonialPromptSchedule.updateMany({
      where: { userId, OR: [{ lastShownAt: null }, { lastShownAt: { lte: cutoff } }] },
      data: { lastShownAt: now },
    });
    if (claimed.count === 1) return true;
    try {
      await this.prisma.testimonialPromptSchedule.create({ data: { userId, lastShownAt: now } });
      return true;
    } catch (err) {
      if (isUniqueViolation(err)) return false;
      throw err;
    }
  }

  private async selectPromptSource(userId: string, audience: TestimonialAudience, now: Date) {
    const milestones = MILESTONE_PRIORITY[audience];
    const eligible = await this.prisma.testimonialPrompt.findMany({
      where: { userId, status: 'ELIGIBLE', source: { in: milestones } },
      select: { source: true },
    });
    const eligibleSources = new Set<string>(eligible.map((row) => row.source));
    const milestone = milestones.find((source) => eligibleSources.has(source));
    if (milestone) return milestone;

    const source = DASHBOARD_SOURCE[audience];
    await this.prisma.testimonialPrompt.upsert({
      where: { userId_source: { userId, source } },
      create: { userId, source, status: 'ELIGIBLE', eligibleAt: now },
      update: { status: 'ELIGIBLE', eligibleAt: now },
    });
    return source;
  }

  private async notifyPromptEligible(userId: string, source: TestimonialSource) {
    const copy = SOURCE_COPY[source];
    await this.notifications
      .create({
        userId,
        title: copy.title,
        body: copy.subtitle,
        type: 'TESTIMONIAL_PROMPT',
        link: `/feedback?source=${encodeURIComponent(source)}`,
      })
      .catch(() => undefined);
  }

  private async notifyAdminsOfPending(testimonialId: string, audience: TestimonialAudience, name: string) {
    const admins = await this.prisma.user.findMany({
      where: {
        userType: { in: ['SUPER_ADMIN', 'PLATFORM_ADMIN'] },
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    await Promise.all(
      admins.map((admin) =>
        this.notifications.create({
          userId: admin.id,
          title: 'New testimonial pending review',
          body: `${name} (${audience.toLowerCase()}) submitted feedback for the testimonials page.`,
          type: 'TESTIMONIAL_MODERATION',
          link: `/adminsrsb/dashboard?tab=testimonials&focus=${encodeURIComponent(testimonialId)}`,
        }),
      ),
    );
  }

  private toPublic(row: {
    id: string;
    audience: string;
    rating: number;
    quote: string;
    displayName: string | null;
    headline: string | null;
    createdAt: Date;
    user: {
      candidate: { firstName: string | null; lastName: string | null } | null;
      employer: { contactName: string | null; companyName: string } | null;
    };
  }) {
    const fallbackName =
      row.user.candidate
        ? [row.user.candidate.firstName, row.user.candidate.lastName].filter(Boolean).join(' ')
        : row.user.employer?.contactName || row.user.employer?.companyName || 'CareerBridge member';
    return {
      id: row.id,
      audience: row.audience as TestimonialAudience,
      rating: row.rating,
      quote: row.quote,
      displayName: row.displayName || fallbackName || 'CareerBridge member',
      headline: row.headline,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

function safeFirstInterest(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && typeof parsed[0] === 'string' && parsed[0].trim()) {
      return parsed[0].trim();
    }
  } catch {
    // ignore
  }
  return null;
}
