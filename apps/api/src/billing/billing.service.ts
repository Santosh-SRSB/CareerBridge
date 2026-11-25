import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ErrorCode as SharedError,
  getEmployerSubscriptionPlan,
  listPublicEmployerSubscriptionPlans,
  type EmployerSubscriptionPlanId,
} from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { renderDefaultNotification } from '../notifications/notification-templates';
import { razorpayConfigured, razorpayKeyId, razorpayMode, razorpayPublicStatus } from './razorpay.config';
import {
  createRazorpayOrder,
  fetchRazorpayOrder,
  fetchRazorpayOrderPayments,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from './razorpay.client';

const PAID_PLAN_IDS = new Set(['starter', 'growth', 'business']);

@Injectable()
export class BillingService {
  private readonly log = new Logger(BillingService.name);

  constructor(private readonly prisma: PrismaService) {}

  listPublicPlans() {
    return {
      currency: 'INR' as const,
      renewalType: 'manual' as const,
      notes: [
        'Active job posts are concurrent limits — closing a job frees a slot.',
        'Candidate database views are per subscription period and do not roll over.',
        'Opening applicants to your own jobs does not consume database views.',
      ],
      plans: listPublicEmployerSubscriptionPlans(),
      razorpay: razorpayPublicStatus(),
    };
  }

  paymentGatewayStatus() {
    return razorpayPublicStatus();
  }

  async getActiveSubscription(userId: string) {
    const employer = await this.requireEmployer(userId);
    await this.expireStale(employer.id);
    await this.maybeNotifySubscriptionLifecycle(employer.userId, employer.id);
    const row = await this.prisma.employerSubscription.findFirst({
      where: {
        employerId: employer.id,
        status: 'ACTIVE',
        endsAt: { gt: new Date() },
      },
      orderBy: { endsAt: 'desc' },
    });
    if (!row) {
      return {
        active: false as const,
        mode: razorpayMode(),
        planId: null,
        endsAt: null,
        paymentRequired: true,
      };
    }
    return {
      active: true as const,
      mode: razorpayMode(),
      planId: row.planId,
      endsAt: row.endsAt.toISOString(),
      paymentRequired: false,
      startsAt: row.startsAt.toISOString(),
    };
  }

  async createPlanOrder(userId: string, planIdRaw: string) {
    if (!razorpayConfigured()) {
      throw new ServiceUnavailableException({
        code: SharedError.BUSINESS_RULE_VIOLATION,
        message: 'Payment gateway is not configured. Add Razorpay keys in the API environment.',
      });
    }

    const planId = String(planIdRaw || '')
      .trim()
      .toLowerCase() as EmployerSubscriptionPlanId;
    if (!PAID_PLAN_IDS.has(planId)) {
      throw new BadRequestException({
        code: SharedError.VALIDATION_ERROR,
        message: 'Choose Starter, Growth or Business to checkout.',
      });
    }
    const plan = getEmployerSubscriptionPlan(planId);
    if (!plan || plan.amountPaise == null || plan.durationDays == null) {
      throw new BadRequestException({
        code: SharedError.VALIDATION_ERROR,
        message: 'This plan cannot be purchased online.',
      });
    }

    const employer = await this.requireEmployer(userId);
    // Guide §7.1 — no checkout while employer is still UNVERIFIED (KYC not started).
    const status = String(
      employer.verified && employer.verificationStatus === 'UNVERIFIED'
        ? 'VERIFIED'
        : employer.verificationStatus || 'UNVERIFIED',
    ).toUpperCase();
    if (status === 'UNVERIFIED') {
      throw new ForbiddenException({
        code: SharedError.BUSINESS_RULE_VIOLATION,
        message: 'Please complete employer account verification before purchasing a plan.',
      });
    }
    const receipt = `pl_${planId}_${Date.now().toString(36)}`.slice(0, 40);

    const payment = await this.prisma.employerPayment.create({
      data: {
        employerId: employer.id,
        planId: plan.id,
        amountPaise: plan.amountPaise,
        currency: 'INR',
        status: 'PENDING',
        provider: 'razorpay',
        description: `Employer plan: ${plan.name}`,
      },
    });

    try {
      const order = await createRazorpayOrder({
        amountPaise: plan.amountPaise,
        currency: 'INR',
        receipt,
        notes: {
          employerId: employer.id,
          paymentId: payment.id,
          planId: plan.id,
        },
      });

      await this.prisma.employerPayment.update({
        where: { id: payment.id },
        data: {
          razorpayOrderId: order.id,
          providerRef: order.id,
        },
      });

      return {
        paymentId: payment.id,
        orderId: order.id,
        amountPaise: plan.amountPaise,
        currency: 'INR',
        keyId: razorpayMode() === 'mock' ? 'rzp_test_mock' : razorpayKeyId(),
        mode: razorpayMode(),
        plan: {
          id: plan.id,
          name: plan.name,
          priceLabel: plan.priceLabel,
          periodLabel: plan.periodLabel,
          durationDays: plan.durationDays,
        },
      };
    } catch (err) {
      await this.prisma.employerPayment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
      });
      this.log.error(`Razorpay order create failed for payment ${payment.id}`, err as Error);
      throw new ServiceUnavailableException({
        code: SharedError.BUSINESS_RULE_VIOLATION,
        message: 'Could not start checkout. Please try again in a moment.',
      });
    }
  }

  async verifyCheckout(
    userId: string,
    body: {
      paymentId: string;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    },
  ) {
    const employer = await this.requireEmployer(userId);
    const payment = await this.prisma.employerPayment.findFirst({
      where: { id: body.paymentId, employerId: employer.id },
    });
    if (!payment) {
      throw new NotFoundException({
        code: SharedError.RESOURCE_NOT_FOUND,
        message: 'Payment was not found',
      });
    }
    if (payment.status === 'PAID') {
      return this.subscriptionPayload(employer.id, payment.id);
    }
    if (!payment.planId || payment.amountPaise <= 0) {
      throw new BadRequestException({
        code: SharedError.VALIDATION_ERROR,
        message: 'This payment is not a subscription checkout.',
      });
    }
    if (!payment.razorpayOrderId || payment.razorpayOrderId !== body.razorpayOrderId) {
      throw new ForbiddenException({
        code: SharedError.BUSINESS_RULE_VIOLATION,
        message: 'Order mismatch. Restart checkout and try again.',
      });
    }

    const ok = verifyPaymentSignature({
      orderId: body.razorpayOrderId,
      paymentId: body.razorpayPaymentId,
      signature: body.razorpaySignature,
    });
    if (!ok) {
      throw new ForbiddenException({
        code: SharedError.BUSINESS_RULE_VIOLATION,
        message: 'Payment signature could not be verified.',
      });
    }

    await this.activatePaidSubscription({
      paymentId: payment.id,
      employerId: employer.id,
      planId: payment.planId,
      razorpayPaymentId: body.razorpayPaymentId,
      razorpayOrderId: body.razorpayOrderId,
    });

    return this.subscriptionPayload(employer.id, payment.id);
  }

  /**
   * UPI QR often completes without Checkout `handler`. Server asks Razorpay for order
   * status / captured payments and unlocks (no client signature needed).
   * Early UPI failures must NOT stop polling — user can still pay the same QR.
   */
  async syncCheckoutStatus(userId: string, paymentId: string) {
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
      const payload = await this.subscriptionPayload(employer.id, payment.id);
      return { ...payload, pending: false as const };
    }
    if (!payment.planId || !payment.razorpayOrderId) {
      return { ok: false as const, pending: true as const, active: false, planId: null, endsAt: null, paymentId };
    }

    const orderId = payment.razorpayOrderId;
    const order = await fetchRazorpayOrder(orderId);
    const items = await fetchRazorpayOrderPayments(orderId);
    const captured = items.find(
      (p) =>
        (p.status === 'captured' || p.status === 'authorized') &&
        Number(p.amount) === payment.amountPaise,
    );
    const orderPaid = order?.status === 'paid';
    const successPay =
      captured ||
      (orderPaid
        ? items.find((p) => p.status === 'captured' || p.status === 'authorized') || items[0]
        : undefined);

    if (!successPay && !orderPaid) {
      // Website allowlist / risk blocks are definitive — surface so Checkout can close with a clear error.
      const blocked = items.find((p) => {
        if (p.status !== 'failed') return false;
        const reason = `${p.error_description || ''} ${p.error_reason || ''}`;
        return /does not match registered website|payment_risk_check_failed|risk_check/i.test(reason);
      });
      if (blocked) {
        const reason =
          (typeof blocked.error_description === 'string' && blocked.error_description.trim()) ||
          'Payment blocked by Razorpay. Add www.srsbcareerbridge.co.in under Razorpay → Settings → Website and app, then retry.';
        throw new BadRequestException({
          code: SharedError.BUSINESS_RULE_VIOLATION,
          message: reason,
        });
      }
      // Other failed UPI attempts: keep pending so the same QR can still succeed.
      return { ok: false as const, pending: true as const, active: false, planId: null, endsAt: null, paymentId };
    }

    const razorpayPaymentId =
      (successPay && typeof successPay.id === 'string' && successPay.id) ||
      payment.razorpayPaymentId ||
      `order_paid_${orderId}`;

    await this.activatePaidSubscription({
      paymentId: payment.id,
      employerId: employer.id,
      planId: payment.planId,
      razorpayPaymentId,
      razorpayOrderId: orderId,
    });
    const payload = await this.subscriptionPayload(employer.id, payment.id);
    return { ...payload, pending: false as const };
  }

  /** Razorpay webhook: payment.captured (idempotent via event ledger). */
  async handleWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
    eventIdHeader?: string,
  ) {
    if (!rawBody?.length) {
      throw new BadRequestException({ code: SharedError.VALIDATION_ERROR, message: 'Empty webhook body' });
    }
    if (razorpayMode() !== 'mock' && !verifyWebhookSignature(rawBody, signature)) {
      throw new ForbiddenException({
        code: SharedError.BUSINESS_RULE_VIOLATION,
        message: 'Invalid webhook signature',
      });
    }

    let event: {
      event?: string;
      created_at?: number;
      payload?: { payment?: { entity?: Record<string, unknown> } };
    };
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException({ code: SharedError.VALIDATION_ERROR, message: 'Invalid JSON' });
    }

    if (event.event !== 'payment.captured') {
      return { ok: true, ignored: true };
    }

    const entity = event.payload?.payment?.entity;
    const orderId = typeof entity?.order_id === 'string' ? entity.order_id : '';
    const paymentId = typeof entity?.id === 'string' ? entity.id : '';
    if (!orderId || !paymentId) return { ok: true, ignored: true };

    const eventId =
      (eventIdHeader || '').trim() ||
      `payment.captured:${paymentId}:${event.created_at ?? 'na'}`;

    try {
      await this.prisma.razorpayWebhookEvent.create({
        data: {
          id: randomUUID(),
          eventId,
          eventType: 'payment.captured',
          paymentId,
          orderId,
        },
      });
    } catch (err: unknown) {
      // Duplicate event id → already processed.
      if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2002') {
        return { ok: true, duplicate: true };
      }
      throw err;
    }

    const payment = await this.prisma.employerPayment.findFirst({
      where: { razorpayOrderId: orderId },
    });
    if (!payment?.planId) return { ok: true, ignored: true };
    if (payment.status === 'PAID') return { ok: true, alreadyPaid: true };

    await this.activatePaidSubscription({
      paymentId: payment.id,
      employerId: payment.employerId,
      planId: payment.planId,
      razorpayPaymentId: paymentId,
      razorpayOrderId: orderId,
    });
    return { ok: true };
  }

  private async activatePaidSubscription(input: {
    paymentId: string;
    employerId: string;
    planId: string;
    razorpayPaymentId: string;
    razorpayOrderId: string;
  }) {
    const plan = getEmployerSubscriptionPlan(input.planId);
    const days = plan?.durationDays ?? 30;
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.employerPayment.update({
        where: { id: input.paymentId },
        data: {
          status: 'PAID',
          paidAt: startsAt,
          provider: 'razorpay',
          razorpayPaymentId: input.razorpayPaymentId,
          razorpayOrderId: input.razorpayOrderId,
          providerRef: input.razorpayOrderId,
        },
      });

      await tx.employerSubscription.updateMany({
        where: { employerId: input.employerId, status: 'ACTIVE' },
        data: { status: 'EXPIRED' },
      });

      await tx.employerSubscription.create({
        data: {
          id: randomUUID(),
          employerId: input.employerId,
          planId: input.planId,
          status: 'ACTIVE',
          startsAt,
          endsAt,
          paymentId: input.paymentId,
        },
      });
    });
  }

  private async subscriptionPayload(employerId: string, paymentId: string) {
    const sub = await this.prisma.employerSubscription.findFirst({
      where: { employerId, paymentId },
    });
    return {
      ok: true as const,
      paymentId,
      planId: sub?.planId ?? null,
      active: Boolean(sub && sub.status === 'ACTIVE' && sub.endsAt > new Date()),
      endsAt: sub?.endsAt.toISOString() ?? null,
    };
  }

  private async expireStale(employerId: string) {
    await this.prisma.employerSubscription.updateMany({
      where: { employerId, status: 'ACTIVE', endsAt: { lte: new Date() } },
      data: { status: 'EXPIRED' },
    });
  }

  /** In-app renew reminders when employer opens Billing / subscription status (at most once per day). */
  private async maybeNotifySubscriptionLifecycle(userId: string, employerId: string) {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const active = await this.prisma.employerSubscription.findFirst({
      where: { employerId, status: 'ACTIVE', endsAt: { gt: now } },
      orderBy: { endsAt: 'desc' },
    });
    if (active) {
      const daysLeft = Math.ceil((active.endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      if (daysLeft > 7) return;
      const planName = getEmployerSubscriptionPlan(active.planId)?.name || active.planId;
      const recent = await this.prisma.notification.findFirst({
        where: {
          userId,
          type: 'BILLING',
          title: 'Subscription ending soon',
          createdAt: { gte: dayAgo },
        },
        select: { id: true },
      });
      if (recent) return;
      const endsOn = active.endsAt.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const rendered = renderDefaultNotification('SUBSCRIPTION_EXPIRING_SOON', {
        planName,
        endsOn,
        daysLeft: String(daysLeft),
      });
      await this.prisma.notification
        .create({
          data: {
            userId,
            title: rendered.title,
            body: rendered.body,
            type: 'BILLING',
            link: '/employer/payments',
          },
        })
        .catch(() => undefined);
      return;
    }

    const expired = await this.prisma.employerSubscription.findFirst({
      where: { employerId, status: 'EXPIRED' },
      orderBy: { endsAt: 'desc' },
    });
    if (!expired) return;
    const recent = await this.prisma.notification.findFirst({
      where: {
        userId,
        type: 'BILLING',
        title: 'Subscription expired',
        createdAt: { gte: dayAgo },
      },
      select: { id: true },
    });
    if (recent) return;
    const planName = getEmployerSubscriptionPlan(expired.planId)?.name || expired.planId;
    const rendered = renderDefaultNotification('SUBSCRIPTION_EXPIRED', { planName });
    await this.prisma.notification
      .create({
        data: {
          userId,
          title: rendered.title,
          body: rendered.body,
          type: 'BILLING',
          link: '/employer/payments',
        },
      })
      .catch(() => undefined);
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
}
