/**
 * WhatsApp Flow "Choose Another Time": token, Flow message, nfm_reply submission → shared availability logic.
 * Real WhatsAppWebhookService / WhatsAppService / InterviewAvailabilityService; Prisma, Meta and email are in-memory fakes.
 * Run: npm.cmd run test:whatsapp-flow -w api
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { WhatsAppWebhookService } from './whatsapp.webhook.service';
import { WhatsAppService } from './whatsapp.service';
import { InterviewAvailabilityService } from '../interview-availability/interview-availability.service';
import {
  availabilityTimeOptions,
  buildRescheduleFlowJson,
  flowTokenKey,
  parseFlowSubmission,
  RESCHEDULE_FLOW_SCREEN,
  signFlowToken,
  verifyFlowToken,
} from './whatsapp-flow.util';

type Row = Record<string, any>;
const IV = '11111111-1111-4111-8111-111111111111';
const OTHER_IV = '22222222-2222-4222-8222-222222222222';
const CAND = 'cand-1';
const PHONE = '919800000001';
const FLOW_ID = '2165342711034967';
const JWT = 'unit-test-access-secret-not-real-0123456789';
const KEY = flowTokenKey({ jwtAccessSecret: JWT })!;

function istDate(daysAhead: number) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + daysAhead * 86_400_000));
}

let row: Row;
let otherRow: Row;
let outbound: Row[];
let inbound: Row[];
let notes: Row[];
let emails: Row[];
let svc: WhatsAppWebhookService;
let wamid = 0;

function availabilityOr(r: Row, or: Row[] | undefined) {
  if (!or) return true;
  return or.some((clause) =>
    Object.entries(clause).every(([k, v]: [string, any]) => {
      if (v === null) return r[k] === null || r[k] === undefined;
      if (v && typeof v === 'object' && 'not' in v) {
        const cur = r[k];
        if (v.not instanceof Date) return !(cur instanceof Date) || cur.getTime() !== v.not.getTime();
        return cur !== v.not;
      }
      return r[k] === v;
    }),
  );
}

function makeService(config: Record<string, string | undefined>) {
  const rows = () => [row, otherRow];
  const prisma: Row = {
    employerInterview: {
      findFirst: async ({ where }: Row) => rows().find((r) => r.id === where.id && (!where.candidateId || r.candidateId === where.candidateId)) ?? null,
      findUnique: async ({ where }: Row) => rows().find((r) => r.id === where.id) ?? null,
      findUniqueOrThrow: async ({ where }: Row) => rows().find((r) => r.id === where.id),
      updateMany: async ({ where, data }: Row) => {
        const r = rows().find((x) => x.id === where.id);
        if (!r || (where.candidateId && r.candidateId !== where.candidateId)) return { count: 0 };
        if (where.status?.in && !where.status.in.includes(r.status)) return { count: 0 };
        if (!availabilityOr(r, where.OR)) return { count: 0 };
        Object.assign(r, data);
        return { count: 1 };
      },
    },
    whatsAppMessage: {
      findFirst: async ({ where }: Row) => {
        if (where.whatsappMessageId) return inbound.find((m) => m.whatsappMessageId === where.whatsappMessageId) ?? null;
        return outbound.find((m) => m.interviewId === where.interviewId && m.messageType === where.messageType) ?? null;
      },
      create: async ({ data }: Row) => {
        if (data.whatsappMessageId && inbound.some((m) => m.whatsappMessageId === data.whatsappMessageId)) {
          throw new Error('Unique constraint failed on whatsapp_message_id');
        }
        inbound.push(data);
        return data;
      },
      updateMany: async () => ({ count: 0 }),
    },
    user: {
      findFirst: async ({ where }: Row) =>
        JSON.stringify(where).includes('9800000001') ? { candidate: row.application.candidate } : null,
    },
  };
  const cfg = { get: (k: string, d?: string) => config[k] ?? d };
  const whatsapp = new WhatsAppService(cfg as any, prisma as any);
  (whatsapp as any).sendAndPersist = async (input: Row) => {
    outbound.push(input);
    return { ok: true, messageId: `wamid.out.${outbound.length}`, recordId: `r${outbound.length}` };
  };
  const notifications = { create: async (n: Row) => notes.push(n) };
  const email = { sendEmployerInterviewRescheduleRequest: async (e: Row) => emails.push(e) };
  const availability = new InterviewAvailabilityService(prisma as any, notifications as any, email as any, cfg as any);
  return new WhatsAppWebhookService(prisma as any, whatsapp, cfg as any, {} as any, notifications as any, availability);
}

const FLOW_CONFIG = { WHATSAPP_RESCHEDULE_FLOW_ID: FLOW_ID, JWT_ACCESS_SECRET: JWT, PUBLIC_WEB_URL: 'https://web.example' };

function interviewRow(id: string, candidateId: string, phone: string): Row {
  return {
    id,
    candidateId,
    status: 'RESCHEDULE_NEEDED',
    scheduledAt: new Date(Date.now() + 3 * 86_400_000),
    timezone: 'Asia/Kolkata',
    notes: null,
    confirmedAt: null,
    candidateRescheduleRequestedAt: new Date(),
    candidateAvailableFrom: null,
    candidateAvailableUntil: null,
    employer: { userId: 'uEmp', companyName: 'Acme Hiring', contactName: 'Priya', user: { id: 'uEmp', email: 'employer@example.test' } },
    application: {
      job: { title: 'Sales Executive' },
      candidate: { id: candidateId, userId: `u-${candidateId}`, firstName: 'Asha', lastName: 'K', whatsappOptIn: true, whatsappNumber: `+${phone}`, user: { phone: null } },
    },
  };
}

function tokenFor(r: Row, overrides: Partial<{ interviewId: string; candidateId: string; scheduledAtMs: number; expiresAtMs: number }> = {}, key = KEY) {
  return signFlowToken(
    {
      interviewId: r.id,
      candidateId: r.candidateId,
      scheduledAtMs: r.scheduledAt.getTime(),
      expiresAtMs: Date.now() + 86_400_000,
      ...overrides,
    },
    key,
  );
}

function flowWebhook(response: unknown, opts: { from?: string; id?: string } = {}) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { display_phone_number: '15550000000' },
              messages: [
                {
                  from: opts.from ?? PHONE,
                  id: opts.id ?? `wamid.in.${++wamid}`,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: 'interactive',
                  interactive: {
                    type: 'nfm_reply',
                    nfm_reply: { name: 'flow', body: 'Sent', response_json: typeof response === 'string' ? response : JSON.stringify(response) },
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

const submission = (r: Row, fields: Row = {}) => ({
  flow_token: tokenFor(r),
  date: istDate(5),
  available_from: '15:00',
  available_until: '18:00',
  ...fields,
});
const texts = () => outbound.filter((m) => m.payload?.type === 'text').map((m) => m.payload.text.body as string);
const flows = () => outbound.filter((m) => m.payload?.interactive?.type === 'flow');

beforeEach(() => {
  row = interviewRow(IV, CAND, PHONE);
  otherRow = interviewRow(OTHER_IV, 'cand-2', '919800000002');
  outbound = [];
  inbound = [];
  notes = [];
  emails = [];
  svc = makeService(FLOW_CONFIG);
});

describe('Flow token', () => {
  it('round-trips and rejects tampering, another key and expiry', () => {
    const token = tokenFor(row);
    const ok = verifyFlowToken(token, KEY);
    assert.ok(ok.ok && ok.claims.interviewId === IV && ok.claims.candidateId === CAND);
    const [p, body, mac] = token.split('.');
    const forgedBody = Buffer.from(`${OTHER_IV}|${CAND}|1|9999999999999`).toString('base64url');
    assert.deepEqual(verifyFlowToken(`${p}.${forgedBody}.${mac}`, KEY), { ok: false, reason: 'bad_signature' });
    assert.deepEqual(verifyFlowToken(tokenFor(row, {}, flowTokenKey({ flowTokenSecret: 'other' })!), KEY), { ok: false, reason: 'bad_signature' });
    assert.deepEqual(verifyFlowToken(tokenFor(row, { expiresAtMs: Date.now() - 1 }), KEY), { ok: false, reason: 'expired' });
    assert.deepEqual(verifyFlowToken('not-a-token', KEY), { ok: false, reason: 'malformed' });
    assert.ok(body.length > 0);
  });

  it('derived key differs from the JWT secret itself', () => {
    assert.notEqual(KEY.toString('utf8'), JWT);
    assert.equal(flowTokenKey({}), null);
  });
});

describe('Flow JSON', () => {
  it('uses DatePicker + two Dropdowns and completes with structured fields', () => {
    const json = buildRescheduleFlowJson();
    const screen = json.screens[0];
    assert.equal(screen.id, RESCHEDULE_FLOW_SCREEN);
    const types = screen.layout.children.map((c: Row) => c.type);
    assert.deepEqual(types, ['TextSubheading', 'TextBody', 'DatePicker', 'Dropdown', 'Dropdown', 'TextCaption', 'Footer']);
    const footer: Row = screen.layout.children.at(-1)!;
    assert.deepEqual(footer['on-click-action'], {
      name: 'complete',
      payload: { date: '${form.date}', available_from: '${form.available_from}', available_until: '${form.available_until}' },
    });
    assert.equal(availabilityTimeOptions('from')[0].id, '07:00');
    assert.equal(availabilityTimeOptions('from').at(-1)!.id, '21:30');
    assert.equal(availabilityTimeOptions('until')[0].id, '07:30');
    assert.equal(availabilityTimeOptions('until').at(-1)!.title, '10:00 PM');
  });
});

describe('1. Flow initialization ("Choose Another Time" tap)', () => {
  it('sends the Flow with a signed token and the date limits, and moves to RESCHEDULE_NEEDED', async () => {
    row.status = 'SCHEDULED';
    const res: any = await svc.applyInteractiveAction({ from: PHONE, payload: `RESCHEDULE:${IV}`, messageId: 'wamid.tap.1', candidateId: CAND });
    assert.equal(res.link, 'flow_sent');
    assert.equal(row.status, 'RESCHEDULE_NEEDED');
    assert.equal(flows().length, 1);
    const sent = flows()[0];
    assert.equal(sent.messageType, 'interview_reschedule_link');
    const params = sent.payload.interactive.action.parameters;
    assert.equal(params.flow_id, FLOW_ID);
    assert.equal(params.flow_action, 'navigate');
    assert.equal(params.flow_cta, 'Choose Another Time');
    assert.equal(params.flow_action_payload.screen, 'AVAILABILITY');
    assert.equal(params.flow_action_payload.data.min_date, istDate(0));
    assert.equal(params.flow_action_payload.data.intro, 'Sales Executive at Acme Hiring');
    const claims = verifyFlowToken(params.flow_token, KEY);
    assert.ok(claims.ok && claims.claims.interviewId === IV && claims.claims.candidateId === CAND);
    assert.ok(!JSON.stringify(sent.payload).includes('https://web.example'), 'no website link in the Flow message');

    const again: any = await svc.applyInteractiveAction({ from: PHONE, payload: `RESCHEDULE:${IV}`, messageId: 'wamid.tap.2', candidateId: CAND });
    assert.equal(again.link, 'already_sent');
    assert.equal(flows().length, 1);
  });

  it('falls back to the website link when no Flow is configured', async () => {
    svc = makeService({ JWT_ACCESS_SECRET: JWT, PUBLIC_WEB_URL: 'https://web.example' });
    row.status = 'SCHEDULED';
    const res: any = await svc.applyInteractiveAction({ from: PHONE, payload: `RESCHEDULE:${IV}`, candidateId: CAND });
    assert.equal(res.link, 'sent');
    assert.equal(flows().length, 0);
    assert.equal(outbound[0].payload.interactive.type, 'cta_url');
    assert.equal(outbound[0].payload.interactive.action.parameters.url, `https://web.example/interviews/reschedule/${IV}`);
  });

  it('never stores the flow token in the message log', async () => {
    const created: Row[] = [];
    const prisma = {
      whatsAppMessage: {
        create: async ({ data }: Row) => (created.push(data), { id: 'r1' }),
        update: async () => ({}),
      },
    };
    const wa = new WhatsAppService({ get: (k: string, d?: string) => (k === 'WHATSAPP_PHONE_NUMBER_ID' ? '123' : d) } as any, prisma as any);
    (wa as any).graphPost = async () => ({ ok: true, data: { messages: [{ id: 'wamid.x' }] } });
    const token = tokenFor(row);
    await wa.sendRescheduleFlow({ to: PHONE, interviewId: IV, flowId: FLOW_ID, flowToken: token, screenData: {} });
    assert.ok(!created[0].payloadJson.includes(token));
    assert.match(created[0].payloadJson, /"flow_token":"\[redacted\]"/);
  });
});

describe('2/11/12/13. Valid submission', () => {
  it('moves to RESCHEDULE_REQUESTED, notifies the employer and confirms to the candidate', async () => {
    await svc.handleWebhook(flowWebhook(submission(row)) as any);
    assert.equal(row.status, 'RESCHEDULE_REQUESTED');
    assert.equal(row.whatsappStatus, 'AVAILABILITY_SUBMITTED_VIA_WA_FLOW');
    assert.equal(row.candidateTimezone, 'Asia/Kolkata');
    assert.ok(row.candidateAvailableFrom instanceof Date && row.candidateAvailableUntil > row.candidateAvailableFrom);

    const employerBell = notes.find((n) => n.userId === 'uEmp');
    assert.equal(employerBell?.title, 'Candidate proposed a new time');
    assert.match(employerBell?.body, /Candidate proposed time: .*3:00 PM - 6:00 PM/);
    assert.equal(emails.length, 1);
    assert.equal(emails[0].to, 'employer@example.test');

    assert.equal(notes.find((n) => n.userId === `u-${CAND}`)?.title, 'Availability sent');
    const reply = texts().at(-1)!;
    assert.match(reply, /^Thank you\. Your new availability has been sent to the employer\./);
    assert.match(reply, /Candidate proposed time: .*3:00 PM - 6:00 PM/);
    assert.ok(!/https?:\/\//.test(reply), 'no website link in the confirmation');
    assert.equal(inbound[0].payloadJson.includes('flow_token'), false, 'inbound log has no token');
  });
});

describe('3-6. Validation (shared rules) keeps the candidate in WhatsApp', () => {
  const cases: Array<[string, Row, RegExp, (() => void)?]> = [
    ['invalid date', { date: '2026-02-30' }, /^Enter a valid date\. Please choose again\.$/],
    ['past date', { date: istDate(-2) }, /^Available From cannot be in the past\. Please choose again\.$/],
    ['From >= Until', { available_from: '18:00', available_until: '15:00' }, /^Available From must be earlier than Available Until\. Please choose again\.$/],
    ['invalid time value', { available_from: '25:00' }, /^Enter valid times/],
  ];
  for (const [name, fields, message] of cases) {
    it(`${name}: no change, fresh Flow with the reason`, async () => {
      const res: any = await svc.handleFlowSubmission({ from: PHONE, responseJson: JSON.stringify(submission(row, fields)) });
      assert.equal(res.reason, 'flow_invalid');
      assert.equal(row.status, 'RESCHEDULE_NEEDED');
      assert.equal(notes.length, 0);
      assert.equal(flows().length, 1);
      assert.match(flows()[0].payload.interactive.body.text, message);
    });
  }

  it('invalid timezone on the interview is rejected by the shared rules', async () => {
    row.timezone = 'Mars/Olympus_Mons';
    const res: any = await svc.handleFlowSubmission({ from: PHONE, responseJson: JSON.stringify(submission(row)) });
    assert.equal(res.reason, 'flow_invalid');
    assert.equal(row.status, 'RESCHEDULE_NEEDED');
  });
});

describe('7. Unauthorized attempts', () => {
  it('another phone cannot submit for this interview', async () => {
    const res: any = await svc.handleFlowSubmission({ from: '919811111111', responseJson: JSON.stringify(submission(row)) });
    assert.equal(res.reason, 'unauthorized_candidate');
    assert.equal(row.status, 'RESCHEDULE_NEEDED');
    assert.equal(outbound.length, 0);
  });

  it('a token for someone else\'s interview is refused even from a known candidate', async () => {
    const res: any = await svc.handleFlowSubmission({ from: PHONE, responseJson: JSON.stringify({ ...submission(row), flow_token: tokenFor(otherRow) }) });
    assert.equal(res.reason, 'unauthorized_candidate');
    assert.equal(otherRow.status, 'RESCHEDULE_NEEDED');
  });

  it('a forged interview id (not signed by us) is refused', async () => {
    const token = tokenFor(row, { interviewId: OTHER_IV }, flowTokenKey({ flowTokenSecret: 'attacker' })!);
    const res: any = await svc.handleFlowSubmission({ from: PHONE, responseJson: JSON.stringify({ ...submission(row), flow_token: token }) });
    assert.equal(res.reason, 'flow_token_bad_signature');
  });

  it('expired and stale tokens are refused', async () => {
    let res: any = await svc.handleFlowSubmission({ from: PHONE, responseJson: JSON.stringify({ ...submission(row), flow_token: tokenFor(row, { expiresAtMs: Date.now() - 1000 }) }) });
    assert.equal(res.reason, 'flow_token_expired');
    res = await svc.handleFlowSubmission({ from: PHONE, responseJson: JSON.stringify({ ...submission(row), flow_token: tokenFor(row, { scheduledAtMs: row.scheduledAt.getTime() - 86_400_000 }) }) });
    assert.equal(res.reason, 'flow_stale');
    assert.equal(row.status, 'RESCHEDULE_NEEDED');
  });
});

describe('8. Duplicate submissions', () => {
  it('a Meta retry of the same message is ignored; a repeat with the same window notifies once', async () => {
    const body = flowWebhook(submission(row), { id: 'wamid.dup.1' });
    await svc.handleWebhook(body as any);
    await svc.handleWebhook(body as any);
    assert.equal(emails.length, 1);
    assert.equal(texts().length, 1);

    await svc.handleWebhook(flowWebhook(submission(row)) as any);
    assert.equal(row.status, 'RESCHEDULE_REQUESTED');
    assert.equal(emails.length, 1, 'no second employer email');
    assert.equal(notes.filter((n) => n.userId === 'uEmp').length, 1, 'no second employer bell');
    assert.match(texts().at(-1)!, /^Your availability has already been sent to the employer\./);
  });

  it('a different window updates the request and notifies again', async () => {
    await svc.handleWebhook(flowWebhook(submission(row)) as any);
    await svc.handleWebhook(flowWebhook(submission(row, { available_from: '10:00', available_until: '12:00' })) as any);
    assert.equal(emails.length, 2);
    assert.match(texts().at(-1)!, /10:00 AM - 12:00 PM/);
  });
});

describe('9/10. Closed or confirmed interviews', () => {
  it('already-confirmed interview: no change', async () => {
    row.status = 'CONFIRMED';
    const res: any = await svc.handleFlowSubmission({ from: PHONE, responseJson: JSON.stringify(submission(row)) });
    assert.equal(res.reason, 'flow_already_confirmed');
    assert.equal(row.status, 'CONFIRMED');
    assert.equal(notes.length, 0);
    assert.match(texts()[0], /already confirmed/);
  });

  it('cancelled interview: no change', async () => {
    row.status = 'CANCELLED';
    const res: any = await svc.handleFlowSubmission({ from: PHONE, responseJson: JSON.stringify(submission(row)) });
    assert.equal(res.reason, 'flow_interview_closed');
    assert.equal(row.status, 'CANCELLED');
    assert.equal(texts()[0], 'This interview is no longer active, so it cannot be rescheduled.');
  });
});

describe('14. Malformed Flow payloads', () => {
  it('non-JSON / missing token are dropped without touching any interview', async () => {
    for (const bad of ['{not json', '[]', JSON.stringify({ date: istDate(5) })]) {
      const res: any = await svc.handleFlowSubmission({ from: PHONE, responseJson: bad });
      assert.equal(res.reason, 'malformed_flow_payload');
    }
    assert.equal(outbound.length, 0);
    assert.equal(row.status, 'RESCHEDULE_NEEDED');
  });

  it('valid token but missing fields: fresh Flow, no change', async () => {
    const res: any = await svc.handleFlowSubmission({ from: PHONE, responseJson: JSON.stringify({ flow_token: tokenFor(row), date: istDate(5) }) });
    assert.equal(res.reason, 'flow_invalid');
    assert.equal(row.status, 'RESCHEDULE_NEEDED');
    assert.match(flows()[0].payload.interactive.body.text, /could not read your selection/);
  });

  it('parseFlowSubmission accepts epoch-millisecond dates from older clients', () => {
    const ms = Date.parse('2026-10-05T10:00:00+05:30');
    const parsed = parseFlowSubmission({ flow_token: 't', date: String(ms), available_from: '15:00', available_until: '18:00' });
    assert.ok(parsed.ok && parsed.date === '2026-10-05');
  });
});

describe('Website form still uses the same rules', () => {
  it('portal source accepts a confirmed interview (website "Change availability"), the Flow does not', async () => {
    row.status = 'CONFIRMED';
    const availability = (svc as any).availability as InterviewAvailabilityService;
    const portal = await availability.submitAvailability({
      interviewId: IV,
      candidateId: CAND,
      body: { date: istDate(5), availableFrom: '15:00', availableUntil: '18:00', timezone: 'Asia/Kolkata' },
      source: 'PORTAL',
    });
    assert.ok(portal.ok && portal.changed);
    assert.equal(row.whatsappStatus, 'AVAILABILITY_SUBMITTED_VIA_PORTAL');
    const wrongOwner = await availability.submitAvailability({ interviewId: IV, candidateId: 'cand-2', body: {}, source: 'PORTAL' });
    assert.deepEqual(wrongOwner, { ok: false, reason: 'not_found', message: 'Interview was not found' });
  });
});
