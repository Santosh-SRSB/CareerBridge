import assert from 'node:assert/strict';
import { test } from 'node:test';
import { kycCinPayload } from './kyc-identifiers';

test('a blank CIN field omits cin so the saved CIN is kept', () => {
  assert.deepEqual(kycCinPayload('', false), {});
  assert.deepEqual(kycCinPayload('   ', false), {});
});

test('removal is sent only when explicitly requested', () => {
  assert.deepEqual(kycCinPayload('', true), { cin: '' });
});

test('a typed CIN is normalised and replaces the saved one, even if removal was ticked', () => {
  assert.deepEqual(kycCinPayload(' u72900mh2015ptc123456 ', false), { cin: 'U72900MH2015PTC123456' });
  assert.deepEqual(kycCinPayload('U72900MH2015PTC123456', true), { cin: 'U72900MH2015PTC123456' });
});
