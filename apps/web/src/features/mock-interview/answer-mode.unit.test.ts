import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AUDIO_ANSWER_PLACEHOLDER,
  buildAnswerSubmission,
  canRecordAudio,
  defaultAnswerMethod,
} from './answer-mode';

const MIN = 20;
const fn = () => undefined;
class FakeRecorder {}

test('audio recording is the default answer method when the browser can record', () => {
  assert.equal(canRecordAudio({ getUserMedia: fn, MediaRecorder: FakeRecorder }), true);
  assert.equal(defaultAnswerMethod(true), 'recording');
});

test('browsers without getUserMedia or MediaRecorder fall back to typing', () => {
  assert.equal(canRecordAudio({ MediaRecorder: FakeRecorder }), false);
  assert.equal(canRecordAudio({ getUserMedia: fn }), false);
  assert.equal(canRecordAudio({}), false);
  assert.equal(defaultAnswerMethod(false), 'typing');
});

test('typing submits the typed words as TEXT and ignores an earlier recording', () => {
  const typed = 'I led the migration of our billing service to queues.';
  assert.deepEqual(buildAnswerSubmission('typing', { text: ` ${typed} `, hasAudio: true, audioDurationSec: 30 }, MIN), {
    ok: true,
    answer: typed,
    answerMode: 'TEXT',
  });
});

test('typing below the minimum is rejected even when audio was recorded earlier', () => {
  const result = buildAnswerSubmission('typing', { text: 'Too short', hasAudio: true, audioDurationSec: 12 }, MIN);
  assert.equal(result.ok, false);
});

test('a recording with a transcript sends the transcript with its duration', () => {
  assert.deepEqual(
    buildAnswerSubmission('recording', { text: 'I would profile the slow query first.', hasAudio: true, audioDurationSec: 18 }, MIN),
    { ok: true, answer: 'I would profile the slow query first.', answerMode: 'TEXT', durationSec: 18 },
  );
});

test('a recording without a usable transcript is sent as AUDIO', () => {
  assert.deepEqual(buildAnswerSubmission('recording', { text: 'um', hasAudio: true, audioDurationSec: 9 }, MIN), {
    ok: true,
    answer: AUDIO_ANSWER_PLACEHOLDER,
    answerMode: 'AUDIO',
    durationSec: 9,
  });
});

test('recording mode with nothing recorded asks for a recording or a typed answer', () => {
  const result = buildAnswerSubmission('recording', { text: '', hasAudio: false }, MIN);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /type it instead/);
});
