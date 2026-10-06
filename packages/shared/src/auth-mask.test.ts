import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskMobileNumber } from './auth';

test('Indian mobile numbers are masked except the last 4 digits', () => {
  assert.equal(maskMobileNumber('+919000012345'), '+91 XXXXX X2345');
  assert.equal(maskMobileNumber('9000012345'), 'XXXXX X2345');
});

test('the full number never appears in the masked output', () => {
  const masked = maskMobileNumber('+919876543210');
  assert.ok(!masked.includes('98765'));
  assert.ok(!masked.replace(/\D/g, '').includes('9876543210'));
});

test('empty input stays empty', () => {
  assert.equal(maskMobileNumber(''), '');
  assert.equal(maskMobileNumber(null), '');
});
