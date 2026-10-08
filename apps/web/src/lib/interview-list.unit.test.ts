import assert from 'node:assert/strict';
import { test } from 'node:test';
import { candidateInterviewSections, isUpcomingInterview, type ListedInterview } from './interview-list';

const NOW = Date.parse('2026-10-08T06:00:00.000Z');
const at = (hours: number) => new Date(NOW + hours * 3_600_000).toISOString();

function iv(id: string, status: string, hours: number): ListedInterview & { id: string } {
  return { id, status, scheduledAt: at(hours), scheduledDate: at(hours).slice(0, 10), durationMin: 30 };
}

const rows = [
  iv('confirmed', 'CONFIRMED', 48),
  iv('awaiting', 'PENDING_CONFIRMATION', 24),
  iv('reschedule', 'RESCHEDULE_REQUESTED', 72),
  iv('cancelled-upcoming', 'CANCELLED', 12),
  iv('cancelled-past', 'CANCELLED', -12),
  iv('completed', 'COMPLETED', -48),
  iv('missed', 'PENDING_CONFIRMATION', -24),
];

test('active and scheduled interviews appear in Upcoming, soonest first', () => {
  const { upcoming } = candidateInterviewSections(rows, NOW);
  assert.deepEqual(upcoming.map((r) => r.id), ['awaiting', 'confirmed', 'reschedule']);
});

test('cancelled interviews appear in neither Upcoming nor history', () => {
  const { upcoming, history } = candidateInterviewSections(rows, NOW);
  const ids = [...upcoming, ...history].map((r) => r.id);
  assert.ok(!ids.includes('cancelled-upcoming'));
  assert.ok(!ids.includes('cancelled-past'));
});

test('past non-cancelled interviews stay in history, latest first', () => {
  const { history } = candidateInterviewSections(rows, NOW);
  assert.deepEqual(history.map((r) => r.id), ['missed', 'completed']);
});

test('non-cancelled interviews are unaffected by the filter', () => {
  const withoutCancelled = rows.filter((r) => r.status !== 'CANCELLED');
  const a = candidateInterviewSections(rows, NOW);
  const b = candidateInterviewSections(withoutCancelled, NOW);
  assert.deepEqual(a, b);
});

test('an interview stays upcoming until its slot has ended', () => {
  assert.equal(isUpcomingInterview(iv('now', 'CONFIRMED', -0.25), NOW), true);
  assert.equal(isUpcomingInterview(iv('over', 'CONFIRMED', -1), NOW), false);
  assert.equal(isUpcomingInterview(iv('cancelled', 'CANCELLED', 5), NOW), false);
});
