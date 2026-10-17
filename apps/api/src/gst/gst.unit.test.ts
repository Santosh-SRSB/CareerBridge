/**
 * Unit tests for GST helpers (no live IRIS calls).
 * Run: npm.cmd run test:gst -w api
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeGstin, validateGstinFormat, maskGstin } from './gst.validator';
import { normalizeGstStatus, verifiedFromStatus } from './gst.status';
import { pickTradeName } from './gst.payload';

describe('GSTIN normalization', () => {
  it('trims and uppercases', () => {
    assert.equal(normalizeGstin('  29abcde1234f1z5  '), '29ABCDE1234F1Z5');
  });

  it('strips internal spaces', () => {
    assert.equal(normalizeGstin('29 ABCDE 1234 F1Z5'), '29ABCDE1234F1Z5');
  });
});

describe('GSTIN validation', () => {
  it('rejects empty', () => {
    assert.equal(validateGstinFormat(''), 'Enter a GSTIN.');
  });

  it('rejects wrong length', () => {
    assert.match(validateGstinFormat('29ABCDE1234F1Z') || '', /15/);
  });

  it('rejects invalid characters', () => {
    assert.ok(validateGstinFormat('29ABCDE1234F1Z!'));
  });

  it('accepts valid GSTIN format', () => {
    assert.equal(validateGstinFormat('29ABCDE1234F1ZW'), null);
  });

  it('rejects checksum mismatch', () => {
    assert.match(validateGstinFormat('29ABCDE1234F1Z5') || '', /not valid/i);
  });
});

describe('GSTIN masking', () => {
  it('masks middle characters', () => {
    assert.equal(maskGstin('29ABCDE1234F1Z5'), '29ABCDE******Z5');
  });
});

describe('status normalization', () => {
  it('maps Active variants to ACTIVE', () => {
    assert.equal(normalizeGstStatus('Active'), 'ACTIVE');
    assert.equal(normalizeGstStatus('ACTIVE'), 'ACTIVE');
    assert.equal(normalizeGstStatus('act'), 'ACTIVE');
    assert.equal(normalizeGstStatus('A'), 'ACTIVE');
  });

  it('maps inactive / cancelled / suspended to NOT_ACTIVE', () => {
    assert.equal(normalizeGstStatus('Inactive'), 'NOT_ACTIVE');
    assert.equal(normalizeGstStatus('Cancelled'), 'NOT_ACTIVE');
    assert.equal(normalizeGstStatus('Suspended'), 'NOT_ACTIVE');
    assert.equal(normalizeGstStatus('CNL'), 'NOT_ACTIVE');
  });

  it('maps unknown values to UNKNOWN', () => {
    assert.equal(normalizeGstStatus(''), 'UNKNOWN');
    assert.equal(normalizeGstStatus(null), 'UNKNOWN');
    assert.equal(normalizeGstStatus('SOMETHING_ELSE'), 'UNKNOWN');
  });

  it('verified only for ACTIVE', () => {
    assert.equal(verifiedFromStatus('ACTIVE'), true);
    assert.equal(verifiedFromStatus('NOT_ACTIVE'), false);
    assert.equal(verifiedFromStatus('UNKNOWN'), false);
  });
});

describe('trade name extraction', () => {
  it('uses trade_name, not legal name', () => {
    assert.equal(
      pickTradeName({ trade_name: 'BRAND MARK', legal_name: 'LEGAL COMPANY PRIVATE LIMITED' }),
      'BRAND MARK',
    );
  });

  it('does not fall back to legal name', () => {
    assert.equal(pickTradeName({ legal_name: 'LEGAL COMPANY PRIVATE LIMITED' }), null);
  });
});
