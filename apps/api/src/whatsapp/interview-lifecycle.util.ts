import type { ReminderKind } from './whatsapp.types';

/** Default offered reschedule offsets (hours after current scheduledAt). */
export const DEFAULT_RESCHEDULE_OFFSET_HOURS = [3, 5, 27] as const;

export function buildDefaultRescheduleSlots(from: Date, offsetsHours = DEFAULT_RESCHEDULE_OFFSET_HOURS) {
  return offsetsHours.map((hours) => new Date(from.getTime() + hours * 60 * 60 * 1000));
}

/**
 * Revalidate a slot at selection time — must match an offered slot (±2s).
 * Do not trust the client ISO alone.
 */
export function isOfferedRescheduleSlot(scheduledAt: Date, slotIso: string, now = Date.now()) {
  const next = new Date(slotIso);
  if (Number.isNaN(next.getTime())) return false;
  if (next.getTime() <= now - 60_000) return false;
  const offered = buildDefaultRescheduleSlots(scheduledAt);
  return offered.some((slot) => Math.abs(slot.getTime() - next.getTime()) <= 2_000);
}

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
