import { createHmac, hkdfSync, timingSafeEqual } from 'crypto';

/** WhatsApp Flow used for "Choose Another Time" (no data endpoint: the submission arrives as an `nfm_reply` webhook). */
export const RESCHEDULE_FLOW_SCREEN = 'AVAILABILITY';
export const RESCHEDULE_FLOW_CTA = 'Choose Another Time';
export const RESCHEDULE_FLOW_NAME = 'careerbridge_interview_reschedule';
export const RESCHEDULE_FLOW_JSON_VERSION = '7.2';
/** Flow messages stay openable in the chat; the token behind them expires. */
export const FLOW_TOKEN_TTL_MS = 7 * 86_400_000;

const TOKEN_PREFIX = 'cbrf1';
const AVAILABILITY_FIRST_HOUR = 7;
const AVAILABILITY_LAST_HOUR = 22;

export type FlowTokenClaims = {
  interviewId: string;
  candidateId: string;
  /** scheduledAt of the interview when the Flow was sent; a later employer reschedule voids the token. */
  scheduledAtMs: number;
  expiresAtMs: number;
};

/**
 * Key for flow tokens: WHATSAPP_FLOW_TOKEN_SECRET when set, otherwise derived (HKDF) from the JWT access
 * secret with a dedicated label, so the derived key is never usable as a JWT key.
 */
export function flowTokenKey(env: { flowTokenSecret?: string; jwtAccessSecret?: string }): Buffer | null {
  const dedicated = env.flowTokenSecret?.trim();
  if (dedicated) return Buffer.from(dedicated, 'utf8');
  const base = env.jwtAccessSecret?.trim();
  if (!base) return null;
  return Buffer.from(hkdfSync('sha256', base, 'careerbridge', 'whatsapp-flow-token-v1', 32));
}

function mac(key: Buffer, body: string) {
  return createHmac('sha256', key).update(`${TOKEN_PREFIX}.${body}`).digest('base64url');
}

export function signFlowToken(claims: FlowTokenClaims, key: Buffer): string {
  const body = Buffer.from(
    [claims.interviewId, claims.candidateId, claims.scheduledAtMs, claims.expiresAtMs].join('|'),
    'utf8',
  ).toString('base64url');
  return `${TOKEN_PREFIX}.${body}.${mac(key, body)}`;
}

export type FlowTokenCheck =
  | { ok: true; claims: FlowTokenClaims }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' };

export function verifyFlowToken(token: unknown, key: Buffer, now = Date.now()): FlowTokenCheck {
  if (typeof token !== 'string' || token.length > 512) return { ok: false, reason: 'malformed' };
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX || !parts[1] || !parts[2]) {
    return { ok: false, reason: 'malformed' };
  }
  const expected = Buffer.from(mac(key, parts[1]));
  const given = Buffer.from(parts[2]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, reason: 'bad_signature' };
  }
  const fields = Buffer.from(parts[1], 'base64url').toString('utf8').split('|');
  const [interviewId, candidateId] = fields;
  const scheduledAtMs = Number(fields[2]);
  const expiresAtMs = Number(fields[3]);
  if (fields.length !== 4 || !interviewId || !candidateId || !Number.isFinite(scheduledAtMs) || !Number.isFinite(expiresAtMs)) {
    return { ok: false, reason: 'malformed' };
  }
  if (expiresAtMs < now) return { ok: false, reason: 'expired' };
  return { ok: true, claims: { interviewId, candidateId, scheduledAtMs, expiresAtMs } };
}

export type FlowSubmission =
  | { ok: true; flowToken: string; date: string; availableFrom: string; availableUntil: string }
  | { ok: false; reason: 'not_json' | 'missing_token' | 'missing_fields'; flowToken?: string };

function isoDateInZone(ms: number, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(ms),
  );
}

