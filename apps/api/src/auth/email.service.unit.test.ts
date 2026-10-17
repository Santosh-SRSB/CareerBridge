import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { EMAIL_LOGO_FALLBACK_URL, resolveEmailLogoUrl, safeHref } from './email-layout';

type Mail = { from: string; to: string; subject: string; text: string; html: string; replyTo?: string };

const SMTP_PASS = 'smtp-pass-should-never-appear-7c1e';
const DEV_WEB = 'https://careerbridge-web-dev-601892050765.asia-south1.run.app';
const SUPPORT = 'support@srsbcareerbridge.com';

class CapturingEmailService extends EmailService {
  readonly sent: Mail[] = [];
  readonly logs: string[] = [];
  constructor(env: Record<string, string | undefined>) {
    super({ get: (key: string) => env[key] } as unknown as ConfigService);
    const push = (msg: unknown) => this.logs.push(String(msg));
    (this as unknown as { logger: unknown }).logger = { log: push, error: push, warn: push, debug: push };
  }
  protected createTransport(): ReturnType<EmailService['createTransport']> {
    return { sendMail: async (mail: Mail) => void this.sent.push(mail) } as unknown as ReturnType<EmailService['createTransport']>;
  }
}

function service(overrides: Record<string, string | undefined> = {}) {
  return new CapturingEmailService({
    SMTP_HOST: 'smtp.example.test',
    SMTP_PORT: '587',
    SMTP_USER: 'mailer@example.test',
    SMTP_PASS,
    SMTP_FROM: `SRSB CareerBridge <${SUPPORT}>`,
    SMTP_REPLY_TO: SUPPORT,
    PUBLIC_WEB_URL: DEV_WEB,
    ...overrides,
  });
}

const HOSTILE = 'Asha <script>alert(1)</script> & "Co"';
const PORTAL = `${DEV_WEB}/employer/interviews?x=1&y=2`;
const MEET = `${DEV_WEB}/interviews/live/iv_123`;

