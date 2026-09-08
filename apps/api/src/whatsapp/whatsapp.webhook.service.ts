import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from './whatsapp.service';
import type { ReminderKind, WhatsAppWebhookBody } from './whatsapp.types';

@Injectable()
export class WhatsAppWebhookService {
  private readonly logger = new Logger(WhatsAppWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
    private readonly config: ConfigService,
  ) {}

  async handleWebhook(body: WhatsAppWebhookBody) {
    if (body.object !== 'whatsapp_business_account') {
      this.logger.debug(`Ignoring webhook object: ${body.object || 'unknown'}`);
      return { handled: false };
    }

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value) continue;

        for (const status of value.statuses || []) {
          await this.handleStatus(status);
        }

        for (const message of value.messages || []) {
          await this.handleInboundMessage(message, value.metadata?.display_phone_number);
        }
      }
    }
    return { handled: true };
  }

  /** Dev-only simulator for the admin test console. */
  async simulateButton(input: {
    action: 'CONFIRM' | 'RESCHEDULE' | 'SLOT' | 'DECLINE';
    interviewId: string;
    slotIso?: string;
    fromPhone?: string;
  }) {
    const raw =
      input.action === 'SLOT' && input.slotIso
        ? `SLOT:${input.interviewId}:${input.slotIso}`
        : `${input.action}:${input.interviewId}`;
    return this.applyInteractiveAction({
      from: input.fromPhone || 'simulator',
      payload: raw,
      messageId: `sim_${Date.now()}`,
    });
  }

  private async handleStatus(status: {
    id?: string;
    status?: string;
    timestamp?: string;
    recipient_id?: string;
  }) {
    if (!status.id || !status.status) return;
    await this.whatsapp.markDeliveryStatus(status.id, status.status, status.timestamp);
    const kind =
      status.status === 'delivered'
        ? 'MESSAGE_DELIVERED'
        : status.status === 'read'
          ? 'MESSAGE_READ'
          : status.status === 'failed'
            ? 'MESSAGE_FAILED'
            : 'INFO';
    this.whatsapp.events.push({
      kind,
      summary: `Status ${status.status} for ${status.id}`,
      detail: status,
    });
  }

  private async handleInboundMessage(
    message: {
      from?: string;
      id?: string;
      timestamp?: string;
      type?: string;
      text?: { body?: string };
      button?: { text?: string; payload?: string };
      interactive?: {
        type?: string;
        button_reply?: { id?: string; title?: string };
        list_reply?: { id?: string; title?: string };
      };
    },
    displayPhone?: string,
  ) {
    const from = message.from || 'unknown';
    const payload =
      message.button?.payload ||
      message.interactive?.button_reply?.id ||
      message.interactive?.list_reply?.id;
    const text =
      message.text?.body ||
      message.button?.text ||
      message.interactive?.button_reply?.title ||
      message.interactive?.list_reply?.title ||
      `[${message.type || 'unknown'}]`;

    this.logger.log(`WhatsApp inbound from ${from}: ${text}`);
    this.whatsapp.events.push({
      kind: payload ? 'BUTTON_CLICKED' : 'MESSAGE_RECEIVED',
      summary: payload ? `BUTTON ${payload}` : `Message from ${from}: ${text}`,
      detail: { from, text, payload, messageId: message.id },
    });

    const candidate = await this.findCandidateByPhone(from);
    await this.prisma.whatsAppMessage.create({
      data: {
        candidateId: candidate?.id || null,
        toPhone: displayPhone || this.config.get('WHATSAPP_DISPLAY_PHONE') || 'business',
        fromPhone: from,
        messageType: message.type || 'inbound',
        whatsappMessageId: message.id || null,
        direction: 'INBOUND',
        status: 'RECEIVED',
        payloadJson: JSON.stringify(message),
        sentAt: message.timestamp ? new Date(Number(message.timestamp) * 1000) : new Date(),
      },
    });

    // Template Quick Reply buttons often send only the button title (no interview id).
    const actionSeed = payload || text;
    if (actionSeed) {
      const parsed = this.whatsapp.parseInteractivePayload(actionSeed);
      if (parsed.action !== 'UNKNOWN') {
        await this.applyInteractiveAction({
          from,
          payload: actionSeed,
          messageId: message.id,
          candidateId: candidate?.id,
        });
        return;
      }
    }

    // Lightweight intent stubs (AI intent detection can replace this later).
    const lower = text.toLowerCase();
    if (lower.includes('reschedule') || lower.includes("can't attend") || lower.includes('cannot attend')) {
      const interview = await this.latestOpenInterviewForPhone(from, candidate?.id);
      if (interview) {
        await this.applyInteractiveAction({
          from,
          payload: `RESCHEDULE:${interview.id}`,
          messageId: message.id,
          candidateId: candidate?.id,
        });
      }
    }
  }

  async applyInteractiveAction(input: {
    from: string;
    payload: string;
    messageId?: string;
    candidateId?: string;
  }) {
    const parsed = this.whatsapp.parseInteractivePayload(input.payload);
    let interviewId = parsed.interviewId;
    if (!interviewId && parsed.action !== 'UNKNOWN') {
      const open = await this.latestOpenInterviewForPhone(input.from, input.candidateId);
      interviewId = open?.id;
    }
    this.whatsapp.events.push({
      kind: 'BUTTON_CLICKED',
      summary: `ACTION = ${parsed.action}`,
      detail: { ...parsed, interviewId },
    });

    if (!interviewId && parsed.action !== 'UNKNOWN') {
      return { ok: false, reason: 'Missing interview id in payload' };
    }

    if (parsed.action === 'CONFIRM' && interviewId) {
      const interview = await this.prisma.employerInterview.update({
        where: { id: interviewId },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          whatsappStatus: 'CONFIRMED_VIA_WA',
        },
        include: {
          application: { include: { candidate: { include: { user: true } }, job: true } },
        },
      });
      this.whatsapp.events.push({
        kind: 'INTERVIEW_STATUS',
        summary: `INTERVIEW_STATUS = CONFIRMED`,
        detail: { interviewId: interview.id },
      });
      const phone = this.resolveNotifyPhone(interview.application.candidate);
      if (phone) {
        await this.whatsapp.sendInterviewConfirmation({
          to: phone,
          candidateName: interview.application.candidate.firstName || 'there',
          scheduledAt: interview.scheduledAt,
          interviewId: interview.id,
          candidateId: interview.candidateId,
          timeZone: interview.timezone,
        });
      }
      return { ok: true, status: 'CONFIRMED', interviewId: interview.id };
    }

    if (parsed.action === 'RESCHEDULE' && interviewId) {
      const interview = await this.prisma.employerInterview.update({
        where: { id: interviewId },
        data: { status: 'RESCHEDULE_REQUESTED', whatsappStatus: 'RESCHEDULE_REQUESTED' },
        include: {
          application: { include: { candidate: { include: { user: true } }, job: true } },
        },
      });
      const slots = this.buildDefaultSlots(interview.scheduledAt);
      const phone = this.resolveNotifyPhone(interview.application.candidate);
      if (phone) {
        await this.whatsapp.sendRescheduleOptions({
          to: phone,
          interviewId: interview.id,
          slots,
          candidateId: interview.candidateId,
          timeZone: interview.timezone,
        });
      }
      this.whatsapp.events.push({
        kind: 'INTERVIEW_STATUS',
        summary: 'INTERVIEW_STATUS = RESCHEDULE_REQUESTED',
        detail: { interviewId: interview.id, slots },
      });
      return { ok: true, status: 'RESCHEDULE_REQUESTED', interviewId: interview.id, slots };
    }

    if (parsed.action === 'SLOT' && interviewId && parsed.slotIso) {
      const next = new Date(parsed.slotIso);
      if (Number.isNaN(next.getTime())) {
        return { ok: false, reason: 'Invalid slot' };
      }
      const interview = await this.prisma.employerInterview.findUnique({
        where: { id: interviewId },
      });
      if (!interview) return { ok: false, reason: 'Interview not found' };
      const scheduledEnd = new Date(next.getTime() + interview.durationMin * 60_000);
      const updated = await this.prisma.employerInterview.update({
        where: { id: interview.id },
        data: {
          scheduledAt: next,
          scheduledEnd,
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          whatsappStatus: 'RESCHEDULED_CONFIRMED',
        },
        include: {
          application: { include: { candidate: { include: { user: true } }, job: true } },
        },
      });
      const phone = this.resolveNotifyPhone(updated.application.candidate);
      if (phone) {
        await this.whatsapp.sendInterviewConfirmation({
          to: phone,
          candidateName: updated.application.candidate.firstName || 'there',
          scheduledAt: updated.scheduledAt,
          interviewId: updated.id,
          candidateId: updated.candidateId,
          timeZone: updated.timezone,
        });
      }
      this.whatsapp.events.push({
        kind: 'INTERVIEW_STATUS',
        summary: 'INTERVIEW_STATUS = RESCHEDULED + CONFIRMED',
        detail: { interviewId: updated.id, scheduledAt: updated.scheduledAt.toISOString() },
      });
      return { ok: true, status: 'CONFIRMED', interviewId: updated.id, scheduledAt: updated.scheduledAt };
    }

    if (parsed.action === 'DECLINE' && interviewId) {
      await this.prisma.employerInterview.update({
        where: { id: interviewId },
        data: { status: 'CANCELLED', whatsappStatus: 'DECLINED_VIA_WA' },
      });
      this.whatsapp.events.push({
        kind: 'INTERVIEW_STATUS',
        summary: 'INTERVIEW_STATUS = CANCELLED',
        detail: { interviewId },
      });
      return { ok: true, status: 'CANCELLED', interviewId };
    }

    return { ok: false, reason: 'Unhandled action', parsed };
  }

  async sendReminderNow(interviewId: string, kind: ReminderKind) {
    const interview = await this.prisma.employerInterview.findUnique({
      where: { id: interviewId },
      include: {
        application: { include: { candidate: { include: { user: true } }, job: true } },
      },
    });
    if (!interview) return { ok: false, reason: 'Interview not found' };
    const phone = this.resolveNotifyPhone(interview.application.candidate);
    if (!phone) return { ok: false, reason: 'Candidate has no WhatsApp/phone number' };
    const portalBase = this.config.get<string>('WEB_ORIGIN', 'http://localhost:3000').split(',')[0];
    const meetingUrl =
      interview.meetingUrl || `${portalBase}/interviews/scheduled/${interview.id}`;
    const sent = await this.whatsapp.sendReminder({
      to: phone,
      kind,
      candidateName: interview.application.candidate.firstName || 'there',
      jobTitle: interview.application.job.title,
      scheduledAt: interview.scheduledAt,
      interviewId: interview.id,
      candidateId: interview.candidateId,
      meetingUrl,
      timeZone: interview.timezone,
    });
    return { ok: sent.ok, sent };
  }

  buildDefaultSlots(from: Date) {
    const base = new Date(from.getTime());
    const offsetsHours = [3, 5, 27];
    return offsetsHours.map((hours) => new Date(base.getTime() + hours * 60 * 60 * 1000));
  }

  resolveNotifyPhone(candidate: {
    whatsappOptIn?: boolean;
    whatsappNumber?: string | null;
    user?: { phone?: string | null } | null;
  }) {
    // Opt-in preferred; for admin test / early integration allow fallback when WHATSAPP_REQUIRE_OPT_IN != true
    const requireOptIn = this.config.get('WHATSAPP_REQUIRE_OPT_IN') === 'true';
    if (requireOptIn && !candidate.whatsappOptIn) return null;
    return candidate.whatsappNumber || candidate.user?.phone || null;
  }

  private async findCandidateByPhone(waId: string) {
    const digits = waId.replace(/\D/g, '');
    const variants = [digits, digits.startsWith('91') ? digits.slice(2) : `91${digits}`];
    const user = await this.prisma.user.findFirst({
      where: {
        userType: 'CANDIDATE',
        OR: variants.flatMap((phone) => [
          { phone },
          { phone: `+${phone}` },
          { candidate: { whatsappNumber: phone } },
          { candidate: { whatsappNumber: `+${phone}` } },
        ]),
      },
      include: { candidate: true },
    });
    return user?.candidate || null;
  }

  private async latestOpenInterviewForPhone(waId: string, candidateId?: string) {
    if (candidateId) {
      return this.prisma.employerInterview.findFirst({
        where: {
          candidateId,
          status: { in: ['SCHEDULED', 'RESCHEDULE_REQUESTED', 'CONFIRMED'] },
        },
        orderBy: { scheduledAt: 'asc' },
      });
    }
    const candidate = await this.findCandidateByPhone(waId);
    if (!candidate) return null;
    return this.prisma.employerInterview.findFirst({
      where: {
        candidateId: candidate.id,
        status: { in: ['SCHEDULED', 'RESCHEDULE_REQUESTED', 'CONFIRMED'] },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }
}