/** `nfm_reply.response_json` → structured fields. Values are validated later by the shared availability rules. */
export function parseFlowSubmission(responseJson: unknown, timeZone = 'Asia/Kolkata'): FlowSubmission {
  let data: unknown = responseJson;
  if (typeof responseJson === 'string') {
    try {
      data = JSON.parse(responseJson);
    } catch {
      return { ok: false, reason: 'not_json' };
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, reason: 'not_json' };
  const record = data as Record<string, unknown>;
  const flowToken = typeof record.flow_token === 'string' ? record.flow_token : '';
  if (!flowToken) return { ok: false, reason: 'missing_token' };

  // Flow JSON >= 5.0 returns YYYY-MM-DD; older clients send epoch milliseconds.
  let date = typeof record.date === 'string' ? record.date.trim() : typeof record.date === 'number' ? String(record.date) : '';
  if (/^\d{10,13}$/.test(date)) date = isoDateInZone(Number(date.length === 10 ? `${date}000` : date), timeZone);
  const availableFrom = typeof record.available_from === 'string' ? record.available_from.trim() : '';
  const availableUntil = typeof record.available_until === 'string' ? record.available_until.trim() : '';
  if (!date || !availableFrom || !availableUntil) return { ok: false, reason: 'missing_fields', flowToken };
  return { ok: true, flowToken, date, availableFrom, availableUntil };
}

function clockLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** 30-minute options in the same 7:00 AM – 10:00 PM range as the website form. */
export function availabilityTimeOptions(kind: 'from' | 'until') {
  const options: Array<{ id: string; title: string }> = [];
  const start = AVAILABILITY_FIRST_HOUR * 60 + (kind === 'until' ? 30 : 0);
  const end = AVAILABILITY_LAST_HOUR * 60 - (kind === 'from' ? 30 : 0);
  for (let t = start; t <= end; t += 30) {
    options.push({ id: `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`, title: clockLabel(t) });
  }
  return options;
}

/** Initial screen data sent with the Flow message (`flow_action: navigate`). */
export function rescheduleFlowScreenData(input: {
  jobTitle: string;
  companyName?: string | null;
  timeZone: string;
  now?: Date;
  maxDaysAhead?: number;
}) {
  const now = input.now ?? new Date();
  const maxDays = input.maxDaysAhead ?? 179;
  const zoneLabel =
    input.timeZone === 'Asia/Kolkata' || input.timeZone === 'Asia/Calcutta'
      ? 'India Standard Time (IST)'
      : input.timeZone;
  return {
    intro: `${input.jobTitle}${input.companyName ? ` at ${input.companyName}` : ''}`.slice(0, 80),
    timezone_note: `Times are in ${zoneLabel}.`,
    min_date: isoDateInZone(now.getTime(), input.timeZone),
    max_date: isoDateInZone(now.getTime() + maxDays * 86_400_000, input.timeZone),
  };
}

/** Flow JSON uploaded to Meta by scripts/whatsapp-flow-setup-dev.ts. */
export function buildRescheduleFlowJson(version = RESCHEDULE_FLOW_JSON_VERSION) {
  return {
    version,
    screens: [
      {
        id: RESCHEDULE_FLOW_SCREEN,
        title: 'Choose Another Time',
        terminal: true,
        success: true,
        data: {
          intro: { type: 'string', __example__: 'Sales Executive at CareerBridge' },
          timezone_note: { type: 'string', __example__: 'Times are in India Standard Time (IST).' },
          min_date: { type: 'string', __example__: '2026-10-01' },
          max_date: { type: 'string', __example__: '2027-03-29' },
        },
        layout: {
          type: 'SingleColumnLayout',
          children: [
            { type: 'TextSubheading', text: '${data.intro}' },
            { type: 'TextBody', text: 'Select the date and the time range when you are available.' },
            {
              type: 'DatePicker',
              name: 'date',
              label: 'Date',
              required: true,
              'min-date': '${data.min_date}',
              'max-date': '${data.max_date}',
            },
            {
              type: 'Dropdown',
              name: 'available_from',
              label: 'Available From',
              required: true,
              'data-source': availabilityTimeOptions('from'),
            },
            {
              type: 'Dropdown',
              name: 'available_until',
              label: 'Available Until',
              required: true,
              'data-source': availabilityTimeOptions('until'),
            },
            { type: 'TextCaption', text: '${data.timezone_note}' },
            {
              type: 'Footer',
              label: 'Submit',
              'on-click-action': {
                name: 'complete',
                payload: {
                  date: '${form.date}',
                  available_from: '${form.available_from}',
                  available_until: '${form.available_until}',
                },
              },
            },
          ],
        },
      },
    ],
  };
}
