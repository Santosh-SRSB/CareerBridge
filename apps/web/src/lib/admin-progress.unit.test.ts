import assert from 'node:assert/strict';
import test from 'node:test';
import { progressBarWidth, progressCaption, progressShareLabel } from './admin-progress';

test('bar width is zero when nothing is registered or the stage is empty', () => {
  assert.equal(progressBarWidth(0, 0), 0);
  assert.equal(progressBarWidth(5, 0), 0);
  assert.equal(progressBarWidth(0, 40), 0);
});

test('bar width is proportional, keeps small stages visible and caps at 100', () => {
  assert.equal(progressBarWidth(20, 40), 50);
  assert.equal(progressBarWidth(40, 40), 100);
  assert.equal(progressBarWidth(1, 1000), 2);
  assert.equal(progressBarWidth(60, 40), 100);
});

test('share label handles an empty population', () => {
  assert.equal(progressShareLabel({ percentOfRegistered: null }, 'candidates'), 'No candidates registered yet');
  assert.equal(progressShareLabel({ percentOfRegistered: 0 }, 'employers'), '0% of registered employers');
  assert.equal(progressShareLabel({ percentOfRegistered: 37.5 }, 'candidates'), '37.5% of registered candidates');
});

test('caption states the registered total and the counting rule', () => {
  assert.equal(
    progressCaption({ registered: 12 }, 'employers'),
    '12 registered employers · each counted once per stage',
  );
  assert.equal(progressCaption({ registered: 0 }, 'candidates'), '0 registered candidates · each counted once per stage');
});
