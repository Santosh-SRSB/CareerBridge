import assert from 'node:assert/strict';
import test from 'node:test';
import { formatTimeSlotLabel, timeSlots } from './time-slots';

test('timeSlots returns 30-minute steps with 12-hour labels', () => {
  const slots = timeSlots(9, 10);
  assert.deepEqual(slots, [
    { value: '09:00', label: '09:00 AM' },
    { value: '09:30', label: '09:30 AM' },
    { value: '10:00', label: '10:00 AM' },
  ]);
  const day = timeSlots(11, 13);
  assert.deepEqual(
    day.map((s) => s.label),
    ['11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '01:00 PM'],
  );
});

test('formatTimeSlotLabel formats valid times and leaves invalid input alone', () => {
  assert.equal(formatTimeSlotLabel('00:15'), '12:15 AM');
  assert.equal(formatTimeSlotLabel('18:45'), '06:45 PM');
  assert.equal(formatTimeSlotLabel('25:00'), '25:00');
});
