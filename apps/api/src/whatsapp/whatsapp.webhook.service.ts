import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudTasksService } from '../common/tasks/cloud-tasks.service';
import { candidateRescheduleUrl, interviewMeetingUrl } from '../common/web/public-web-url';
import { DEFAULT_INTERVIEW_TIMEZONE, isReschedulePending, isValidTimeZone } from '../employers/employer-policy';
import { InterviewAvailabilityService } from '../interview-availability/interview-availability.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from './whatsapp.service';
import { consentedWhatsAppNumber, isReminderStillValid, phonesMatch } from './interview-lifecycle.util';
import { formatInterviewWhen, resolveTemplateName } from './whatsapp.templates';
import {
  FLOW_TOKEN_TTL_MS,
  flowTokenKey,
  parseFlowSubmission,
  rescheduleFlowScreenData,
  signFlowToken,
  verifyFlowToken,
} from './whatsapp-flow.util';
import type { ReminderKind, WhatsAppWebhookBody } from './whatsapp.types';

const OPEN_INTERVIEW_STATUSES = ['SCHEDULED', 'CONFIRMED', 'RESCHEDULE_NEEDED', 'RESCHEDULE_REQUESTED'] as const;
const RESCHEDULABLE_STATUSES = ['PROPOSED', 'SCHEDULED', 'CONFIRMED'] as const;
/** A confirmed interview is not re-opened by a Flow; the candidate must start from "Choose Another Time". */
const FLOW_SUBMITTABLE_STATUSES = ['PROPOSED', 'SCHEDULED', 'RESCHEDULE_NEEDED', 'RESCHEDULE_REQUESTED'] as const;
const FLOW_CLOSED_TEXT = 'This interview is no longer active, so it cannot be rescheduled.';

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
    private readonly notifications: NotificationsService,
    private readonly availability?: InterviewAvailabilityService,
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
      context?: { id?: string; from?: string };
      text?: { body?: string };
      button?: { text?: string; payload?: string };
      interactive?: {
        type?: string;
        button_reply?: { id?: string; title?: string };
        list_reply?: { id?: string; title?: string };
        nfm_reply?: { name?: string; body?: string; response_json?: string };
      };
    },
    displayPhone?: string,
  ) {
    const contextMessageId = message.context?.id;
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

    const nfm = message.interactive?.type === 'nfm_reply' ? message.interactive.nfm_reply : undefined;
    if (nfm) {
      if (!nfm.name || nfm.name === 'flow') {
        await this.handleFlowSubmission({ from, responseJson: nfm.response_json });
      }
      return;
    }

    const actionSeed = payload || text;
    if (actionSeed) {
      const parsed = this.whatsapp.parseInteractivePayload(actionSeed);
      if (parsed.action !== 'UNKNOWN') {
        await this.applyInteractiveAction({
          from,
          payload: actionSeed,
          messageId: message.id,
          candidateId: candidate?.id,
          contextMessageId,
        });
        return;
      }
    }

    const lower = text.toLowerCase();
    if (lower.includes('reschedule') || lower.includes("can't attend") || lower.includes('cannot attend')) {
      const interviewId =
        (await this.interviewIdFromContext(contextMessageId)) ||
        (await this.latestOpenInterviewForPhone(from, candidate?.id))?.id;
      if (interviewId) {
        await this.applyInteractiveAction({
          from,
          payload: `RESCHEDULE:${interviewId}`,
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
    /** wamid of our message the candidate tapped (template quick replies carry no interview id). */
    contextMessageId?: string;
    /** Admin simulator may skip phone ownership checks. */
    skipOwnership?: boolean;
  }) {
    const parsed = this.whatsapp.parseInteractivePayload(input.payload);
    let interviewId = parsed.interviewId;
    if (!interviewId && parsed.action !== 'UNKNOWN') {
      interviewId = await this.interviewIdFromContext(input.contextMessageId);
    }
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
      if (await this.isStaleInvitationTap(interviewId, input.contextMessageId)) {
        return this.replyToCandidate(
          interviewId,
          'This interview time has changed. Please use the latest interview message to confirm.',
          'stale_invitation',
        );
      }
      return this.confirmInterview(interviewId);
    }

    // SLOT: reply-button taps on reschedule-slot messages sent by older builds; slots are no longer auto-booked.
    if ((parsed.action === 'RESCHEDULE' || parsed.action === 'SLOT') && interviewId) {
      return this.requestReschedule(interviewId);
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

    if (input.from === 'unknown') {
      this.logger.warn(`WhatsApp action rejected — inbound message without sender for ${input.interviewId}`);
      return { ok: false as const, reason: 'unauthorized_candidate' };
    }
    if (input.from === 'simulator') {
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
    if (isReschedulePending(existing.status)) {
      return this.replyToCandidate(
        interviewId,
        'Your request for another time is in progress. The employer will send you a new interview time.',
        'reschedule_pending',
      );
    }

    // Atomic claim: a repeated tap, a Meta retry or an earlier portal confirm never re-sends anything.
    const claimed = await this.prisma.employerInterview.updateMany({
      where: { id: interviewId, status: { in: ['PROPOSED', 'SCHEDULED'] } },
      data: {
        status: 'CONFIRMED',
        confirmedAt: existing.confirmedAt || new Date(),
        whatsappStatus: 'CONFIRMED_VIA_WA',
      },
    });
    if (claimed.count === 0) {
      this.whatsapp.events.push({
        kind: 'INTERVIEW_STATUS',
        summary: 'INTERVIEW_STATUS = CONFIRMED (idempotent)',
        detail: { interviewId },
      });
      return { ok: true, status: 'CONFIRMED', interviewId, idempotent: true };
    }

    const interview = await this.prisma.employerInterview.findUniqueOrThrow({
      where: { id: interviewId },
      include: {
        employer: { select: { userId: true } },
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
        meetingUrl: interviewMeetingUrl(this.config, interview),
      });
    }
    const candidate = interview.application.candidate;
    const candidateName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim() || 'The candidate';
    const { dateLabel, timeLabel } = formatInterviewWhen(interview.scheduledAt, interview.timezone);
    await this.notifyUser(interview.employer.userId, {
      title: 'Interview confirmed',
      body: `${candidateName} confirmed the interview for ${interview.application.job.title} on WhatsApp.`,
      link: '/employer/interviews',
    });
    await this.notifyUser(candidate.userId, {
      title: 'Interview confirmed',
      body: `Your interview for ${interview.application.job.title} is confirmed for ${dateLabel} at ${timeLabel}.`,
      link: `/interviews/scheduled/${interview.id}`,
    });
    await this.scheduleReminders(interview.id, interview.scheduledAt);
    return { ok: true, status: 'CONFIRMED', interviewId: interview.id };
  }

  /**
   * Candidate wants another time (portal button or WhatsApp "Choose Another Time"). Only the first
   * request moves the interview to RESCHEDULE_NEEDED and notifies; repeats are no-ops.
   */
  async markRescheduleNeeded(interviewId: string, source: 'PORTAL' | 'WHATSAPP') {
    const claimed = await this.prisma.employerInterview.updateMany({
      where: { id: interviewId, status: { in: [...RESCHEDULABLE_STATUSES] } },
      data: {
        status: 'RESCHEDULE_NEEDED',
        confirmedAt: null,
        whatsappStatus: source === 'WHATSAPP' ? 'RESCHEDULE_NEEDED_VIA_WA' : 'RESCHEDULE_NEEDED_VIA_PORTAL',
        candidateRescheduleRequestedAt: new Date(),
        candidateProposedDate: null,
        candidateAvailableFrom: null,
        candidateAvailableUntil: null,
        candidateTimezone: null,
      },
    });
    const interview = await this.prisma.employerInterview.findUnique({
      where: { id: interviewId },
      include: {
        employer: { select: { userId: true, companyName: true } },
        application: { include: { candidate: { include: { user: true } }, job: true } },
      },
    });
    if (!interview) return { changed: false as const, interview: null };
    const changed = claimed.count === 1;
    if (changed) {
      const candidate = interview.application.candidate;
      const candidateName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim() || 'The candidate';
      const jobTitle = interview.application.job.title;
      await this.notifyUser(interview.employer.userId, {
        title: 'Candidate asked to reschedule',
        body: `${candidateName} asked to reschedule the ${jobTitle} interview. You will be notified when they share their available time.`,
        link: '/employer/interviews',
      });
      await this.notifyUser(candidate.userId, {
        title: 'Choose another time',
        body: `Select the date and time range when you are available for the ${jobTitle} interview.`,
        link: `/interviews/reschedule/${interview.id}`,
      });
      this.whatsapp.events.push({
        kind: 'INTERVIEW_STATUS',
        summary: 'INTERVIEW_STATUS = RESCHEDULE_NEEDED',
        detail: { interviewId, source },
      });
      this.logger.log(`Interview reschedule requested interviewId=${interviewId} source=${source}`);
    }
    return { changed, interview };
  }

  private async requestReschedule(interviewId: string) {
    const { changed, interview } = await this.markRescheduleNeeded(interviewId, 'WHATSAPP');
    if (!interview) return { ok: false, reason: 'Interview not found' };
    if (!isReschedulePending(interview.status)) {
      return { ok: false, reason: `cannot_reschedule_${interview.status}`, interviewId };
    }
    const phone = this.resolveNotifyPhone(interview.application.candidate);
    if (!phone) return { ok: true, status: interview.status, interviewId, changed, link: 'no_phone' };

    // One "Choose Another Time" link per reschedule request, however many times the button is tapped.
    const alreadySent = await this.prisma.whatsAppMessage.findFirst({
      where: {
        interviewId,
        direction: 'OUTBOUND',
        messageType: 'interview_reschedule_link',
        status: { not: 'FAILED' },
        createdAt: { gte: interview.candidateRescheduleRequestedAt || new Date(Date.now() - 86_400_000) },
      },
      select: { id: true },
    });
    if (alreadySent) return { ok: true, status: interview.status, interviewId, changed, link: 'already_sent' };

    // WhatsApp Flow first (stays inside WhatsApp); the website link and its template remain the fallback.
    const flow = await this.sendRescheduleFlow(interview, phone);
    if (flow?.ok) return { ok: true, status: interview.status, interviewId, changed, link: 'flow_sent' };

    const sent = await this.whatsapp.sendRescheduleRequestLink({
      to: phone,
      interviewId,
      url: candidateRescheduleUrl(this.config, interviewId),
      candidateId: interview.candidateId,
    });
    return { ok: true, status: interview.status, interviewId, changed, link: sent.ok ? 'sent' : 'failed' };
  }

  private flowKey() {
    return flowTokenKey({
      flowTokenSecret: this.config.get<string>('WHATSAPP_FLOW_TOKEN_SECRET'),
      jwtAccessSecret: this.config.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  /** null when no Flow is configured (WHATSAPP_RESCHEDULE_FLOW_ID) — callers fall back to the website link. */
  private async sendRescheduleFlow(
    interview: {
      id: string;
      candidateId: string;
      scheduledAt: Date;
      timezone?: string | null;
      employer?: { companyName?: string | null } | null;
      application: { job: { title: string } };
    },
    phone: string,
    body?: string,
  ) {
    const flowId = this.config.get<string>('WHATSAPP_RESCHEDULE_FLOW_ID')?.trim();
    const key = this.flowKey();
    if (!flowId || !/^\d+$/.test(flowId) || !key) return null;
    const flowToken = signFlowToken(
      {
        interviewId: interview.id,
        candidateId: interview.candidateId,
        scheduledAtMs: interview.scheduledAt.getTime(),
        expiresAtMs: Date.now() + FLOW_TOKEN_TTL_MS,
      },
      key,
    );
    return this.whatsapp.sendRescheduleFlow({
      to: phone,
      interviewId: interview.id,
      candidateId: interview.candidateId,
      flowId,
      flowToken,
      body,
      screenData: rescheduleFlowScreenData({
        jobTitle: interview.application.job.title,
        companyName: interview.employer?.companyName,
        timeZone:
          interview.timezone && isValidTimeZone(interview.timezone) ? interview.timezone : DEFAULT_INTERVIEW_TIMEZONE,
      }),
    });
  }

  /**
   * WhatsApp Flow submission (`nfm_reply`). The interview comes only from the signed flow_token, and the
   * sender must be that interview's candidate; the shared availability service does the rest.
   */
  async handleFlowSubmission(input: { from: string; responseJson: unknown }) {
    const submission = parseFlowSubmission(input.responseJson);
    if (!submission.ok && !submission.flowToken) {
      this.logger.warn(`WhatsApp Flow submission rejected: ${submission.reason}`);
      return { ok: false as const, reason: 'malformed_flow_payload' };
    }
    const key = this.flowKey();
    if (!key) return { ok: false as const, reason: 'flow_not_configured' };
    const token = verifyFlowToken(submission.flowToken, key);
    if (!token.ok) {
      this.logger.warn(`WhatsApp Flow submission rejected: token ${token.reason}`);
      return { ok: false as const, reason: `flow_token_${token.reason}` };
    }
    const { interviewId, candidateId, scheduledAtMs } = token.claims;
    const owned = await this.assertCandidateOwnsInterview({ interviewId, from: input.from, candidateId });
    if (!owned.ok) return owned;
    const interview = owned.interview;

    if (interview.status === 'CANCELLED' || interview.status === 'COMPLETED') {
      return this.replyToCandidate(interviewId, FLOW_CLOSED_TEXT, 'flow_interview_closed');
    }
    if (interview.status === 'CONFIRMED') {
      return this.replyToCandidate(
        interviewId,
        'Your interview is already confirmed, so no change was made. To ask for another time, tap "Choose Another Time" on your latest interview message.',
        'flow_already_confirmed',
      );
    }
    if (interview.scheduledAt.getTime() !== scheduledAtMs) {
      return this.replyToCandidate(
        interviewId,
        'This interview time has changed. Please use the latest interview message.',
        'flow_stale',
      );
    }
    if (!submission.ok) {
      return this.resendFlow(interviewId, 'We could not read your selection. Please choose the date and time range again.');
    }
    if (!this.availability) return { ok: false as const, reason: 'availability_unavailable' };

    const result = await this.availability.submitAvailability({
      interviewId,
      candidateId,
      body: {
        date: submission.date,
        availableFrom: submission.availableFrom,
        availableUntil: submission.availableUntil,
        timezone: interview.timezone || DEFAULT_INTERVIEW_TIMEZONE,
      },
      source: 'WHATSAPP_FLOW',
      allowedStatuses: FLOW_SUBMITTABLE_STATUSES,
    });
    if (!result.ok) {
      if (result.reason === 'invalid') return this.resendFlow(interviewId, `${result.message} Please choose again.`);
      return this.replyToCandidate(
        interviewId,
        result.reason === 'closed' ? FLOW_CLOSED_TEXT : 'This interview cannot be rescheduled right now.',
        `flow_${result.reason}`,
      );
    }

    this.whatsapp.events.push({
      kind: 'INTERVIEW_STATUS',
      summary: 'INTERVIEW_STATUS = RESCHEDULE_REQUESTED',
      detail: { interviewId, source: 'WHATSAPP_FLOW', changed: result.changed },
    });
    this.logger.log(`Interview availability received via WhatsApp Flow interviewId=${interviewId} changed=${result.changed}`);
    const phone = this.resolveNotifyPhone(interview.application.candidate);
    if (phone) {
      await this.whatsapp
        .sendText({
          to: phone,
          body: [
            result.changed
              ? 'Thank you. Your new availability has been sent to the employer.'
              : 'Your availability has already been sent to the employer.',
            '',
            `Candidate proposed time: ${result.label}`,
            '',
            'The employer will schedule the interview and you will be notified with the new time.',
          ].join('\n'),
          candidateId: interview.candidateId,
          interviewId,
          messageType: 'interview_availability_received',
        })
        .catch(() => undefined);
    }
    return { ok: true as const, status: 'RESCHEDULE_REQUESTED', interviewId, changed: result.changed };
  }

  /** Validation message + a fresh Flow, so the candidate can correct the selection without leaving WhatsApp. */
  private async resendFlow(interviewId: string, message: string) {
    const interview = await this.prisma.employerInterview.findUnique({
      where: { id: interviewId },
      include: {
        employer: { select: { companyName: true } },
        application: { include: { candidate: { include: { user: true } }, job: true } },
      },
    });
    const phone = interview ? this.resolveNotifyPhone(interview.application.candidate) : null;
    if (!interview || !phone) return { ok: false as const, reason: 'flow_invalid', interviewId };
    const flow = await this.sendRescheduleFlow(interview, phone, message);
    if (!flow?.ok) return this.replyToCandidate(interviewId, message, 'flow_invalid');
    return { ok: false as const, reason: 'flow_invalid', interviewId, message };
  }

  private async notifyUser(userId: string | null | undefined, input: { title: string; body: string; link: string }) {
    if (!userId) return;
    await this.notifications
      .create({ userId, title: input.title, body: input.body, type: 'INTERVIEW', link: input.link })
      .catch((err: unknown) =>
        this.logger.warn(`In-app notification failed: ${err instanceof Error ? err.message : String(err)}`),
      );
  }

  private async replyToCandidate(interviewId: string, body: string, reason: string) {
    const interview = await this.prisma.employerInterview.findUnique({
      where: { id: interviewId },
      include: { application: { include: { candidate: true } } },
    });
    const phone = interview ? this.resolveNotifyPhone(interview.application.candidate) : null;
    if (interview && phone) {
      await this.whatsapp
        .sendText({ to: phone, body, candidateId: interview.candidateId, interviewId, messageType: `interview_${reason}` })
        .catch(() => undefined);
    }
    return { ok: false, reason, interviewId };
  }

  private async interviewIdFromContext(contextMessageId?: string) {
    if (!contextMessageId) return undefined;
    const tapped = await this.prisma.whatsAppMessage.findFirst({
      where: { whatsappMessageId: contextMessageId, direction: 'OUTBOUND' },
      select: { interviewId: true },
    });
    return tapped?.interviewId || undefined;
  }

  /** "Confirm" on an invitation that a newer invitation (new time) has replaced. */
  private async isStaleInvitationTap(interviewId: string, contextMessageId?: string) {
    if (!contextMessageId) return false;
    const invitationWhere = [
      { messageType: 'interview_invitation' },
      { templateName: resolveTemplateName('INTERVIEW_INVITATION') },
    ];
    const tapped = await this.prisma.whatsAppMessage.findFirst({
      where: { whatsappMessageId: contextMessageId, direction: 'OUTBOUND', interviewId, OR: invitationWhere },
      select: { id: true, createdAt: true },
    });
    if (!tapped) return false;
    const newer = await this.prisma.whatsAppMessage.findFirst({
      where: {
        interviewId,
        direction: 'OUTBOUND',
        status: { not: 'FAILED' },
        createdAt: { gt: tapped.createdAt },
        OR: invitationWhere,
      },
      select: { id: true },
    });
    return Boolean(newer);
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
    const meetingUrl = interviewMeetingUrl(this.config, interview);
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
    const meetingUrl = interviewMeetingUrl(this.config, interview);
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

  resolveNotifyPhone(candidate: {
    whatsappOptIn?: boolean;
    whatsappNumber?: string | null;
    user?: { phone?: string | null } | null;
  }) {
    return consentedWhatsAppNumber(candidate);
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
        where: { candidateId, status: { in: [...OPEN_INTERVIEW_STATUSES] } },
        orderBy: { scheduledAt: 'asc' },
      });
    }
    const candidate = await this.findCandidateByPhone(waId);
    if (!candidate) return null;
    return this.prisma.employerInterview.findFirst({
      where: { candidateId: candidate.id, status: { in: [...OPEN_INTERVIEW_STATUSES] } },
      orderBy: { scheduledAt: 'asc' },
    });
  }
}
