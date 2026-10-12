import assert from 'node:assert/strict';
import { test } from 'node:test';
import { THINK_SECONDS } from './guided-states';
import {
  ANSWER_LIMIT_SEC,
  advanceAction,
  answerBarColor,
  answerClockShouldRun,
  answerCountdown,
  beginExpiryAdvance,
  beginManualAdvance,
  createAdvanceGate,
  formatAnswerClock,
  isLastMockQuestion,
  phaseAfterSavedAnswer,
  releaseAdvance,
  releaseAfterFailedSubmit,
  resetAdvanceGate,
  syncAnswerTimer,
} from './answer-countdown';

const LIMIT_MS = ANSWER_LIMIT_SEC * 1000;

test('mock interview preparation time is 30 seconds and each answer starts at 60', () => {
  assert.equal(THINK_SECONDS, 30);
  assert.equal(ANSWER_LIMIT_SEC, 60);
});

test('countdown clock formats a fresh minute and reaches 00:00 exactly at the deadline', () => {
  const started = answerCountdown(0, LIMIT_MS);
  assert.equal(started.label, '01:00');
  assert.equal(started.remainingSec, 60);
  assert.equal(started.progress, 1);
  assert.equal(started.expired, false);

  assert.equal(answerCountdown(1_000, LIMIT_MS).label, '00:59');
  assert.equal(formatAnswerClock(59), '00:59');

  const done = answerCountdown(LIMIT_MS, LIMIT_MS);
  assert.equal(done.label, '00:00');
  assert.equal(done.remainingSec, 0);
  assert.equal(done.progress, 0);
  assert.equal(done.expired, true);
  assert.equal(answerCountdown(LIMIT_MS + 5_000, LIMIT_MS).progress, 0);
});

test('bar stays blue for the first 29 seconds, turns orange at 30, and red at 45', () => {
  assert.equal(answerBarColor(0), 'blue');
  assert.equal(answerBarColor(29), 'blue');
  assert.equal(answerBarColor(29.999), 'blue');
  assert.equal(answerCountdown(29_999, LIMIT_MS).color, 'blue');

  assert.equal(answerBarColor(30), 'orange');
  assert.equal(answerCountdown(30_000, LIMIT_MS).color, 'orange');
  assert.equal(answerCountdown(30_000, LIMIT_MS).label, '00:30');
  assert.equal(answerBarColor(44), 'orange');
  assert.equal(answerBarColor(44.999), 'orange');
  assert.equal(answerCountdown(44_999, LIMIT_MS).color, 'orange');

  assert.equal(answerBarColor(45), 'red');
  assert.equal(answerCountdown(45_000, LIMIT_MS).color, 'red');
  assert.equal(answerCountdown(45_000, LIMIT_MS).label, '00:15');
  assert.equal(answerBarColor(60), 'red');
  assert.equal(answerCountdown(LIMIT_MS, LIMIT_MS).color, 'red');
});

test('the filled portion tracks remaining time from the deadline, not tick count', () => {
  const deadline = 10_000 + LIMIT_MS;
  const halfway = answerCountdown(10_000 + 30_000, deadline);
  assert.equal(halfway.progress, 0.5);
  assert.equal(halfway.elapsedSec, 30);
  assert.equal(halfway.color, 'orange');

  const jumped = answerCountdown(deadline + 1_000, deadline);
  assert.equal(jumped.expired, true);
  assert.equal(jumped.label, '00:00');
});

test('thinking and the first get-ready intro do not start the answer clock', () => {
  const thinking = syncAnswerTimer(null, 0, 'QUESTION_THINKING', 1_000);
  assert.equal(thinking.deadlineMs, null);
  assert.equal(answerClockShouldRun('QUESTION_THINKING', thinking.deadlineMs), false);

  const intro = syncAnswerTimer(null, 0, 'RECORDING_COUNTDOWN', 2_000);
  assert.equal(intro.deadlineMs, null);
  assert.equal(answerClockShouldRun('RECORDING_COUNTDOWN', null), false);
});

test('each question starts one 60 second deadline when answering begins', () => {
  const recording = syncAnswerTimer(null, 0, 'RECORDING_ACTIVE', 5_000);
  assert.equal(recording.deadlineMs, 5_000 + LIMIT_MS);
  assert.equal(answerClockShouldRun('RECORDING_ACTIVE', recording.deadlineMs), true);

  const typing = syncAnswerTimer(null, 1, 'TYPING_ACTIVE', 8_000);
  assert.equal(typing.deadlineMs, 8_000 + LIMIT_MS);
});

