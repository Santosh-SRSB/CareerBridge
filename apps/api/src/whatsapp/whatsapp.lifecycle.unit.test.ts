/**
 * Unit tests for WhatsApp interview lifecycle helpers (no Nest DI).
 * Run: npm.cmd run test:whatsapp -w api
 */
import assert from 'node:assert/strict';
import { createHmac } from 'crypto';
import { describe, it } from 'node:test';
import {
  buildDefaultRescheduleSlots,
  isOfferedRescheduleSlot,
  isReminderStillValid,
  phonesMatch,
} from './interview-lifecycle.util.ts';
import {
  confirmPayload,
  parseInteractivePayload,
  reschedulePayload,
  resolveTemplateName,
  slotPayload,
  startPayload,
} from './whatsapp.templates.ts';
import {
  isWhatsAppSendConfigured,
  signatureModeLabel,
  validateWhatsAppSignature,
} from './whatsapp-signature.util.ts';

describe('WhatsApp template names', () => {
  it('centralizes INTERVIEW_INVITATION default', () => {
    assert.equal(resolveTemplateName('INTERVIEW_INVITATION', {}), 'interview_invitation');
  });

  it('allows env override', () => {
    assert.equal(
      resolveTemplateName('INTERVIEW_REMINDER_15M', {
        WHATSAPP_TEMPLATE_INTERVIEW_REMINDER_15M: 'custom_15m',
      }),
      'custom_15m',
    );
  });
});

describe('Interactive payloads', () => {
  it('builds confirm / reschedule / slot / start payloads', () => {
    assert.equal(confirmPayload('abc'), 'CONFIRM:abc');
    assert.equal(reschedulePayload('abc'), 'RESCHEDULE:abc');
    assert.equal(slotPayload('abc', '2026-09-30T08:30:00.000Z'), 'SLOT:abc:2026-09-30T08:30:00.000Z');
    assert.equal(startPayload('abc'), 'START:abc');
  });

  it('parses interactive payloads', () => {
    assert.equal(parseInteractivePayload('CONFIRM:id-1').action, 'CONFIRM');
    assert.equal(parseInteractivePayload('RESCHEDULE:id-1').interviewId, 'id-1');
    assert.equal(parseInteractivePayload('DECLINE:id-1').action, 'DECLINE');
    assert.equal(parseInteractivePayload('START:id-1').action, 'START');
    const slot = parseInteractivePayload('SLOT:id-1:2026-09-30T08:30:00.000Z');
    assert.equal(slot.action, 'SLOT');
    assert.equal(slot.slotIso, '2026-09-30T08:30:00.000Z');
    assert.equal(parseInteractivePayload('Confirm Interview').action, 'CONFIRM');
    assert.equal(parseInteractivePayload('Choose Another Time').action, 'RESCHEDULE');
  });
});

describe('Reschedule slot revalidation', () => {
  it('accepts an offered slot', () => {
    const base = new Date('2026-09-30T05:30:00.000Z');
    const offered = buildDefaultRescheduleSlots(base);
    assert.equal(offered.length, 3);
    assert.equal(isOfferedRescheduleSlot(base, offered[1].toISOString(), base.getTime()), true);
  });

  it('rejects an arbitrary slot', () => {
    const base = new Date('2026-09-30T05:30:00.000Z');
    assert.equal(
      isOfferedRescheduleSlot(base, '2026-09-30T14:00:00.000Z', base.getTime()),
      false,
    );
  });

  it('rejects past slots', () => {
    const base = new Date('2026-09-20T05:30:00.000Z');
    const offered = buildDefaultRescheduleSlots(base);
    assert.equal(
      isOfferedRescheduleSlot(base, offered[0].toISOString(), Date.parse('2026-09-30T12:00:00.000Z')),
      false,
    );
  });
});

