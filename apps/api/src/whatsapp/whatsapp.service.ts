import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppEventLog } from './whatsapp.event-log';
import {
  buildConfirmationText,
  buildInvitationText,
  buildReminderText,
  confirmPayload,
  formatInterviewWhen,
  reschedulePayload,
  resolveTemplateName,
  slotPayload,
  startPayload,
} from './whatsapp.templates';
import type {
  ParsedInteractivePayload,
  ReminderKind,
  WhatsAppTemplateName,
  WhatsAppWebhookBody,
} from './whatsapp.types';

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
    return {
      configured: accessToken && phoneNumberId && verifyToken,
      accessToken,
      phoneNumberId,
      verifyToken,
      appSecret,
      businessAccountId,
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

  validateSignature(rawBody: Buffer | string | undefined, signatureHeader: string | undefined) {
    const appSecret = this.config.get<string>('WHATSAPP_APP_SECRET', '');
    const requireSignature = this.config.get<string>('WHATSAPP_REQUIRE_SIGNATURE') === 'true';
    if (!appSecret) {
      // Local/dev: allow without secret unless explicitly required
      return !requireSignature;
    }
    if (!rawBody || !signatureHeader?.startsWith('sha256=')) return false;
    const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const provided = signatureHeader.slice('sha256='.length);
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
    } catch {
      return false;
    }
  }

  async testConnection() {
    const status = this.getConnectionStatus();
    if (!status.configured) {
      this.events.push({
        kind: 'ERROR',
        summary: 'Meta API not fully configured',
        detail: status,
      });
      return { ok: false, status, message: 'Set WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN' };
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
    const buttons = input.buttons.slice(0, 3).map((button) => ({
      type: 'reply',
      reply: { id: button.id.slice(0, 256), title: button.title.slice(0, 20) },
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
    candidateId?: string;
    interviewId?: string;
    languageCode?: string;
  }) {
    const to = toWaId(input.to);
    const templateName = resolveTemplateName(input.logicalTemplate);
    const components =
      input.bodyParams && input.bodyParams.length
        ? [
            {
              type: 'body',
              parameters: input.bodyParams.map((text) => ({ type: 'text', text })),
            },
          ]
        : undefined;
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: input.languageCode || this.config.get('WHATSAPP_TEMPLATE_LANGUAGE', 'en') },
        ...(components ? { components } : {}),
      },
    };
    return this.sendAndPersist({
      to,
      candidateId: input.candidateId,
      interviewId: input.interviewId,
      messageType: 'template',
      templateName,
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
  }) {
    return this.sendText({
      to: input.to,
      body: buildConfirmationText(input),
      candidateId: input.candidateId,
      interviewId: input.interviewId,
      messageType: 'interview_confirmation',
    });
  }

  async sendRescheduleOptions(input: {
    to: string;
    interviewId: string;
    slots: Date[];
    candidateId?: string;
    timeZone?: string;
  }) {
    const buttons = input.slots.slice(0, 3).map((slot) => {
      const { dateLabel, timeLabel } = formatInterviewWhen(slot, input.timeZone);
      return {
        id: slotPayload(input.interviewId, slot.toISOString()),
        title: timeLabel.slice(0, 20),
        label: `${dateLabel} · ${timeLabel}`,
      };
    });
    const body = [
      'No problem. Please select another available time:',
      ...buttons.map((button) => `• ${button.label}`),
    ].join('\n');
    return this.sendInteractiveButtons({
      to: input.to,
      body,
      candidateId: input.candidateId,
      interviewId: input.interviewId,
      messageType: 'interview_reschedule_options',
      buttons: buttons.map((button) => ({ id: button.id, title: button.title })),
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

  parseInteractivePayload(raw: string | undefined): ParsedInteractivePayload {
    if (!raw) return { action: 'UNKNOWN', raw: '' };
    const value = raw.trim();
    if (value.startsWith('CONFIRM:')) {
      return { action: 'CONFIRM', interviewId: value.slice('CONFIRM:'.length), raw: value };
    }
    if (value.startsWith('RESCHEDULE:')) {
      return { action: 'RESCHEDULE', interviewId: value.slice('RESCHEDULE:'.length), raw: value };
    }
    if (value.startsWith('DECLINE:')) {
      return { action: 'DECLINE', interviewId: value.slice('DECLINE:'.length), raw: value };
    }
    if (value.startsWith('START:')) {
      return { action: 'START', interviewId: value.slice('START:'.length), raw: value };
    }
    if (value.startsWith('SLOT:')) {
      const rest = value.slice('SLOT:'.length);
      const split = rest.indexOf(':');
      if (split > 0) {
        return {
          action: 'SLOT',
          interviewId: rest.slice(0, split),
          slotIso: rest.slice(split + 1),
          raw: value,
        };
      }
    }
    const lower = value.toLowerCase();
    // Meta template Quick Reply payloads are usually the button label text.
    if (lower.includes('confirm')) return { action: 'CONFIRM', raw: value };
    if (
      lower.includes('reschedule') ||
      lower.includes('another time') ||
      lower.includes('choose another')
    ) {
      return { action: 'RESCHEDULE', raw: value };
    }
    return { action: 'UNKNOWN', raw: value };
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

    const record = await this.prisma.whatsAppMessage.create({
      data: {
        candidateId: input.candidateId || null,
        interviewId: interviewFk,
        toPhone: input.to,
        fromPhone: this.config.get<string>('WHATSAPP_DISPLAY_PHONE') || null,
        messageType: input.messageType,
        templateName: input.templateName,
        direction: 'OUTBOUND',
        status: 'QUEUED',
        payloadJson: JSON.stringify(input.payload),
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
