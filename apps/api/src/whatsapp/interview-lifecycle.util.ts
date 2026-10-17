import type { ReminderKind } from './whatsapp.types';

const REMINDER_MS: Record<ReminderKind, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '2h': 2 * 60 * 60 * 1000,
  '15m': 15 * 60 * 1000,
};

/** Tolerance windows so rescheduled/cancelled interviews never get stale reminders. */
const REMINDER_TOLERANCE_MS: Record<ReminderKind, number> = {
  '24h': 6 * 60 * 60 * 1000,
  '2h': 45 * 60 * 1000,
  '15m': 10 * 60 * 1000,
};

/**
 * Reminder is valid only when interview is still active and the current schedule
 * still matches this reminder kind's expected fire window.
 */
export function isReminderStillValid(input: {
  status: string;
  scheduledAt: Date;
  kind: ReminderKind;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (!['CONFIRMED', 'SCHEDULED'].includes(input.status)) {
    return { ok: false as const, reason: `status_${input.status}` };
  }
  if (input.scheduledAt.getTime() <= now.getTime()) {
    return { ok: false as const, reason: 'interview_started_or_past' };
  }
  const msBefore = REMINDER_MS[input.kind];
  const expectedFire = input.scheduledAt.getTime() - msBefore;
  const drift = Math.abs(now.getTime() - expectedFire);
  if (drift > REMINDER_TOLERANCE_MS[input.kind]) {
    return { ok: false as const, reason: 'outside_reminder_window' };
  }
  return { ok: true as const };
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  const da = a.replace(/\D/g, '');
  const db = b.replace(/\D/g, '');
  if (!da || !db) return false;
  if (da === db) return true;
  const norm = (d: string) => (d.length === 10 ? `91${d}` : d.startsWith('91') && d.length > 10 ? d : d);
  return norm(da) === norm(db);
}

/**
 * Outbound WhatsApp consent: only candidates who opted in, only to the number they opted in with
 * (registration stores it in whatsappNumber). The login phone is never used as a fallback.
 */
export function consentedWhatsAppNumber(candidate: {
  whatsappOptIn?: boolean | null;
  whatsappNumber?: string | null;
}): string | null {
  if (!candidate.whatsappOptIn) return null;
  const number = candidate.whatsappNumber?.trim();
  return number && /\d{10,}/.test(number.replace(/\D/g, '')) ? number : null;
}
