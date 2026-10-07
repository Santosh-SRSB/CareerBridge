import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ADMIN_INTERVIEW_STATUS_OPTIONS,
  adminInterviewFlowSteps,
  adminInterviewStatusLabel,
} from './admin-interview-status';

test('filter options are the stakeholder statuses, in flow order, with no raw interview enums', () => {
  assert.deepEqual(
    ADMIN_INTERVIEW_STATUS_OPTIONS.map((o) => o.label),
    [
      'Profile Shortlisted',
      'Interview Scheduled',
      'Interview Rescheduled',
      'Feedback Pending',
      'Selected',
      'Rejected',
      'Cancelled',
    ],
  );
  const values = ADMIN_INTERVIEW_STATUS_OPTIONS.map((o) => o.value as string);
  for (const raw of ['RESCHEDULE_NEEDED', 'RESCHEDULE_REQUESTED', 'PROPOSED', 'CONFIRMED', 'COMPLETED']) {
    assert.ok(!values.includes(raw), raw);
  }
});

test('labels resolve for admin statuses only', () => {
  assert.equal(adminInterviewStatusLabel('PROFILE_SHORTLISTED'), 'Profile Shortlisted');
  assert.equal(adminInterviewStatusLabel('FEEDBACK_PENDING'), 'Feedback Pending');
  assert.equal(adminInterviewStatusLabel('SELECTED'), 'Selected');
  assert.equal(adminInterviewStatusLabel('REJECTED'), 'Rejected');
  assert.equal(adminInterviewStatusLabel('CANCELLED'), 'Cancelled');
  assert.equal(adminInterviewStatusLabel('RESCHEDULE_REQUESTED'), null);
  assert.equal(adminInterviewStatusLabel(undefined), null);
});

test('flow marks exactly the current stage; outcome step names the actual outcome', () => {
  const fp = adminInterviewFlowSteps('FEEDBACK_PENDING');
  assert.equal(fp.cancelled, false);
  assert.deepEqual(fp.steps.filter((s) => s.current).map((s) => s.key), ['FEEDBACK_PENDING']);
  assert.equal(fp.steps.at(-1)?.label, 'Selected / Rejected');

  const selected = adminInterviewFlowSteps('SELECTED');
  assert.deepEqual(selected.steps.filter((s) => s.current).map((s) => s.label), ['Selected']);
  const rejected = adminInterviewFlowSteps('REJECTED');
  assert.deepEqual(rejected.steps.filter((s) => s.current).map((s) => s.label), ['Rejected']);

  const shortlisted = adminInterviewFlowSteps('PROFILE_SHORTLISTED');
  assert.deepEqual(shortlisted.steps.filter((s) => s.current).map((s) => s.key), ['PROFILE_SHORTLISTED']);
});

test('cancelled is outside the flow: no stage is current', () => {
  const c = adminInterviewFlowSteps('CANCELLED');
  assert.equal(c.cancelled, true);
  assert.equal(c.steps.some((s) => s.current), false);
});
