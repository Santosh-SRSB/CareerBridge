import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudTasksService } from '../common/tasks/cloud-tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from './whatsapp.service';
import {
  buildDefaultRescheduleSlots,
  isOfferedRescheduleSlot,
  isReminderStillValid,
  phonesMatch,
} from './interview-lifecycle.util';
import type { ReminderKind, WhatsAppWebhookBody } from './whatsapp.types';

@Injectable()
export class WhatsAppWebhookService {
  private readonly logger = new Logger(WhatsAppWebhookService.name);
  /** In-process idempotency for Meta retries (also backed by unique whatsapp_message_id). */
  private readonly processedInboundIds = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
    private readonly config: ConfigService,
    private readonly cloudTasks: CloudTasksService,
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
      skipOwnership: true,
    });
  }

  private async handleStatus(status: {
    id?: string;
    status?: string;
    timestamp?: string;
    recipient_id?: string;
    errors?: Array<{ code?: number; title?: string; message?: string }>;
  }) {
    if (!status.id || !status.status) return;
    await this.whatsapp.markDeliveryStatus(status.id, status.status, status.timestamp);
    if (status.status === 'failed' && status.errors?.length) {
      await this.prisma.whatsAppMessage
        .updateMany({
          where: { whatsappMessageId: status.id },
          data: {
            errorJson: JSON.stringify(
              status.errors.map((e) => ({
                code: e.code,
                title: e.title,
                // Avoid storing raw payloads that may include PII beyond Meta error text
                message: e.message?.slice(0, 200),
              })),
            ),
          },
        })
        .catch(() => undefined);
    }
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
      detail: { whatsappMessageId: status.id, status: status.status },
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
    if (message.id) {
      if (this.processedInboundIds.has(message.id)) {
        this.logger.log(`Duplicate WhatsApp inbound ignored: ${message.id}`);
        return;
      }
      const existing = await this.prisma.whatsAppMessage.findFirst({
        where: { whatsappMessageId: message.id },
      });
      if (existing) {
        this.processedInboundIds.add(message.id);
        this.logger.log(`Duplicate WhatsApp inbound (DB) ignored: ${message.id}`);
        return;
      }
    }

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

    this.logger.log(`WhatsApp inbound from ${from}: type=${message.type || 'unknown'}`);
    this.whatsapp.events.push({
      kind: payload ? 'BUTTON_CLICKED' : 'MESSAGE_RECEIVED',
      summary: payload ? `BUTTON ${payload}` : `Message from ${from}`,
      detail: { from, payload, messageId: message.id },
    });

    const candidate = await this.findCandidateByPhone(from);
    try {
      await this.prisma.whatsAppMessage.create({
        data: {
          candidateId: candidate?.id || null,
          toPhone: displayPhone || this.config.get('WHATSAPP_DISPLAY_PHONE') || 'business',
          fromPhone: from,
          messageType: message.type || 'inbound',
          whatsappMessageId: message.id || null,
          direction: 'INBOUND',
          status: 'RECEIVED',
          payloadJson: JSON.stringify({ type: message.type, payload, id: message.id }),
          sentAt: message.timestamp ? new Date(Number(message.timestamp) * 1000) : new Date(),
        },
      });
    } catch {
      // Unique whatsapp_message_id — Meta retry
      if (message.id) this.processedInboundIds.add(message.id);
      return;
    }
    if (message.id) this.processedInboundIds.add(message.id);

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
    /** Admin simulator may skip phone ownership checks. */
    skipOwnership?: boolean;
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
      detail: { action: parsed.action, interviewId },
    });

    if (!interviewId && parsed.action !== 'UNKNOWN') {
      return { ok: false, reason: 'Missing interview id in payload' };
    }

    if (interviewId && !input.skipOwnership) {
      const owned = await this.assertCandidateOwnsInterview({
        interviewId,
        from: input.from,
        candidateId: input.candidateId,
      });
      if (!owned.ok) return owned;
    }

    if (parsed.action === 'CONFIRM' && interviewId) {
      return this.confirmInterview(interviewId);
    }

    if (parsed.action === 'RESCHEDULE' && interviewId) {
      return this.requestReschedule(interviewId);
    }

    if (parsed.action === 'SLOT' && interviewId && parsed.slotIso) {
      return this.selectRescheduleSlot(interviewId, parsed.slotIso);
    }

    if (parsed.action === 'DECLINE' && interviewId) {
      return this.declineInterview(interviewId);
    }

    if (parsed.action === 'START' && interviewId) {
      return this.sendStartLink(interviewId);
    }

    return { ok: false, reason: 'Unhandled action', parsed };
  }

  private async assertCandidateOwnsInterview(input: {
    interviewId: string;
    from: string;
    candidateId?: string;
  }) {
    const interview = await this.prisma.employerInterview.findUnique({
      where: { id: input.interviewId },
      include: { application: { include: { candidate: { include: { user: true } } } } },
    });
    if (!interview) return { ok: false as const, reason: 'Interview not found' };

    if (input.candidateId && interview.candidateId !== input.candidateId) {
      this.logger.warn(`WhatsApp action rejected — candidate mismatch for ${input.interviewId}`);
      return { ok: false as const, reason: 'unauthorized_candidate' };
    }

    if (input.from === 'simulator' || input.from === 'unknown') {
      return { ok: true as const, interview };
    }

    const candidatePhone =
      interview.application.candidate.whatsappNumber || interview.application.candidate.user?.phone;
    if (candidatePhone && !phonesMatch(candidatePhone, input.from)) {
      // Allow if inbound phone maps to the same candidate via DB lookup
      const byPhone = await this.findCandidateByPhone(input.from);
      if (!byPhone || byPhone.id !== interview.candidateId) {
        this.logger.warn(`WhatsApp action rejected — phone ownership for ${input.interviewId}`);
        return { ok: false as const, reason: 'unauthorized_candidate' };
      }
    }

    return { ok: true as const, interview };
  }

  private async confirmInterview(interviewId: string) {
    const existing = await this.prisma.employerInterview.findUnique({
      where: { id: interviewId },
      include: {
        application: { include: { candidate: { include: { user: true } }, job: true } },
      },
    });
    if (!existing) return { ok: false, reason: 'Interview not found' };

    if (existing.status === 'CANCELLED' || existing.status === 'COMPLETED') {
      return { ok: false, reason: `cannot_confirm_${existing.status}`, interviewId };
    }

    // Idempotent: already confirmed — do not re-send confirmation
    if (existing.status === 'CONFIRMED' && existing.whatsappStatus === 'CONFIRMED_VIA_WA') {
      this.whatsapp.events.push({
        kind: 'INTERVIEW_STATUS',
        summary: 'INTERVIEW_STATUS = CONFIRMED (idempotent)',
        detail: { interviewId },
      });
      return { ok: true, status: 'CONFIRMED', interviewId, idempotent: true };
    }

    const interview = await this.prisma.employerInterview.update({
      where: { id: interviewId },
      data: {
        status: 'CONFIRMED',
        confirmedAt: existing.confirmedAt || new Date(),
        whatsappStatus: 'CONFIRMED_VIA_WA',
      },
      include: {
        application: { include: { candidate: { include: { user: true } }, job: true } },
      },
    });
    this.whatsapp.events.push({
      kind: 'INTERVIEW_STATUS',
      summary: 'INTERVIEW_STATUS = CONFIRMED',
      detail: { interviewId: interview.id },
    });
    this.logger.log(`Interview confirmation received interviewId=${interview.id}`);

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
    await this.scheduleReminders(interview.id, interview.scheduledAt);
    return { ok: true, status: 'CONFIRMED', interviewId: interview.id };
  }

  private async requestReschedule(interviewId: string) {
    const interview = await this.prisma.employerInterview.update({
      where: { id: interviewId },
      data: { status: 'RESCHEDULE_REQUESTED', whatsappStatus: 'RESCHEDULE_REQUESTED' },
      include: {
        application: { include: { candidate: { include: { user: true } }, job: true } },
      },
    });
    const slots = buildDefaultRescheduleSlots(interview.scheduledAt);
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
      detail: { interviewId: interview.id, slotCount: slots.length },
    });
    this.logger.log(`Interview reschedule received interviewId=${interview.id}`);
    return { ok: true, status: 'RESCHEDULE_REQUESTED', interviewId: interview.id, slots };
  }

  private async selectRescheduleSlot(interviewId: string, slotIso: string) {
    const interview = await this.prisma.employerInterview.findUnique({
      where: { id: interviewId },
    });
    if (!interview) return { ok: false, reason: 'Interview not found' };
    if (interview.status === 'CANCELLED' || interview.status === 'COMPLETED') {
      return { ok: false, reason: `cannot_reschedule_${interview.status}` };
    }

    // Always revalidate — never trust the slot just because it was previously displayed.
    if (!isOfferedRescheduleSlot(interview.scheduledAt, slotIso)) {
      this.logger.warn(`Rejected unavailable/invalid slot for ${interviewId}`);
      return { ok: false, reason: 'slot_unavailable' };
    }

    const next = new Date(slotIso);
    const scheduledEnd = new Date(next.getTime() + interview.durationMin * 60_000);

    // Prevent double-booking same candidate overlapping window
    const conflict = await this.prisma.employerInterview.findFirst({
      where: {
        candidateId: interview.candidateId,
        id: { not: interview.id },
        status: { in: ['SCHEDULED', 'CONFIRMED', 'RESCHEDULE_REQUESTED'] },
        scheduledAt: { lt: scheduledEnd },
        OR: [
          { scheduledEnd: { gt: next } },
          { scheduledEnd: null, scheduledAt: { gte: next } },
        ],
      },
    });
    if (conflict) {
      return { ok: false, reason: 'slot_conflict' };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.employerInterview.findUnique({ where: { id: interview.id } });
      if (!locked) throw new Error('Interview not found');
      if (!isOfferedRescheduleSlot(locked.scheduledAt, slotIso)) {
        throw new Error('slot_unavailable');
      }
      return tx.employerInterview.update({
        where: { id: locked.id },
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
    }).catch((err: Error) => {
      this.logger.warn(`Slot claim failed: ${err.message}`);
      return null;
    });

    if (!updated) return { ok: false, reason: 'slot_unavailable' };

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
    await this.scheduleReminders(updated.id, updated.scheduledAt);
    this.whatsapp.events.push({
      kind: 'INTERVIEW_STATUS',
      summary: 'INTERVIEW_STATUS = RESCHEDULED + CONFIRMED',
      detail: { interviewId: updated.id, scheduledAt: updated.scheduledAt.toISOString() },
    });
    return { ok: true, status: 'CONFIRMED', interviewId: updated.id, scheduledAt: updated.scheduledAt };
  }

  private async declineInterview(interviewId: string) {
    const existing = await this.prisma.employerInterview.findUnique({ where: { id: interviewId } });
    if (!existing) return { ok: false, reason: 'Interview not found' };
    if (existing.status === 'CANCELLED') {
      return { ok: true, status: 'CANCELLED', interviewId, idempotent: true };
    }
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

  private async sendStartLink(interviewId: string) {
    const interview = await this.prisma.employerInterview.findUnique({
      where: { id: interviewId },
      include: {
        application: { include: { candidate: { include: { user: true } }, job: true } },
      },
    });
    if (!interview) return { ok: false, reason: 'Interview not found' };
    if (!['CONFIRMED', 'SCHEDULED'].includes(interview.status)) {
      return { ok: false, reason: `cannot_start_${interview.status}` };
    }
    const phone = this.resolveNotifyPhone(interview.application.candidate);
    if (!phone) return { ok: false, reason: 'no_phone' };
    const portalBase = this.config.get<string>('WEB_ORIGIN', 'http://localhost:3000').split(',')[0];
    const meetingUrl =
      interview.meetingUrl || `${portalBase}/interviews/scheduled/${interview.id}`;
    await this.whatsapp.sendText({
      to: phone,
      body: `Start your interview here: ${meetingUrl}`,
      candidateId: interview.candidateId,
      interviewId: interview.id,
      messageType: 'interview_start_link',
    });
    return { ok: true, status: 'START_LINK_SENT', interviewId, meetingUrl };
  }

  async sendReminderNow(interviewId: string, kind: ReminderKind) {
    const interview = await this.prisma.employerInterview.findUnique({
      where: { id: interviewId },
      include: {
        application: { include: { candidate: { include: { user: true } }, job: true } },
      },
    });
    if (!interview) return { ok: false, reason: 'Interview not found' };

    const validity = isReminderStillValid({
      status: interview.status,
      scheduledAt: interview.scheduledAt,
      kind,
    });
    if (!validity.ok) {
      this.logger.log(
        `Reminder skipped interviewId=${interviewId} kind=${kind} reason=${validity.reason}`,
      );
      this.whatsapp.events.push({
        kind: 'INFO',
        summary: `Reminder ${kind} skipped (${validity.reason})`,
        detail: { interviewId, kind },
      });
      return { ok: false, reason: validity.reason };
    }

    const phone = this.resolveNotifyPhone(interview.application.candidate);
    if (!phone) return { ok: false, reason: 'Candidate has no WhatsApp/phone number' };
    const portalBase = this.config.get<string>('WEB_ORIGIN', 'http://localhost:3000').split(',')[0];
    const meetingUrl =
      interview.meetingUrl || `${portalBase}/interviews/scheduled/${interview.id}`;
    this.logger.log(`Reminder task executed interviewId=${interviewId} kind=${kind}`);
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

  /** After confirm / reschedule — enqueue T-24h, T-2h, T-15m via Cloud Tasks. */
  async scheduleReminders(interviewId: string, scheduledAt: Date) {
    const kinds: Array<{ kind: ReminderKind; msBefore: number }> = [
      { kind: '24h', msBefore: 24 * 60 * 60 * 1000 },
      { kind: '2h', msBefore: 2 * 60 * 60 * 1000 },
      { kind: '15m', msBefore: 15 * 60 * 1000 },
    ];
    for (const item of kinds) {
      const runAt = new Date(scheduledAt.getTime() - item.msBefore);
      if (runAt.getTime() <= Date.now()) continue;
      await this.cloudTasks.enqueueWhatsAppJob(
        { type: 'interview_reminder', interviewId, kind: item.kind },
        () => this.sendReminderNow(interviewId, item.kind),
        runAt,
      );
    }
  }

  buildDefaultSlots(from: Date) {
    return buildDefaultRescheduleSlots(from);
  }

  resolveNotifyPhone(candidate: {
    whatsappOptIn?: boolean;
    whatsappNumber?: string | null;
    user?: { phone?: string | null } | null;
  }) {
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
