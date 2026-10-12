/**
 * Unit tests for WhatsApp interview lifecycle helpers (no Nest DI).
 * Run: npm.cmd run test:whatsapp -w api
 */
import assert from 'node:assert/strict';
import { createHmac } from 'crypto';
import { describe, it } from 'node:test';
import { consentedWhatsAppNumber, isReminderStillValid, phonesMatch } from './interview-lifecycle.util.ts';
import {
  buildConfirmationText,
  buildInvitationText,
  CONFIRMATION_LINK_NOTE,
  confirmPayload,
  formatInterviewWhen,
  INVITATION_COMPANY_FALLBACK,
  invitationCompanyName,
  invitationTemplateParams,
  RESCHEDULE_REQUEST_TEXT,
  uniqueButtonTitles,
  parseInteractivePayload,
  reschedulePayload,
  resolveTemplateName,
  slotPayload,
  startPayload,
} from './whatsapp.templates.ts';
import {
  isOwnBusinessNumber,
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

describe('interview_invitation body variables', () => {
  // 10 Oct 2026, 5:00 pm IST
  const scheduledAt = new Date('2026-10-10T11:30:00.000Z');
  const base = { candidateName: 'Harsh', jobTitle: 'Backend Developer', scheduledAt, timeZone: 'Asia/Kolkata' };

  it('sends five variables in template order {{1}}–{{5}}', () => {
    const params = invitationTemplateParams({ ...base, companyName: 'SRSB Workforce Solutions' });
    assert.deepEqual(params, ['Harsh', 'Backend Developer', '10 October 2026', '5:00 pm', 'SRSB Workforce Solutions']);
  });

  it('keeps {{1}}–{{4}} identical to the previous four-variable mapping', () => {
    const { dateLabel, timeLabel } = formatInterviewWhen(scheduledAt, 'Asia/Kolkata');
    const params = invitationTemplateParams({ ...base, companyName: 'Acme Hiring' });
    assert.deepEqual(params.slice(0, 4), ['Harsh', 'Backend Developer', dateLabel, timeLabel]);
  });

  it('uses each interview’s own company', () => {
    const a = invitationTemplateParams({ ...base, companyName: 'SRSB Workforce Solutions' });
    const b = invitationTemplateParams({ ...base, companyName: 'Acme Hiring Pvt Ltd' });
    assert.equal(a[4], 'SRSB Workforce Solutions');
    assert.equal(b[4], 'Acme Hiring Pvt Ltd');
  });

  it('falls back to the neutral label when the company name is missing or blank', () => {
    for (const missing of [null, undefined, '', '   ', '\n\t']) {
      assert.equal(invitationCompanyName(missing), INVITATION_COMPANY_FALLBACK);
      assert.equal(invitationTemplateParams({ ...base, companyName: missing })[4], 'Employer');
    }
  });

  it('collapses whitespace Meta would reject in a template parameter', () => {
    assert.equal(invitationCompanyName('  SRSB \n Workforce\t\tSolutions  '), 'SRSB Workforce Solutions');
  });

  it('interactive fallback text names the company', () => {
    const text = buildInvitationText({ ...base, companyName: 'SRSB Workforce Solutions', durationMin: 20 });
    assert.equal(
      text,
      [
        'Hi Harsh',
        '',
        'You have been invited for an interview for Backend Developer from SRSB Workforce Solutions.',
        '',
        'Date: 10 October 2026',
        'Time: 5:00 pm',
        'Duration: 20 minutes',
        '',
        'Please confirm your availability.',
      ].join('\n'),
    );
    assert.match(buildInvitationText({ ...base, companyName: null, durationMin: 20 }), /Backend Developer from Employer\./);
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

describe('Reply button titles', () => {
  it('dedupes repeated titles', () => {
    const titles = uniqueButtonTitles(['2:00 pm', '4:00 pm', '2:00 pm']);
    assert.equal(new Set(titles).size, 3);
    for (const title of titles) assert.ok(title.length <= 20);
  });
});

describe('Reschedule and confirmation copy', () => {
  it('reschedule request text carries no meeting link or time', () => {
    assert.equal(
      RESCHEDULE_REQUEST_TEXT,
      'Your interview needs to be rescheduled. Please select another available date and the time range when you are available.',
    );
    assert.doesNotMatch(RESCHEDULE_REQUEST_TEXT, /https?:|meet|link/i);
  });

  it('confirmation includes the meeting link only when given', () => {
    const scheduledAt = new Date('2026-10-03T09:30:00.000Z');
    const withLink = buildConfirmationText({ candidateName: 'A', scheduledAt, meetingUrl: 'https://meet.google.com/new-link' });
    assert.match(withLink, /Meeting link: https:\/\/meet\.google\.com\/new-link/);
    assert.doesNotMatch(buildConfirmationText({ candidateName: 'A', scheduledAt }), /Meeting link/);
  });

  it('confirmation keeps its content and ends with the interview-link note', () => {
    const scheduledAt = new Date('2026-10-03T09:30:00.000Z');
    const text = buildConfirmationText({ candidateName: 'A', scheduledAt, meetingUrl: 'https://meet.google.com/new-link' });
    assert.match(text, /^Great, A!\n\nYour interview is confirmed for /);
    assert.match(text, /We'll remind you before the interview\.\n\nGood luck!\n\n/);
    assert.ok(text.endsWith(`Good luck!\n\n${CONFIRMATION_LINK_NOTE}`));
    assert.equal(
      CONFIRMATION_LINK_NOTE,
      'The interview link is sent via email and will also be shared here with a reminder.',
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

  it('skips RESCHEDULE_NEEDED and RESCHEDULE_REQUESTED', () => {
    const scheduledAt = new Date(Date.now() + 15 * 60 * 1000);
    for (const status of ['RESCHEDULE_NEEDED', 'RESCHEDULE_REQUESTED']) {
      const result = isReminderStillValid({ status, scheduledAt, kind: '15m', now: new Date() });
      assert.equal(result.ok, false);
    }
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

  it('enforces HMAC whenever the App Secret is present, even if signature=false', () => {
    const secret = 'test-app-secret';
    const body = '{"object":"whatsapp_business_account"}';
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    for (const signatureHeader of [undefined, 'sha256=deadbeef']) {
      assert.equal(
        validateWhatsAppSignature({ requireSignature: false, appSecret: secret, rawBody: body, signatureHeader }),
        false,
      );
    }
    assert.equal(
      validateWhatsAppSignature({ requireSignature: false, appSecret: secret, rawBody: body, signatureHeader: `sha256=${sig}` }),
      true,
    );
    assert.equal(signatureModeLabel(false, true), 'required');
  });
});

describe('Recipient guard (Meta #100 on self-send)', () => {
  it('detects the business sender number in any format', () => {
    assert.equal(isOwnBusinessNumber('919513791117', '+91 95137 91117'), true);
    assert.equal(isOwnBusinessNumber('9513791117', '+919513791117'), true);
    assert.equal(isOwnBusinessNumber('919800000001', '+919513791117'), false);
    assert.equal(isOwnBusinessNumber('919513791117', null), false);
    assert.equal(isOwnBusinessNumber('', '+919513791117'), false);
  });
});

describe('WhatsApp consent', () => {
  it('uses only the opted-in WhatsApp number, never the login phone', () => {
    assert.equal(consentedWhatsAppNumber({ whatsappOptIn: false, whatsappNumber: '+919800000001' }), null);
    assert.equal(consentedWhatsAppNumber({ whatsappOptIn: true, whatsappNumber: null }), null);
    assert.equal(consentedWhatsAppNumber({ whatsappOptIn: true, whatsappNumber: '+919800000001' }), '+919800000001');
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
