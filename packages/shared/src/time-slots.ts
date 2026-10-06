export type TimeSlot = { value: string; label: string };

function label(hours: number, minutes: number) {
  const suffix = hours < 12 ? 'AM' : 'PM';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(h12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

/** Slots from startHour (inclusive) to endHour (inclusive of its :00 slot), e.g. 09:00 AM, 09:30 AM, … */
export function timeSlots(startHour = 7, endHour = 22, stepMinutes = 30): TimeSlot[] {
  const out: TimeSlot[] = [];
  for (let total = startHour * 60; total <= endHour * 60; total += stepMinutes) {
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    out.push({ value: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`, label: label(hours, minutes) });
  }
  return out;
}

/** 'HH:MM' (24h) → '09:30 AM'; returns the input unchanged when it is not a valid time. */
export function formatTimeSlotLabel(value: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return value;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return value;
  return label(hours, minutes);
}
