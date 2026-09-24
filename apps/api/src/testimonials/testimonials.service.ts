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
};

@Injectable()
export class TestimonialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

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

  async getActivePrompt(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { userType: true },
    });
    if (!user) return null;

    // Soft dashboard prompt for candidates who never submitted (once / 30 days).
    if (user.userType === 'CANDIDATE') {
      await this.ensureDashboardSoftPrompt(userId);
    }

    const prompts = await this.prisma.testimonialPrompt.findMany({
      where: { userId, status: 'ELIGIBLE' },
      orderBy: { eligibleAt: 'desc' },
    });

    for (const prompt of prompts) {
      const copy = SOURCE_COPY[prompt.source as TestimonialSource];
      if (!copy) continue;
      if (user.userType === 'CANDIDATE' && copy.audience !== 'CANDIDATE') continue;
      if (
        (user.userType === 'EMPLOYER_ADMIN' || user.userType === 'EMPLOYER_RECRUITER') &&
        copy.audience !== 'EMPLOYER'
      ) {
        continue;
      }
      if (prompt.source === 'DASHBOARD_SOFT_PROMPT' && prompt.dismissedAt) {
        const days =
          (Date.now() - new Date(prompt.dismissedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (days < 20) continue;
      }
      return {
        source: prompt.source as TestimonialSource,
        audience: copy.audience,
        title: copy.title,
        subtitle: copy.subtitle,
      };
    }
    return null;
  }

  async dismissPrompt(userId: string, source: TestimonialSource) {
    await this.prisma.testimonialPrompt.upsert({
      where: { userId_source: { userId, source } },
      create: {
        userId,
        source,
        status: 'DISMISSED',
        dismissedAt: new Date(),
      },
      update: {
        status: 'DISMISSED',
        dismissedAt: new Date(),
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
    const source = (payload.source || 'MANUAL') as TestimonialSource;
    const copy = SOURCE_COPY[source] || SOURCE_COPY.MANUAL;
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

    await this.prisma.testimonialPrompt.upsert({
      where: { userId_source: { userId, source } },
      create: {
        userId,
        source,
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
      update: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });

    await this.notifyAdminsOfPending(row.id, audience, displayName).catch(() => undefined);

    return {
      id: row.id,
      status: row.status,
      message: 'Thanks! Your feedback was sent for admin review.',
    };
  }

  async markEligible(userId: string, source: TestimonialSource, notifyUser = true) {
    const existing = await this.prisma.testimonialPrompt.findUnique({
      where: { userId_source: { userId, source } },
    });
    if (existing?.status === 'SUBMITTED') return { created: false };

    const row = await this.prisma.testimonialPrompt.upsert({
      where: { userId_source: { userId, source } },
      create: {
        userId,
        source,
        status: 'ELIGIBLE',
        eligibleAt: new Date(),
      },
      update:
        existing?.status === 'ELIGIBLE'
          ? {}
          : {
              status: 'ELIGIBLE',
              eligibleAt: new Date(),
              dismissedAt: null,
            },
    });

    if (notifyUser && (!existing || existing.status !== 'ELIGIBLE')) {
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

    return { created: true, id: row.id };
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

  private async ensureDashboardSoftPrompt(userId: string) {
    const submittedAny = await this.prisma.testimonial.count({ where: { userId } });
    if (submittedAny > 0) return;

    const existing = await this.prisma.testimonialPrompt.findUnique({
      where: { userId_source: { userId, source: 'DASHBOARD_SOFT_PROMPT' } },
    });
    if (existing?.status === 'SUBMITTED') return;

    // First login/register: create once. After dismiss, only re-show after 20 days.
    if (existing?.status === 'DISMISSED' && existing.dismissedAt) {
      const days =
        (Date.now() - new Date(existing.dismissedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (days < 20) return;
      await this.prisma.testimonialPrompt.update({
        where: { userId_source: { userId, source: 'DASHBOARD_SOFT_PROMPT' } },
        data: {
          status: 'ELIGIBLE',
          eligibleAt: new Date(),
          dismissedAt: null,
        },
      });
      return;
    }

    if (existing?.status === 'ELIGIBLE') return;

    await this.prisma.testimonialPrompt.upsert({
      where: { userId_source: { userId, source: 'DASHBOARD_SOFT_PROMPT' } },
      create: {
        userId,
        source: 'DASHBOARD_SOFT_PROMPT',
        status: 'ELIGIBLE',
        eligibleAt: new Date(),
      },
      update: {
        status: 'ELIGIBLE',
        eligibleAt: new Date(),
      },
    });
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
