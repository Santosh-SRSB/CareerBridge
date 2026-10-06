import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RESUME_SUMMARY_MAX, fitResumeSummary } from './resume-summary';

test('fitResumeSummary keeps short summaries and normalises whitespace', () => {
  assert.equal(fitResumeSummary('  Customer support   agent.\n\nFluent in Malayalam. '), 'Customer support agent. Fluent in Malayalam.');
  assert.equal(fitResumeSummary(''), null);
  assert.equal(fitResumeSummary(42), null);
});

test('fitResumeSummary trims long text to the last full sentence within the limit', () => {
  const sentence = 'I resolve customer issues quickly and clearly. ';
  const long = sentence.repeat(20);
  const fitted = fitResumeSummary(long);
  assert.ok(fitted);
  assert.ok(fitted.length <= RESUME_SUMMARY_MAX);
  assert.ok(fitted.endsWith('.'));
});

test('fitResumeSummary rejects text that would have to be cut mid-sentence', () => {
  assert.equal(fitResumeSummary('word '.repeat(200)), null);
});