/** One call per transactional email, with the values each must still contain. */
const EMAILS: Array<{ name: string; send: (s: EmailService) => Promise<unknown>; mustContain: string[]; hrefs: string[] }> = [
  {
    name: 'sendOtp',
    send: (s) => s.sendOtp('c@example.test', '482913'),
    mustContain: ['482913', '5 minutes'],
    hrefs: [],
  },
  {
    name: 'sendHumanMockInvite',
    send: (s) =>
      s.sendHumanMockInvite({ to: 'c@example.test', name: HOSTILE, jobRole: 'Sales Executive', whenLabel: '3 Oct, 4:00 PM', joinUrl: MEET, interviewerJoinUrl: MEET }),
    mustContain: ['Sales Executive', '3 Oct, 4:00 PM', 'Join live room'],
    hrefs: [MEET],
  },
  {
    name: 'sendHumanInterviewInterviewerInvite',
    send: (s) =>
      s.sendHumanInterviewInterviewerInvite({ to: 'i@example.test', interviewerName: 'Ravi', candidateName: HOSTILE, jobRole: 'Analyst', whenLabel: '4 Oct, 11:00 AM', joinUrl: MEET }),
    mustContain: ['Ravi', 'Analyst', '4 Oct, 11:00 AM', 'Join as interviewer'],
    hrefs: [MEET],
  },
  {
    name: 'sendEmployerInterviewConfirmation',
    send: (s) =>
      s.sendEmployerInterviewConfirmation({ to: 'c@example.test', candidateName: HOSTILE, companyName: 'Acme & Sons', jobTitle: 'Driver', whenLabel: '5 Oct, 10:00 AM', meetingUrl: MEET }),
    mustContain: ['Acme &amp; Sons', 'Driver', '5 Oct, 10:00 AM', 'confirmed', 'Start meeting'],
    hrefs: [MEET],
  },
  {
    name: 'sendEmployerInterviewScheduled',
    send: (s) =>
      s.sendEmployerInterviewScheduled({
        to: 'c@example.test',
        candidateName: HOSTILE,
        companyName: 'Acme',
        jobTitle: 'Cashier',
        whenLabel: '6 Oct, 2:00 PM',
        mode: 'IN_PERSON',
        portalUrl: PORTAL,
        meetingUrl: MEET,
        location: '12 MG Road <b>Floor 2</b>',
      }),
    mustContain: ['Cashier', '6 Oct, 2:00 PM', 'Venue:', '12 MG Road &lt;b&gt;Floor 2&lt;/b&gt;', 'Open interview', 'View details and confirm in CareerBridge'],
    hrefs: [MEET, PORTAL],
  },
  {
    name: 'sendEmployerInterviewRescheduleRequest',
    send: (s) =>
      s.sendEmployerInterviewRescheduleRequest({ to: 'e@example.test', employerName: 'Meera', candidateName: HOSTILE, jobTitle: 'Clerk', preferredLabel: '7 Oct, 3:00 PM – 6:00 PM', portalUrl: PORTAL }),
    mustContain: ['Meera', 'Clerk', 'Candidate proposed time:', '7 Oct, 3:00 PM – 6:00 PM', 'Review in portal'],
    hrefs: [PORTAL],
  },
  {
    name: 'sendEmployerInterviewRescheduleUpdate',
    send: (s) =>
      s.sendEmployerInterviewRescheduleUpdate({ to: 'c@example.test', candidateName: HOSTILE, companyName: 'Acme', jobTitle: 'Guard', whenLabel: '8 Oct, 9:00 AM', meetingUrl: null, portalUrl: PORTAL, approved: false }),
    mustContain: ['Acme proposed a new time for Guard: 8 Oct, 9:00 AM', 'Open interview'],
    hrefs: [PORTAL],
  },
  {
    name: 'sendEmployerInterviewCancelled',
    send: (s) =>
      s.sendEmployerInterviewCancelled({ to: 'c@example.test', candidateName: HOSTILE, companyName: 'Acme', jobTitle: 'Peon', whenLabel: '9 Oct, 1:00 PM', reason: 'Role <filled>' }),
    mustContain: ['Acme cancelled your interview for Peon scheduled for 9 Oct, 1:00 PM.', 'Reason: Role &lt;filled&gt;'],
    hrefs: [],
  },
];

const escapedHref = (url: string) => `href="${url.replace(/&/g, '&amp;')}"`;

