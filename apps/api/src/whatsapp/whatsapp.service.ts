import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppEventLog } from './whatsapp.event-log';
import {
  buildConfirmationText,
  buildInvitationText,
  buildReminderText,
  confirmPayload,
  formatInterviewWhen,
  RESCHEDULE_BUTTON_TEXT,
  RESCHEDULE_REQUEST_TEXT,
  reschedulePayload,
  resolveTemplateName,
  startPayload,
  uniqueButtonTitles,
  parseInteractivePayload as parseWaInteractivePayload,
} from './whatsapp.templates';
import {
  isOwnBusinessNumber,
  isWhatsAppSendConfigured,
  signatureModeLabel,
  validateWhatsAppSignature,
} from './whatsapp-signature.util';
import type {
  ReminderKind,
  WhatsAppTemplateName,
  WhatsAppWebhookBody,
} from './whatsapp.types';
import { RESCHEDULE_FLOW_CTA, RESCHEDULE_FLOW_SCREEN } from './whatsapp-flow.util';

/** Flow tokens authorise a Flow submission; they are not kept in the message log. */
function payloadForStorage(payload: Record<string, unknown>) {
  return JSON.stringify(payload, (key, value) => (key === 'flow_token' ? '[redacted]' : value));
}

function digitsOnly(phone: string) {
  return phone.replace(/\D/g, '');
}

