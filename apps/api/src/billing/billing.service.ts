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
  SRSB_INVOICE_SELLER,
  amountInWordsInr,
  computeSubscriptionGst,
  formatInrFromPaise,
  getEmployerSubscriptionPlan,
  indianStateToCode,
  listPublicEmployerSubscriptionPlans,
  type EmployerSubscriptionPlanId,
} from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PiiCryptoService } from '../common/crypto/pii-crypto.service';
import { renderDefaultNotification } from '../notifications/notification-templates';
import {
  razorpayConfigured,
  razorpayKeyId,
  razorpayMode,
  razorpayPublicStatus,
  subscriptionTestAmountPaise,
} from './razorpay.config';
import {
  createRazorpayOrder,
  fetchRazorpayOrder,
  fetchRazorpayOrderPayments,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from './razorpay.client';
import { employerSubscriptionsLive } from '../employers/employer-plan';

const PAID_PLAN_IDS = new Set(['starter', 'growth', 'business']);
const INVOICE_SEQ_KEY = 'employer_subscription_invoice_seq';

@Injectable()
export class BillingService {
  private readonly log = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pii: PiiCryptoService,
  ) {}

  listPublicPlans() {
    const testPaise = subscriptionTestAmountPaise();
    const plans = listPublicEmployerSubscriptionPlans().map((plan) => {
      if (plan.amountPaise == null || plan.contactSales) {
        return { ...plan, gst: null as ReturnType<typeof computeSubscriptionGst> | null };
      }
      const taxable = testPaise ?? plan.amountPaise;
      const gst = computeSubscriptionGst(taxable);
      const priceLabel =
        testPaise != null
          ? formatInrFromPaise(taxable)
          : plan.priceLabel;
      return {
        ...plan,
        amountPaise: taxable,
        priceLabel,
        priceHint:
          testPaise != null
            ? 'Test pricing · exclusive of GST'
            : 'One-time · exclusive of 18% GST',
        gst: {
          taxablePaise: gst.taxablePaise,
          gstPaise: gst.gstPaise,
          totalPaise: gst.totalPaise,
          gstRatePercent: gst.gstRatePercent,
          taxMode: gst.taxMode,
          cgstPaise: gst.cgstPaise,
          sgstPaise: gst.sgstPaise,
          igstPaise: gst.igstPaise,
        },
      };
    });
    return {
      currency: 'INR' as const,
      renewalType: 'manual' as const,
      gstNote: 'Listed plan prices are exclusive of 18% GST. Checkout charges taxable + GST.',
      notes: [
        'Active job posts are concurrent limits — closing a job frees a slot.',
        'Candidate database views are per subscription period and do not roll over.',
        'Opening applicants to your own jobs does not consume database views.',
        'Plan price is exclusive of GST; 18% GST is added at checkout (CGST+SGST or IGST by state).',
      ],
      plans,
      razorpay: razorpayPublicStatus(),
    };
  }

  paymentGatewayStatus() {
    return razorpayPublicStatus();
  }

  async getActiveSubscription(userId: string) {
    const employer = await this.requireEmployer(userId);
    await this.expireStale(employer.id);
    const row = await this.prisma.employerSubscription.findFirst({
      where: {
        employerId: employer.id,
        status: 'ACTIVE',
        endsAt: { gt: new Date() },
      },
      orderBy: { endsAt: 'desc' },
    });
    const isAdminGrant = row != null && row.paymentId == null;
    // LIVE off: only Super Admin grants override legacy free. Paid rows wait for LIVE=true.
    if (row && (employerSubscriptionsLive() || isAdminGrant)) {
      await this.maybeNotifySubscriptionLifecycle(employer.userId, employer.id);
      return {
        active: true as const,
        mode: razorpayMode(),
        planId: row.planId,
        endsAt: row.endsAt.toISOString(),
        paymentRequired: false,
        startsAt: row.startsAt.toISOString(),
        enforcement: 'subscription' as const,
        grantedWithoutPayment: isAdminGrant,
      };
    }
    // Prod safety: until EMPLOYER_SUBSCRIPTIONS_LIVE=true, treat as entitled (legacy free Starter).
    // Prevents web job-post gate from forcing checkout and breaking live employers.
    if (!employerSubscriptionsLive()) {
      return {
        active: true as const,
        mode: razorpayMode(),
        planId: null,
        endsAt: null,
        paymentRequired: false,
        enforcement: 'legacy' as const,
      };
    }
    await this.maybeNotifySubscriptionLifecycle(employer.userId, employer.id);
    return {
      active: false as const,
      mode: razorpayMode(),
      planId: null,
      endsAt: null,
      paymentRequired: true,
      enforcement: 'subscription' as const,
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
    const taxablePaise = subscriptionTestAmountPaise() ?? plan.amountPaise;

    const employer = await this.requireEmployer(userId);
    // Guide §7.1 — no checkout while employer is still UNVERIFIED (KYC not started).
    const status = String(
      employer.verified && employer.verificationStatus === 'UNVERIFIED'
        ? 'VERIFIED'
        : employer.verificationStatus || 'UNVERIFIED',
    ).toUpperCase();
    if (status === 'UNVERIFIED') {
      throw new ForbiddenException({
        code: SharedError.EMPLOYER_VERIFICATION_REQUIRED,
        message: 'Please complete employer account verification before purchasing a plan.',
      });
    }
    const buyerGstin = this.decryptEmployerGstin(employer.gstNumber);
    const stateHint = [employer.state, employer.city].filter(Boolean).join(' ');
    const gst = computeSubscriptionGst(taxablePaise, buyerGstin, stateHint);
    const amountPaise = gst.totalPaise;
    const priceLabel = formatInrFromPaise(taxablePaise);
    const receipt = `pl_${planId}_${Date.now().toString(36)}`.slice(0, 40);

    const payment = await this.prisma.employerPayment.create({
      data: {
        employerId: employer.id,
        planId: plan.id,
        amountPaise,
        taxablePaise: gst.taxablePaise,
        gstPaise: gst.gstPaise,
        currency: 'INR',
        status: 'PENDING',
        provider: 'razorpay',
        description: `Employer plan: ${plan.name} (excl. GST ${formatInrFromPaise(gst.taxablePaise)} + GST ${formatInrFromPaise(gst.gstPaise)})`,
      },
    });

    try {
      const order = await createRazorpayOrder({
        amountPaise,
        currency: 'INR',
        receipt,
        notes: {
          employerId: employer.id,
          paymentId: payment.id,
          planId: plan.id,
          taxablePaise: String(gst.taxablePaise),
          gstPaise: String(gst.gstPaise),
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
        amountPaise,
        taxablePaise: gst.taxablePaise,
        gstPaise: gst.gstPaise,
        currency: 'INR',
        keyId: razorpayMode() === 'mock' ? 'rzp_test_mock' : razorpayKeyId(),
        mode: razorpayMode(),
        gst: {
          taxablePaise: gst.taxablePaise,
          gstPaise: gst.gstPaise,
          totalPaise: gst.totalPaise,
          gstRatePercent: gst.gstRatePercent,
          taxMode: gst.taxMode,
          cgstPaise: gst.cgstPaise,
          sgstPaise: gst.sgstPaise,
          igstPaise: gst.igstPaise,
        },
        plan: {
          id: plan.id,
          name: plan.name,
          priceLabel,
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
    const payment = await this.prisma.employerPayment.findUnique({
      where: { id: input.paymentId },
      select: {
        enterpriseOfferId: true,
        amountPaise: true,
        taxablePaise: true,
        gstPaise: true,
        description: true,
      },
    });
    let days = plan?.durationDays ?? 30;
    let entitlementsJson: string | null = null;
    if (payment?.enterpriseOfferId) {
      const offer = await this.prisma.employerEnterpriseOffer.findUnique({
        where: { id: payment.enterpriseOfferId },
      });
      if (offer) {
        days = offer.durationDays;
        entitlementsJson = JSON.stringify({
          activeJobLimit: offer.activeJobLimit,
          loginSeats: offer.loginSeats,
          candidateViewCredits: offer.candidateViewCredits,
          advancedCandidateFilters: true,
          candidateDatabaseShortlist: true,
          jobPerformanceReports: true,
        });
      }
    } else if (plan) {
      entitlementsJson = JSON.stringify({
        activeJobLimit: plan.activeJobLimit,
        loginSeats: plan.loginSeats,
        candidateViewCredits: plan.candidateViewCredits,
        ...plan.entitlements,
      });
    }
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

      if (payment?.enterpriseOfferId) {
        await tx.employerEnterpriseOffer.updateMany({
          where: { id: payment.enterpriseOfferId, status: { in: ['APPROVED', 'PENDING'] } },
          data: { status: 'PURCHASED' },
        });
      }

      await tx.employerSubscription.updateMany({
        where: { employerId: input.employerId, status: 'ACTIVE' },
        data: { status: 'EXPIRED' },
      });

      await tx.employerSubscription.create({
        data: {
          id: randomUUID(),
          employerId: input.employerId,
          planId: input.planId,
          entitlementsJson,
          status: 'ACTIVE',
          startsAt,
          endsAt,
          paymentId: input.paymentId,
        },
      });
    });

    try {
      await this.issueSubscriptionInvoice({
        paymentId: input.paymentId,
        employerId: input.employerId,
        planId: input.planId,
        issuedAt: startsAt,
      });
    } catch (err) {
      this.log.error(`Invoice issue failed for payment ${input.paymentId}`, err as Error);
    }

    await this.notifyPaymentSuccess(input.employerId, {
      planId: input.planId,
      amountPaise: payment?.amountPaise ?? plan?.amountPaise ?? 0,
      endsAt,
    });
  }

  private decryptEmployerGstin(stored: string | null | undefined): string | null {
    if (!stored) return null;
    try {
      const raw = this.pii.decrypt('employers.gst_number', stored);
      const g = String(raw || '')
        .trim()
        .toUpperCase();
      return g.length >= 15 ? g : null;
    } catch {
      const g = String(stored || '')
        .trim()
        .toUpperCase();
      return g.length >= 15 && !g.includes(':') ? g : null;
    }
  }

  private async nextInvoiceNumber(tx: {
    platformSetting: {
      findUnique: PrismaService['platformSetting']['findUnique'];
      upsert: PrismaService['platformSetting']['upsert'];
    };
  }) {
    const row = await tx.platformSetting.findUnique({ where: { key: INVOICE_SEQ_KEY } });
    const next = Math.max(1, Number(row?.value || '0') + 1);
    await tx.platformSetting.upsert({
      where: { key: INVOICE_SEQ_KEY },
      create: { key: INVOICE_SEQ_KEY, value: String(next) },
      update: { value: String(next) },
    });
    return `SRSB${String(next).padStart(4, '0')}`;
  }

  private async issueSubscriptionInvoice(input: {
    paymentId: string;
    employerId: string;
    planId: string;
    issuedAt: Date;
  }) {
    const existing = await this.prisma.employerInvoice.findUnique({
      where: { paymentId: input.paymentId },
    });
    if (existing) return existing;

    const payment = await this.prisma.employerPayment.findUnique({
      where: { id: input.paymentId },
    });
    if (!payment || payment.status !== 'PAID') return null;

    const employer = await this.prisma.employer.findUnique({
      where: { id: input.employerId },
      include: { company: true },
    });
    if (!employer) return null;

    const buyerGstin = this.decryptEmployerGstin(employer.gstNumber);
    const stateHint = [employer.state, employer.city].filter(Boolean).join(' ');
    const taxable =
      payment.taxablePaise != null
        ? payment.taxablePaise
        : Math.round(payment.amountPaise / 1.18);
    // Prefer stored payment GST split; recompute mode from GSTIN/state so KA → CGST+SGST.
    const gst = computeSubscriptionGst(taxable, buyerGstin, stateHint);
    const totalPaise = payment.amountPaise;
    const gstPaise = payment.gstPaise ?? gst.gstPaise;
    let cgstPaise = 0;
    let sgstPaise = 0;
    let igstPaise = 0;
    if (gst.taxMode === 'CGST_SGST') {
      cgstPaise = Math.floor(gstPaise / 2);
      sgstPaise = gstPaise - cgstPaise;
    } else {
      igstPaise = gstPaise;
    }
    const plan = getEmployerSubscriptionPlan(input.planId);
    const lineDescription = `CareerBridge employer subscription — ${plan?.name || input.planId} plan`;

    return this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.nextInvoiceNumber(tx);
      return tx.employerInvoice.create({
        data: {
          id: randomUUID(),
          invoiceNumber,
          paymentId: input.paymentId,
          employerId: input.employerId,
          planId: input.planId,
          sacCode: gst.sac,
          sellerName: SRSB_INVOICE_SELLER.legalName,
          sellerGstin: SRSB_INVOICE_SELLER.gstin,
          sellerAddress: SRSB_INVOICE_SELLER.addressLine,
          sellerEmail: SRSB_INVOICE_SELLER.email,
          sellerPhone: SRSB_INVOICE_SELLER.phone,
          buyerName: employer.companyName || employer.company?.name || 'Employer',
          buyerGstin,
          buyerStateCode: gst.buyerStateCode || indianStateToCode(stateHint),
          buyerAddress: [employer.city, employer.state].filter(Boolean).join(', ') || null,
          placeOfSupply: gst.placeOfSupply,
          taxMode: gst.taxMode,
          lineDescription,
          taxablePaise: taxable,
          cgstPaise,
          sgstPaise,
          igstPaise,
          gstRatePercent: gst.gstRatePercent,
          totalPaise,
          amountInWords: amountInWordsInr(totalPaise),
          currency: payment.currency || 'INR',
          status: 'ISSUED',
          issuedAt: input.issuedAt,
        },
      });
    });
  }

  async listMyInvoices(userId: string) {
    const employer = await this.requireEmployer(userId);
    const rows = await this.prisma.employerInvoice.findMany({
      where: { employerId: employer.id },
      orderBy: { issuedAt: 'desc' },
      include: {
        payment: { select: { status: true, razorpayPaymentId: true, paidAt: true } },
      },
    });
    return {
      invoices: rows.map((row) => this.serializeInvoice(row)),
    };
  }

  async getMyInvoice(userId: string, invoiceIdRaw: string) {
    const employer = await this.requireEmployer(userId);
    const id = String(invoiceIdRaw || '').trim();
    const row = await this.prisma.employerInvoice.findFirst({
      where: {
        employerId: employer.id,
        OR: [{ id }, { invoiceNumber: id }],
      },
      include: {
        payment: { select: { status: true, razorpayPaymentId: true, paidAt: true, planId: true } },
      },
    });
    if (!row) {
      throw new NotFoundException({
        code: SharedError.RESOURCE_NOT_FOUND,
        message: 'Invoice was not found.',
      });
    }
    return {
      invoice: this.serializeInvoice(row),
      sellerBank: SRSB_INVOICE_SELLER.bank,
    };
  }

  private serializeInvoice(
    row: {
      id: string;
      invoiceNumber: string;
      paymentId: string;
      employerId: string;
      planId: string | null;
      sacCode: string;
      sellerName: string;
      sellerGstin: string;
      sellerAddress: string;
      sellerEmail: string | null;
      sellerPhone: string | null;
      buyerName: string;
      buyerGstin: string | null;
      buyerStateCode: string | null;
      buyerAddress: string | null;
      placeOfSupply: string;
      taxMode: string;
      lineDescription: string;
      taxablePaise: number;
      cgstPaise: number;
      sgstPaise: number;
      igstPaise: number;
      gstRatePercent: number;
      totalPaise: number;
      amountInWords: string;
      currency: string;
      status: string;
      issuedAt: Date;
      payment?: {
        status?: string;
        razorpayPaymentId?: string | null;
        paidAt?: Date | null;
        planId?: string | null;
      } | null;
    },
  ) {
    return {
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      paymentId: row.paymentId,
      employerId: row.employerId,
      planId: row.planId,
      sacCode: row.sacCode,
      seller: {
        name: row.sellerName,
        gstin: row.sellerGstin,
        address: row.sellerAddress,
        email: row.sellerEmail,
        phone: row.sellerPhone,
      },
      buyer: {
        name: row.buyerName,
        gstin: row.buyerGstin,
        stateCode: row.buyerStateCode,
        address: row.buyerAddress,
      },
      placeOfSupply: row.placeOfSupply,
      taxMode: row.taxMode,
      lineDescription: row.lineDescription,
      taxablePaise: row.taxablePaise,
      cgstPaise: row.cgstPaise,
      sgstPaise: row.sgstPaise,
      igstPaise: row.igstPaise,
      gstRatePercent: row.gstRatePercent,
      totalPaise: row.totalPaise,
      amountInWords: row.amountInWords,
      currency: row.currency,
      status: row.status,
      issuedAt: row.issuedAt.toISOString(),
      paymentStatus: row.payment?.status ?? null,
      razorpayPaymentId: row.payment?.razorpayPaymentId ?? null,
      paidAt: row.payment?.paidAt?.toISOString() ?? null,
    };
  }

  /** Guide §12 — checkout an admin-approved Enterprise offer (server-side amount only). */
  async createEnterpriseOfferOrder(userId: string, offerIdRaw: string) {
    if (!razorpayConfigured()) {
      throw new ServiceUnavailableException({
        code: SharedError.BUSINESS_RULE_VIOLATION,
        message: 'Payment gateway is not configured. Add Razorpay keys in the API environment.',
      });
    }
    const employer = await this.requireEmployer(userId);
    const status = String(
      employer.verified && employer.verificationStatus === 'UNVERIFIED'
        ? 'VERIFIED'
        : employer.verificationStatus || 'UNVERIFIED',
    ).toUpperCase();
    if (status === 'UNVERIFIED') {
      throw new ForbiddenException({
        code: SharedError.EMPLOYER_VERIFICATION_REQUIRED,
        message: 'Please complete employer account verification before purchasing a plan.',
      });
    }

    const offerId = String(offerIdRaw || '').trim();
    const offer = await this.prisma.employerEnterpriseOffer.findFirst({
      where: { id: offerId, employerId: employer.id },
    });
    if (!offer || offer.status !== 'APPROVED') {
      throw new BadRequestException({
        code: SharedError.ENTERPRISE_OFFER_UNAVAILABLE,
        message: 'This Enterprise offer is not available. Contact support if you need a new quote.',
      });
    }
    if (offer.expiresAt && offer.expiresAt.getTime() <= Date.now()) {
      await this.prisma.employerEnterpriseOffer.update({
        where: { id: offer.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException({
        code: SharedError.ENTERPRISE_OFFER_UNAVAILABLE,
        message: 'This Enterprise offer has expired. Ask support for a refreshed offer.',
      });
    }

    const buyerGstin = this.decryptEmployerGstin(employer.gstNumber);
    const stateHint = [employer.state, employer.city].filter(Boolean).join(' ');
    const gst = computeSubscriptionGst(offer.amountPaise, buyerGstin, stateHint);
    const amountPaise = gst.totalPaise;
    const receipt = `ent_${offer.id.slice(0, 8)}_${Date.now().toString(36)}`.slice(0, 40);
    const payment = await this.prisma.employerPayment.create({
      data: {
        employerId: employer.id,
        planId: 'enterprise',
        enterpriseOfferId: offer.id,
        amountPaise,
        taxablePaise: gst.taxablePaise,
        gstPaise: gst.gstPaise,
        currency: offer.currency || 'INR',
        status: 'PENDING',
        provider: 'razorpay',
        description: `Enterprise offer ${offer.id.slice(0, 8)} (excl. GST ${formatInrFromPaise(gst.taxablePaise)} + GST ${formatInrFromPaise(gst.gstPaise)})`,
      },
    });

    try {
      const order = await createRazorpayOrder({
        amountPaise,
        currency: offer.currency || 'INR',
        receipt,
        notes: {
          employerId: employer.id,
          paymentId: payment.id,
          planId: 'enterprise',
          enterpriseOfferId: offer.id,
          taxablePaise: String(gst.taxablePaise),
          gstPaise: String(gst.gstPaise),
        },
      });
      await this.prisma.employerPayment.update({
        where: { id: payment.id },
        data: { razorpayOrderId: order.id, providerRef: order.id },
      });
      return {
        paymentId: payment.id,
        orderId: order.id,
        amountPaise,
        taxablePaise: gst.taxablePaise,
        gstPaise: gst.gstPaise,
        currency: offer.currency || 'INR',
        keyId: razorpayMode() === 'mock' ? 'rzp_test_mock' : razorpayKeyId(),
        mode: razorpayMode(),
        offerId: offer.id,
        gst: {
          taxablePaise: gst.taxablePaise,
          gstPaise: gst.gstPaise,
          totalPaise: gst.totalPaise,
          gstRatePercent: gst.gstRatePercent,
          taxMode: gst.taxMode,
          cgstPaise: gst.cgstPaise,
          sgstPaise: gst.sgstPaise,
          igstPaise: gst.igstPaise,
        },
        plan: {
          id: 'enterprise' as const,
          name: 'Enterprise',
          priceLabel: formatInrFromPaise(gst.taxablePaise),
          periodLabel: ` / ${offer.durationDays} days`,
          durationDays: offer.durationDays,
        },
      };
    } catch (err) {
      await this.prisma.employerPayment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
      });
      this.log.error(`Razorpay enterprise order failed for payment ${payment.id}`, err as Error);
      throw new ServiceUnavailableException({
        code: SharedError.BUSINESS_RULE_VIOLATION,
        message: 'Could not start checkout. Please try again in a moment.',
      });
    }
  }

  async listMyEnterpriseOffers(userId: string) {
    const employer = await this.requireEmployer(userId);
    const now = new Date();
    const rows = await this.prisma.employerEnterpriseOffer.findMany({
      where: {
        employerId: employer.id,
        status: 'APPROVED',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: 'desc' },
    });
    return {
      offers: rows.map((o) => ({
        id: o.id,
        amountPaise: o.amountPaise,
        currency: o.currency,
        durationDays: o.durationDays,
        activeJobLimit: o.activeJobLimit,
        loginSeats: o.loginSeats,
        candidateViewCredits: o.candidateViewCredits,
        expiresAt: o.expiresAt?.toISOString() ?? null,
        notes: o.notes,
      })),
    };
  }

  private async notifyPaymentSuccess(
    employerId: string,
    input: { planId: string; amountPaise: number; endsAt: Date },
  ) {
    const employer = await this.prisma.employer.findUnique({
      where: { id: employerId },
      select: { userId: true },
    });
    if (!employer) return;
    const planName = getEmployerSubscriptionPlan(input.planId)?.name || input.planId;
    const amount = `₹${Math.round((input.amountPaise || 0) / 100).toLocaleString('en-IN')}`;
    const endsOn = input.endsAt.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const rendered = renderDefaultNotification('PAYMENT_SUCCESS', {
      planName,
      amount,
      endsOn,
    });
    await this.prisma.notification
      .create({
        data: {
          userId: employer.userId,
          title: rendered.title,
          body: rendered.body,
          type: 'BILLING',
          link: '/employer/payments',
        },
      })
      .catch(() => undefined);
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