describe('branded transactional emails', () => {
  it('covers every email the service can send (8)', () => {
    const senders = Object.getOwnPropertyNames(EmailService.prototype).filter((n) => /^send[A-Z]/.test(n) && n !== 'sendMail');
    assert.deepEqual(senders.sort(), EMAILS.map((e) => e.name).sort());
    assert.equal(EMAILS.length, 8);
  });

  for (const email of EMAILS) {
    it(`${email.name}: layout, sender, logo, variables, links, escaping, no secrets`, async () => {
      const s = service();
      await email.send(s);
      assert.equal(s.sent.length, 1);
      const mail = s.sent[0];

      assert.equal(mail.from, 'SRSB CareerBridge <support@srsbcareerbridge.com>');
      assert.equal(mail.replyTo, SUPPORT);

      assert.match(mail.html, /^<!DOCTYPE html>/);
      assert.match(mail.html, /role="presentation"/);
      assert.match(mail.html, /<!--\[if mso\]>/);
      const logo = mail.html.match(/<img src="([^"]+)"[^>]*>/);
      assert.ok(logo, 'logo image present');
      assert.equal(logo![1], `${DEV_WEB}/srsb-mark.png`);
      assert.match(logo![0], /alt="SRSB CareerBridge"/);
      assert.match(logo![0], /width="144"/);
      assert.match(mail.html, /SRSB CareerBridge &middot; <a href="https:\/\/www\.srsbcareerbridge\.com"/);
      assert.match(mail.html, /mailto:support@srsbcareerbridge\.com/);
      for (const src of mail.html.matchAll(/(?:src|href)="([^"]+)"/g)) {
        assert.ok(/^(https:\/\/|mailto:|#$)/.test(src[1]) || src[1].startsWith('http'), `unexpected URL ${src[1]}`);
        assert.equal(/localhost|127\.0\.0\.1|file:/i.test(src[1]), false, `local URL ${src[1]}`);
      }

      for (const value of email.mustContain) assert.ok(mail.html.includes(value), `html keeps "${value}"`);
      for (const url of email.hrefs) assert.ok(mail.html.includes(escapedHref(url)), `html links to ${url}`);
      for (const url of email.hrefs) assert.ok(mail.text.includes(url) || email.name === 'sendEmployerInterviewScheduled', `text keeps ${url}`);

      assert.equal(mail.html.includes('<script>'), false);
      if (email.name !== 'sendOtp') assert.ok(mail.html.includes('&lt;script&gt;') || !mail.text.includes('<script>'));

      const everything = JSON.stringify(mail) + s.logs.join('\n');
      assert.equal(everything.includes(SMTP_PASS), false);
    });
  }

  it('defaults the display name to SRSB CareerBridge and omits Reply-To when unset', async () => {
    const s = service({ SMTP_FROM: undefined, SMTP_REPLY_TO: undefined });
    await s.sendEmployerInterviewCancelled({ to: 'c@example.test', candidateName: 'A', companyName: 'B', jobTitle: 'C', whenLabel: 'D' });
    assert.equal(s.sent[0].from, 'SRSB CareerBridge <mailer@example.test>');
    assert.equal('replyTo' in s.sent[0], false);
    assert.equal(s.sent[0].html.includes('mailto:'), false);
  });

  it('keeps the plain-text bodies unchanged', async () => {
    const s = service();
    await s.sendEmployerInterviewRescheduleRequest({ to: 'e@example.test', employerName: 'Meera', candidateName: 'Asha', jobTitle: 'Clerk', preferredLabel: 'X', portalUrl: PORTAL });
    assert.equal(
      s.sent[0].text,
      `Hi Meera,\n\nAsha shared new availability for the Clerk interview.\n\nCandidate proposed time: X\n\nSchedule the interview: ${PORTAL}\n`,
    );
    assert.equal(s.sent[0].subject, 'Reschedule request — Clerk');
  });

  it('does not send when SMTP is not configured', async () => {
    const s = service({ SMTP_PASS: undefined });
    assert.equal(await s.sendEmployerInterviewCancelled({ to: 'c@example.test', candidateName: 'A', companyName: 'B', jobTitle: 'C', whenLabel: 'D' }), false);
    assert.equal(s.sent.length, 0);
  });
});

describe('email logo URL and links', () => {
  it('uses only public HTTPS logo URLs', () => {
    assert.equal(resolveEmailLogoUrl({ PUBLIC_WEB_URL: `${DEV_WEB}/` }), `${DEV_WEB}/srsb-mark.png`);
    assert.equal(resolveEmailLogoUrl({ PUBLIC_WEB_URL: 'http://localhost:3000' }), EMAIL_LOGO_FALLBACK_URL);
    assert.equal(resolveEmailLogoUrl({ PUBLIC_WEB_URL: 'https://localhost:3000' }), EMAIL_LOGO_FALLBACK_URL);
    assert.equal(resolveEmailLogoUrl({ PUBLIC_WEB_URL: 'http://careerbridge.example' }), EMAIL_LOGO_FALLBACK_URL);
    assert.equal(resolveEmailLogoUrl({}), 'https://www.srsbcareerbridge.com/srsb-mark.png');
    assert.equal(resolveEmailLogoUrl({ EMAIL_LOGO_URL: 'https://cdn.example/logo.png', PUBLIC_WEB_URL: DEV_WEB }), 'https://cdn.example/logo.png');
    assert.equal(resolveEmailLogoUrl({ EMAIL_LOGO_URL: 'file:///C:/logo.png' }), EMAIL_LOGO_FALLBACK_URL);
  });

  it('never turns non-http values into links', () => {
    assert.equal(safeHref('javascript:alert(1)'), '#');
    assert.equal(safeHref(''), '#');
    assert.equal(safeHref('https://a.test/?x=1&y="2"'), 'https://a.test/?x=1&amp;y=&quot;2&quot;');
  });
});