function toWaId(phone: string) {
  const digits = digitsOnly(phone);
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  readonly events = new WhatsAppEventLog();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  getConnectionStatus() {
    const accessToken = Boolean(this.config.get<string>('WHATSAPP_ACCESS_TOKEN'));
    const phoneNumberId = Boolean(this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID'));
    const verifyToken = Boolean(this.config.get<string>('WHATSAPP_VERIFY_TOKEN'));
    const appSecret = Boolean(this.config.get<string>('WHATSAPP_APP_SECRET'));
    const businessAccountId = Boolean(this.config.get<string>('WHATSAPP_BUSINESS_ACCOUNT_ID'));
    const requireSignature = this.config.get<string>('WHATSAPP_REQUIRE_SIGNATURE') === 'true';
    const requireOptIn = this.config.get<string>('WHATSAPP_REQUIRE_OPT_IN') === 'true';
    const configured = isWhatsAppSendConfigured({ accessToken, phoneNumberId, verifyToken });
    const signatureReady = appSecret || !requireSignature;
    return {
      configured,
      accessToken,
      phoneNumberId,
      verifyToken,
      appSecret,
      businessAccountId,
      requireSignature,
      signatureEnforced: appSecret || requireSignature,
      requireOptIn: true,
      requireOptInEnv: requireOptIn,
      signatureReady,
      signatureMode: signatureModeLabel(requireSignature, appSecret),
      apiVersion: this.config.get<string>('WHATSAPP_API_VERSION', 'v21.0'),
      webhookPath: '/api/v1/whatsapp/webhook',
      webhookAliasPath: '/api/v1/webhooks/whatsapp',
      graphBase: `https://graph.facebook.com/${this.config.get<string>('WHATSAPP_API_VERSION', 'v21.0')}`,
    };
  }

  verifyWebhook(mode: string | undefined, token: string | undefined, challenge: string | undefined) {
    const expectedToken = this.config.get<string>('WHATSAPP_VERIFY_TOKEN', '');
    if (!expectedToken) {
      this.logger.error('WHATSAPP_VERIFY_TOKEN is not set');
      return null;
    }
    if (mode !== 'subscribe' || token !== expectedToken || !challenge) {
      this.logger.warn('WhatsApp webhook verification failed');
      return null;
    }
    this.logger.log('WhatsApp webhook verified successfully');
    this.events.push({ kind: 'CONNECTION', summary: 'Webhook verified by Meta' });
    return challenge;
  }

  /**
   * Meta webhook HMAC (x-hub-signature-256).
   * - WHATSAPP_APP_SECRET set (Secret Manager → Cloud Run env): signature always verified
   * - WHATSAPP_REQUIRE_SIGNATURE=true without the secret: every webhook rejected
   * - neither: unsigned payloads accepted (local DEV only)
   */
  validateSignature(rawBody: Buffer | string | undefined, signatureHeader: string | undefined) {
    const requireSignature = this.config.get<string>('WHATSAPP_REQUIRE_SIGNATURE') === 'true';
    const appSecret = this.config.get<string>('WHATSAPP_APP_SECRET', '') || '';
    if (requireSignature && !appSecret) {
      this.logger.error('WHATSAPP_REQUIRE_SIGNATURE=true but WHATSAPP_APP_SECRET is empty');
    }
    return validateWhatsAppSignature({
      requireSignature,
      appSecret,
      rawBody,
      signatureHeader,
    });
  }

  async testConnection() {
    const status = this.getConnectionStatus();
    if (!status.configured) {
      this.events.push({
        kind: 'ERROR',
        summary: 'Meta API not fully configured',
        detail: status,
      });
      return { ok: false, status, message: 'WhatsApp is not fully configured on the server. Complete the WhatsApp setup and try again.' };
    }
    const phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID')!;
    const result = await this.graphGet(`/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`);
    this.events.push({
      kind: result.ok ? 'CONNECTION' : 'ERROR',
      summary: result.ok ? 'Meta API Connected' : 'Meta API connection failed',
      detail: result.data,
    });
    return { ok: result.ok, status, data: result.data };
  }

  async sendText(input: {
    to: string;
    body: string;
    candidateId?: string;
    interviewId?: string;
    messageType?: string;
  }) {
    const to = toWaId(input.to);
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { preview_url: false, body: input.body },
    };
    return this.sendAndPersist({
      to,
      candidateId: input.candidateId,
      interviewId: input.interviewId,
      messageType: input.messageType || 'text',
      templateName: null,
      payload,
    });
  }

  async sendInteractiveButtons(input: {
    to: string;
    body: string;
    buttons: Array<{ id: string; title: string }>;
    candidateId?: string;
    interviewId?: string;
    messageType?: string;
  }) {
    const to = toWaId(input.to);
    const picked = input.buttons.slice(0, 3);
    const titles = uniqueButtonTitles(picked.map((button) => button.title));
    const buttons = picked.map((button, index) => ({
      type: 'reply',
      reply: { id: button.id.slice(0, 256), title: titles[index] },
    }));
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: input.body.slice(0, 1024) },
        action: { buttons },
      },
    };
    return this.sendAndPersist({
      to,
      candidateId: input.candidateId,
      interviewId: input.interviewId,
      messageType: input.messageType || 'interactive_buttons',
      templateName: null,
      payload,
    });
  }

  async sendTemplate(input: {
    to: string;
    logicalTemplate: WhatsAppTemplateName;
    bodyParams?: string[];
    /** Dynamic suffix for the template's first URL button (Meta `{{1}}` at the end of the URL). */
    urlButtonSuffix?: string;
    candidateId?: string;
    interviewId?: string;
    languageCode?: string;
    messageType?: string;
  }) {
    const to = toWaId(input.to);
    const templateName = resolveTemplateName(input.logicalTemplate);
    const components: Array<Record<string, unknown>> = [];
    if (input.bodyParams?.length) {
      components.push({
        type: 'body',
        parameters: input.bodyParams.map((text) => ({ type: 'text', text })),
      });
    }
    if (input.urlButtonSuffix) {
      components.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: input.urlButtonSuffix }],
      });
    }
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: input.languageCode || this.config.get('WHATSAPP_TEMPLATE_LANGUAGE', 'en') },
        ...(components.length ? { components } : {}),
      },
    };
    return this.sendAndPersist({
      to,
      candidateId: input.candidateId,
      interviewId: input.interviewId,
      messageType: input.messageType || 'template',
      templateName,
      payload,
    });
  }

  /** Interactive message with a single URL button (allowed only inside the 24-hour service window). */
  async sendCtaUrl(input: {
    to: string;
    body: string;
    displayText: string;
    url: string;
    candidateId?: string;
    interviewId?: string;
    messageType?: string;
  }) {
    const to = toWaId(input.to);
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'cta_url',
        body: { text: input.body.slice(0, 1024) },
        action: {
          name: 'cta_url',
          parameters: { display_text: input.displayText.slice(0, 20), url: input.url },
        },
      },
    };
    return this.sendAndPersist({
      to,
      candidateId: input.candidateId,
      interviewId: input.interviewId,
      messageType: input.messageType || 'interactive_cta_url',
      templateName: null,
      payload,
    });
  }

  /**
   * "Choose Another Time" → CareerBridge availability form. Never includes meeting details.
   * Interactive first (the candidate just tapped, so the service window is open); the approved
   * `interview_reschedule` template is the fallback outside the window.
   */
  async sendRescheduleRequestLink(input: {
    to: string;
    interviewId: string;
    url: string;
    candidateId?: string;
  }) {
    const messageType = 'interview_reschedule_link';
    const interactive = await this.sendCtaUrl({
      to: input.to,
      body: RESCHEDULE_REQUEST_TEXT,
      displayText: RESCHEDULE_BUTTON_TEXT,
      url: input.url,
      candidateId: input.candidateId,
      interviewId: input.interviewId,
      messageType,
    });
    if (interactive.ok) return interactive;
    return this.sendTemplate({
      to: input.to,
      logicalTemplate: 'INTERVIEW_RESCHEDULE',
      urlButtonSuffix: input.interviewId,
      candidateId: input.candidateId,
      interviewId: input.interviewId,
      messageType,
    });
  }

  /**
   * Interactive WhatsApp Flow (date picker + From/Until selectors) for "Choose Another Time".
   * Same messageType as the website link, so one reschedule request still yields one message.
   */
  async sendRescheduleFlow(input: {
    to: string;
    interviewId: string;
    flowId: string;
    flowToken: string;
    screenData: Record<string, string>;
    body?: string;
    candidateId?: string;
  }) {
    const to = toWaId(input.to);
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'flow',
        body: { text: (input.body || RESCHEDULE_REQUEST_TEXT).slice(0, 1024) },
        action: {
          name: 'flow',
          parameters: {
            flow_message_version: '3',
            flow_token: input.flowToken,
            flow_id: input.flowId,
            flow_cta: RESCHEDULE_FLOW_CTA,
            flow_action: 'navigate',
            flow_action_payload: { screen: RESCHEDULE_FLOW_SCREEN, data: input.screenData },
          },
        },
      },
    };
    return this.sendAndPersist({
      to,
      candidateId: input.candidateId,
      interviewId: input.interviewId,
      messageType: 'interview_reschedule_link',
      templateName: null,
      payload,
    });
  }

  async sendInterviewInvitation(input: {
    to: string;
    candidateName: string;
    jobTitle: string;
    scheduledAt: Date;
    durationMin: number;
    interviewId: string;
    candidateId?: string;
    timeZone?: string;
    preferTemplate?: boolean;
  }) {
    const text = buildInvitationText(input);
    if (input.preferTemplate || this.config.get('WHATSAPP_USE_TEMPLATES') === 'true') {
      const { dateLabel, timeLabel } = formatInterviewWhen(input.scheduledAt, input.timeZone);
      const sent = await this.sendTemplate({
        to: input.to,
        logicalTemplate: 'INTERVIEW_INVITATION',
        bodyParams: [input.candidateName, input.jobTitle, dateLabel, timeLabel],
        candidateId: input.candidateId,
        interviewId: input.interviewId,
        messageType: 'interview_invitation',
      });
      if (sent.ok) return sent;
    }
    return this.sendInteractiveButtons({
      to: input.to,
      body: text,
      candidateId: input.candidateId,
      interviewId: input.interviewId,
      messageType: 'interview_invitation',
      buttons: [
        { id: confirmPayload(input.interviewId), title: 'Confirm Interview' },
        { id: reschedulePayload(input.interviewId), title: 'Choose Another Time' },
      ],
    });
  }

  async sendInterviewConfirmation(input: {
    to: string;
    candidateName: string;
    scheduledAt: Date;
    interviewId: string;
    candidateId?: string;
    timeZone?: string;
    meetingUrl?: string | null;
  }) {
    return this.sendText({
      to: input.to,
      body: buildConfirmationText(input),
      candidateId: input.candidateId,
      interviewId: input.interviewId,
      messageType: 'interview_confirmation',
    });
  }

  async sendReminder(input: {
    to: string;
    kind: ReminderKind;
    candidateName: string;
    jobTitle: string;
    scheduledAt: Date;
    interviewId: string;
    candidateId?: string;
    meetingUrl?: string | null;
    timeZone?: string;
  }) {
    const body = buildReminderText(input.kind, input);
    if (input.kind === '15m' && input.meetingUrl) {
      return this.sendInteractiveButtons({
        to: input.to,
        body,
        candidateId: input.candidateId,
        interviewId: input.interviewId,
        messageType: `interview_reminder_${input.kind}`,
        buttons: [{ id: startPayload(input.interviewId), title: 'Start Interview' }],
      });
    }
    return this.sendText({
      to: input.to,
      body,
      candidateId: input.candidateId,
      interviewId: input.interviewId,
      messageType: `interview_reminder_${input.kind}`,
    });
  }

  parseInteractivePayload(raw: string | undefined) {
    return parseWaInteractivePayload(raw);
  }

  async markDeliveryStatus(whatsappMessageId: string, status: string, timestamp?: string) {
    const at = timestamp ? new Date(Number(timestamp) * 1000) : new Date();
    const mapped =
      status === 'delivered'
        ? 'DELIVERED'
        : status === 'read'
          ? 'READ'
          : status === 'failed'
            ? 'FAILED'
            : status === 'sent'
              ? 'SENT'
              : null;
    if (!mapped) return null;
    const row = await this.prisma.whatsAppMessage.findFirst({
      where: { whatsappMessageId },
    });
    if (!row) return null;
    return this.prisma.whatsAppMessage.update({
      where: { id: row.id },
      data: {
        status: mapped,
        ...(mapped === 'DELIVERED' ? { deliveredAt: at } : {}),
        ...(mapped === 'READ' ? { readAt: at } : {}),
        ...(mapped === 'SENT' ? { sentAt: at } : {}),
      },
    });
  }

  private async sendAndPersist(input: {
    to: string;
    candidateId?: string;
    interviewId?: string;
    messageType: string;
    templateName: string | null;
    payload: Record<string, unknown>;
  }) {
    // Test harness may pass synthetic ids (e.g. test_…) that are not EmployerInterview rows.
    const interviewFk =
      input.interviewId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        input.interviewId,
      )
        ? input.interviewId
        : null;

    const businessPhone = this.config.get<string>('WHATSAPP_DISPLAY_PHONE') || null;
    if (isOwnBusinessNumber(input.to, businessPhone)) {
      const error = {
        error: {
          code: 'RECIPIENT_IS_BUSINESS_NUMBER',
          message: 'Recipient is the WhatsApp Business sender number; Meta rejects this with (#100) Invalid parameter.',
        },
      };
      const rejected = await this.prisma.whatsAppMessage.create({
        data: {
          candidateId: input.candidateId || null,
          interviewId: interviewFk,
          toPhone: input.to,
          fromPhone: businessPhone,
          messageType: input.messageType,
          templateName: input.templateName,
          direction: 'OUTBOUND',
          status: 'FAILED',
          payloadJson: payloadForStorage(input.payload),
          errorJson: JSON.stringify(error),
        },
      });
      this.logger.warn(`WhatsApp ${input.messageType} not sent: recipient is the business sender number`);
      this.events.push({ kind: 'MESSAGE_FAILED', summary: `Refused ${input.messageType}: recipient is the business number`, detail: error });
      return { ok: false as const, messageId: null, recordId: rejected.id, error };
    }

    const record = await this.prisma.whatsAppMessage.create({
      data: {
        candidateId: input.candidateId || null,
        interviewId: interviewFk,
        toPhone: input.to,
        fromPhone: businessPhone,
        messageType: input.messageType,
        templateName: input.templateName,
        direction: 'OUTBOUND',
        status: 'QUEUED',
        payloadJson: payloadForStorage(input.payload),
      },
    });

    const result = await this.graphPost(
      `/${this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID')}/messages`,
      input.payload,
    );

    if (!result.ok) {
      await this.prisma.whatsAppMessage.update({
        where: { id: record.id },
        data: { status: 'FAILED', errorJson: JSON.stringify(result.data) },
      });
      this.events.push({
        kind: 'MESSAGE_FAILED',
        summary: `Failed to send ${input.messageType} to ${input.to}`,
        detail: result.data,
      });
      return { ok: false as const, messageId: null, recordId: record.id, error: result.data };
    }

    const wamid =
      (result.data as { messages?: Array<{ id?: string }> })?.messages?.[0]?.id || null;
    await this.prisma.whatsAppMessage.update({
      where: { id: record.id },
      data: {
        status: 'SENT',
        whatsappMessageId: wamid,
        sentAt: new Date(),
      },
    });
    this.events.push({
      kind: 'MESSAGE_SENT',
      summary: `Sent ${input.messageType} to ${input.to}`,
      detail: { wamid, recordId: record.id, interviewId: input.interviewId },
    });
    return { ok: true as const, messageId: wamid, recordId: record.id, data: result.data };
  }

  private async graphGet(path: string) {
    return this.graphRequest('GET', path);
  }

  private async graphPost(path: string, body: Record<string, unknown>) {
    return this.graphRequest('POST', path, body);
  }

  private async graphRequest(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>) {
    const token = this.config.get<string>('WHATSAPP_ACCESS_TOKEN', '');
    const version = this.config.get<string>('WHATSAPP_API_VERSION', 'v21.0');
    if (!token) {
      return { ok: false, data: { error: { message: 'WHATSAPP_ACCESS_TOKEN missing' } } };
    }
    const url = `https://graph.facebook.com/${version}${path}`;
    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        this.logger.error(`WhatsApp Graph ${method} ${path} failed: ${JSON.stringify(data)}`);
        return { ok: false, data };
      }
      return { ok: true, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      this.logger.error(`WhatsApp Graph request error: ${message}`);
      return { ok: false, data: { error: { message } } };
    }
  }
}

export type { WhatsAppWebhookBody };