test('switching answer mode or recording again keeps the same deadline', () => {
  const started = syncAnswerTimer(null, 0, 'RECORDING_ACTIVE', 1_000);
  const retake = syncAnswerTimer(started, 0, 'RECORDING_COUNTDOWN', 20_000);
  assert.equal(retake.deadlineMs, started.deadlineMs);
  assert.equal(answerClockShouldRun('RECORDING_COUNTDOWN', retake.deadlineMs), true);

  const typed = syncAnswerTimer(retake, 0, 'TYPING_ACTIVE', 40_000);
  assert.equal(typed.deadlineMs, started.deadlineMs);

  const recordedAgain = syncAnswerTimer(typed, 0, 'RECORDING_ACTIVE', 70_000);
  assert.equal(recordedAgain.deadlineMs, started.deadlineMs);
});

test('the next question gets a fresh answer clock after thinking, not the previous deadline', () => {
  const first = syncAnswerTimer(null, 0, 'TYPING_ACTIVE', 1_000);
  const thinking = syncAnswerTimer(first, 1, 'QUESTION_THINKING', 90_000);
  assert.equal(thinking.questionIndex, 1);
  assert.equal(thinking.deadlineMs, null);

  const second = syncAnswerTimer(thinking, 1, 'RECORDING_ACTIVE', 120_000);
  assert.equal(second.deadlineMs, 120_000 + LIMIT_MS);
  assert.notEqual(second.deadlineMs, first.deadlineMs);
});

test('manual advance is rejected while a submit is in flight and accepted after release', () => {
  const first = beginManualAdvance(createAdvanceGate());
  assert.equal(first.accepted, true);
  const second = beginManualAdvance(first.gate);
  assert.equal(second.accepted, false);
  assert.equal(second.gate, first.gate);

  const released = beginManualAdvance(releaseAdvance(first.gate));
  assert.equal(released.accepted, true);
});

test('expiry advances once per question and does not double-submit after a manual attempt', () => {
  const manual = beginManualAdvance(createAdvanceGate());
  const duringManual = beginExpiryAdvance(manual.gate, 0);
  assert.equal(duringManual.accepted, false);
  assert.equal(duringManual.gate.expiryQuestion, 0);

  const afterManualFails = beginExpiryAdvance(releaseAdvance(duringManual.gate), 0);
  assert.equal(afterManualFails.accepted, false);

  const retry = beginManualAdvance(releaseAdvance(duringManual.gate));
  assert.equal(retry.accepted, true);
});

test('a failed automatic submit can be retried manually but does not fire expiry again', () => {
  const expired = beginExpiryAdvance(createAdvanceGate(), 2);
  assert.equal(expired.accepted, true);

  const again = beginExpiryAdvance(releaseAdvance(expired.gate), 2);
  assert.equal(again.accepted, false);

  const manual = beginManualAdvance(releaseAdvance(expired.gate));
  assert.equal(manual.accepted, true);
});

test('a save that fails after time is up cannot be re-sent automatically', () => {
  const deadline = 60_000;
  const manual = beginManualAdvance(createAdvanceGate());
  const failedLate = releaseAfterFailedSubmit(manual.gate, 3, deadline + 2_000, deadline);
  assert.equal(failedLate.inFlight, false);
  assert.equal(beginExpiryAdvance(failedLate, 3).accepted, false);
  assert.equal(beginManualAdvance(failedLate).accepted, true);
});

test('a save that fails with time left still auto-submits once at 00:00', () => {
  const deadline = 60_000;
  const manual = beginManualAdvance(createAdvanceGate());
  const failedEarly = releaseAfterFailedSubmit(manual.gate, 3, 20_000, deadline);
  assert.equal(failedEarly.expiryQuestion, null);
  const expiry = beginExpiryAdvance(failedEarly, 3);
  assert.equal(expiry.accepted, true);
  assert.equal(beginExpiryAdvance(releaseAdvance(expiry.gate), 3).accepted, false);
});

test('time running out submits a valid answer and skips one that is too short', () => {
  assert.equal(advanceAction('expiry', true), 'submit');
  assert.equal(advanceAction('expiry', false), 'skip');
});

test('advancing by hand never skips: a too-short answer shows the validation message', () => {
  assert.equal(advanceAction('manual', true), 'submit');
  assert.equal(advanceAction('manual', false), 'showError');
});

test('a new question clears the advance gate', () => {
  const used = beginExpiryAdvance(createAdvanceGate(), 0);
  const fresh = resetAdvanceGate();
  const next = beginExpiryAdvance(fresh, 1);
  assert.equal(next.accepted, true);
  assert.notEqual(used.gate.expiryQuestion, next.gate.expiryQuestion);
});

test('the last saved answer uses the completion flow instead of another question', () => {
  assert.equal(isLastMockQuestion(5, 5), true);
  assert.equal(isLastMockQuestion(4, 5), false);
  assert.equal(phaseAfterSavedAnswer({ status: 'COMPLETED' }), 'FINAL_PROCESSING');
  assert.equal(phaseAfterSavedAnswer({ status: 'IN_PROGRESS', conductTerminated: true }), 'FINAL_PROCESSING');
  assert.equal(phaseAfterSavedAnswer({ status: 'IN_PROGRESS', conductTerminated: false }), 'QUESTION_DISPLAY');
});
