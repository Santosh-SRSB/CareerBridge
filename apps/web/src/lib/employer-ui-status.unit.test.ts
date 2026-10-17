import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applicationStatusMeta,
  initials,
  interviewStatusMeta,
  jobStatusChip,
  matchBarTone,
  matchPillTone,
  pipelineStage,
} from './employer-ui-status';

test('application statuses map to reference pill tones', () => {
  assert.deepEqual(applicationStatusMeta('APPLIED'), { label: 'Applied', tone: 'blue' });
  assert.deepEqual(applicationStatusMeta('SHORTLISTED'), { label: 'Shortlisted', tone: 'green' });
  assert.deepEqual(applicationStatusMeta('INTERVIEW'), { label: 'Interview', tone: 'amber' });
  assert.deepEqual(applicationStatusMeta('HIRED'), { label: 'Hired', tone: 'hired' });
  assert.deepEqual(applicationStatusMeta('REJECTED'), { label: 'Rejected', tone: 'red' });
  assert.deepEqual(applicationStatusMeta('SOMETHING_NEW'), { label: 'Something new', tone: 'default' });
  assert.equal(applicationStatusMeta(undefined).label, '—');
});

test('interview statuses keep the existing employer wording', () => {
  assert.equal(interviewStatusMeta('SCHEDULED').label, 'Awaiting confirmation');
  assert.equal(interviewStatusMeta('RESCHEDULE_NEEDED').label, 'Waiting for availability');
  assert.equal(interviewStatusMeta('CANCELLED').tone, 'red');
});

test('job status chips follow the jobs board', () => {
  assert.equal(jobStatusChip('PUBLISHED'), 'active');
  assert.equal(jobStatusChip('PAUSED'), 'paused');
  assert.equal(jobStatusChip('CLOSED'), 'closed');
  assert.equal(jobStatusChip('PENDING_REVIEW'), 'pending');
  assert.equal(jobStatusChip('DRAFT'), '');
});

test('pipeline stage drives the mini progress bar', () => {
  assert.equal(pipelineStage('APPLIED'), 0);
  assert.equal(pipelineStage('UNDER_REVIEW'), 0);
  assert.equal(pipelineStage('SHORTLISTED'), 1);
  assert.equal(pipelineStage('INTERVIEW'), 2);
  assert.equal(pipelineStage('HIRED'), 3);
  assert.equal(pipelineStage('REJECTED'), -1);
});

test('match tones and initials', () => {
  assert.equal(matchBarTone('EXCELLENT'), 'good');
  assert.equal(matchBarTone('GOOD'), 'good');
  assert.equal(matchBarTone('MODERATE'), 'mid');
  assert.equal(matchBarTone('LOW'), 'low');
  assert.equal(matchPillTone('blue'), 'blue');
  assert.equal(matchPillTone('grey'), 'default');
  assert.equal(initials('Ankit Raj'), 'AR');
  assert.equal(initials('  dev '), 'D');
  assert.equal(initials(''), '?');
});
