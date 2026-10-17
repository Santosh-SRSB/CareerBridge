import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cinFormatError,
  gstinFormatError,
  maskCinForDisplay,
  maskGstinForDisplay,
  maskPanForDisplay,
  normalizeBusinessIdentifier,
  panFormatError,
} from './business-identifiers';
import { panNumberError } from './validation';

// Synthetic identifiers with valid structure; not tied to any real employer.
const GSTIN = '27AAPFU0939F1ZV';
const PAN = 'AAPFU0939F';
const CIN = 'U72900MH2015PTC123456';

test('normalisation trims, removes inner whitespace and upper-cases', () => {
  assert.equal(normalizeBusinessIdentifier('  27aapfu0939f 1zv '), GSTIN);
  assert.equal(normalizeBusinessIdentifier(null), '');
});

test('GSTIN: valid structure and checksum accepted, others rejected', () => {
  assert.equal(gstinFormatError(GSTIN), null);
  assert.equal(gstinFormatError(''), 'Enter a GSTIN.');
  assert.match(gstinFormatError('27AAPFU0939F1Z') || '', /exactly 15/);
  assert.match(gstinFormatError('27AAPFU0939F1XV') || '', /valid 15-character/);
  assert.match(gstinFormatError('27AAPFU0939F1ZX') || '', /not valid/);
});

test('PAN: the example in the error message satisfies the rule it describes', () => {
  assert.equal(panFormatError(PAN), null);
  assert.equal(panFormatError('ABCPE1234F'), null);
  assert.match(panFormatError('ABCPE1234-') || '', /for example ABCPE1234F/);
});

test('PAN: 5 letters, 4 digits, 1 letter', () => {
  assert.equal(panFormatError(''), 'Enter the PAN.');
  assert.match(panFormatError('ABCPE1234') || '', /exactly 10/);
  assert.match(panFormatError('ABCPE12345F') || '', /exactly 10/);
  for (const bad of ['ABCPE12345', '1BCPE1234F', 'ABCP11234F', 'ABCPEA234F', 'ABCPE123AF', 'ABCPE1234-']) {
    assert.match(panFormatError(bad) || '', /valid PAN/, bad);
  }
});

test('PAN: any letter is accepted in position 4, matching the legacy panNumberError', () => {
  for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    const pan = `ABC${letter}E1234F`;
    assert.equal(panFormatError(pan), null, pan);
    assert.equal(panNumberError(pan), null, pan);
  }
  for (const bad of ['ABC1E1234F', 'ABCPE1234', 'ABCPE12345']) {
    assert.ok(panFormatError(bad), bad);
    assert.ok(panNumberError(bad), bad);
  }
});

test('CIN: optional, but a value must be a 21-character CIN', () => {
  assert.equal(cinFormatError(''), null);
  assert.equal(cinFormatError(CIN), null);
  assert.equal(cinFormatError('L65999KA2010PLC054321'), null);
  assert.match(cinFormatError('U72900MH2015PTC12345') || '', /exactly 21/);
  assert.match(cinFormatError('X72900MH2015PTC123456') || '', /valid 21-character/);
});

test('display masks keep length and hide the middle', () => {
  assert.equal(maskGstinForDisplay(GSTIN), '27AAPFU*****1ZV');
  assert.equal(maskPanForDisplay(PAN), 'AAPFU****F');
  assert.equal(maskCinForDisplay(CIN), 'U72900************456');
  assert.equal(maskPanForDisplay('ABC'), '***');
  for (const [masked, full] of [
    [maskGstinForDisplay(GSTIN), GSTIN],
    [maskPanForDisplay(PAN), PAN],
    [maskCinForDisplay(CIN), CIN],
  ]) {
    assert.equal(masked.length, full.length);
    assert.notEqual(masked, full);
  }
});