describe('Reminder validity', () => {
  it('allows 15m reminder near the window for CONFIRMED', () => {
    const scheduledAt = new Date('2026-09-30T11:00:00+05:30');
    const now = new Date(scheduledAt.getTime() - 15 * 60 * 1000);
    const result = isReminderStillValid({ status: 'CONFIRMED', scheduledAt, kind: '15m', now });
    assert.equal(result.ok, true);
  });

  it('skips cancelled interviews', () => {
    const scheduledAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const result = isReminderStillValid({
      status: 'CANCELLED',
      scheduledAt,
      kind: '2h',
      now: new Date(),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /CANCELLED/);
  });

  it('skips when schedule moved (outside window)', () => {
    const scheduledAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const result = isReminderStillValid({
      status: 'CONFIRMED',
      scheduledAt,
      kind: '15m',
      now: new Date(),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, 'outside_reminder_window');
  });

  it('skips RESCHEDULE_REQUESTED', () => {
    const scheduledAt = new Date(Date.now() + 15 * 60 * 1000);
    const result = isReminderStillValid({
      status: 'RESCHEDULE_REQUESTED',
      scheduledAt,
      kind: '15m',
      now: new Date(),
    });
    assert.equal(result.ok, false);
  });
});

describe('Phone matching', () => {
  it('matches +91 and local 10-digit', () => {
    assert.equal(phonesMatch('+919876543210', '9876543210'), true);
    assert.equal(phonesMatch('919876543210', '9876543210'), true);
    assert.equal(phonesMatch('9876543210', '9876543211'), false);
  });
});

describe('Webhook signature (WHATSAPP_REQUIRE_SIGNATURE)', () => {
  it('accepts when signature=false and App Secret missing', () => {
    assert.equal(
      validateWhatsAppSignature({
        requireSignature: false,
        appSecret: '',
        rawBody: undefined,
        signatureHeader: undefined,
      }),
      true,
    );
  });

  it('rejects when signature=true and App Secret missing', () => {
    assert.equal(
      validateWhatsAppSignature({
        requireSignature: true,
        appSecret: '',
        rawBody: Buffer.from('{}'),
        signatureHeader: 'sha256=abc',
      }),
      false,
    );
  });

  it('accepts valid HMAC when signature=true', () => {
    const secret = 'test-app-secret';
    const body = '{"object":"whatsapp_business_account"}';
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    assert.equal(
      validateWhatsAppSignature({
        requireSignature: true,
        appSecret: secret,
        rawBody: body,
        signatureHeader: `sha256=${sig}`,
      }),
      true,
    );
  });

  it('rejects invalid HMAC when signature=true', () => {
    assert.equal(
      validateWhatsAppSignature({
        requireSignature: true,
        appSecret: 'test-app-secret',
        rawBody: '{}',
        signatureHeader: 'sha256=deadbeef',
      }),
      false,
    );
  });

  it('skips HMAC entirely when signature=false even if secret present', () => {
    assert.equal(
      validateWhatsAppSignature({
        requireSignature: false,
        appSecret: 'present-but-unused',
        rawBody: undefined,
        signatureHeader: undefined,
      }),
      true,
    );
  });
});

describe('Connection status (DEV App Secret optional)', () => {
  it('configured=true without App Secret when required send vars present', () => {
    assert.equal(
      isWhatsAppSendConfigured({
        accessToken: true,
        phoneNumberId: true,
        verifyToken: true,
      }),
      true,
    );
    assert.equal(signatureModeLabel(false, false), 'disabled_dev');
  });

  it('configured=false when access token missing', () => {
    assert.equal(
      isWhatsAppSendConfigured({
        accessToken: false,
        phoneNumberId: true,
        verifyToken: true,
      }),
      false,
    );
  });

  it('signatureReady=false when signature required without secret', () => {
    assert.equal(signatureModeLabel(true, false), 'required_missing_secret');
    assert.equal(signatureModeLabel(true, true), 'required');
  });
});
