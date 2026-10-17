/**
 * SEC-LOG-008 — client-error intake must not log pasted Bearer/JWT/API credentials.
 *
 * Fixture secrets are assembled at runtime so secret scanners do not flag the source.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatClientErrorLogLine, sanitizeClientErrorField } from './client-error-sanitize';

const FAKE_JWT = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  'eyJzdWIiOiIxMjM0NTY3ODkwIn0',
  'do-not-use-this-signature-value',
].join('.');

const FAKE_PEM_BODY = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC';

function fakePemBlock(): string {
  const begin = ['-----', 'BEGIN PRIVATE KEY', '-----'].join('');
  const end = ['-----', 'END PRIVATE KEY', '-----'].join('');
  return `${begin}\n${FAKE_PEM_BODY}\n${end}`;
}

describe('sanitizeClientErrorField (SEC-LOG-008)', () => {
  it('redacts Authorization Bearer tokens', () => {
    const raw = `Authorization: Bearer ${FAKE_JWT} pasted by user`;
    const out = sanitizeClientErrorField(raw);
    assert.match(out, /Bearer \[REDACTED\]/);
    assert.equal(out.includes(FAKE_JWT), false);
    assert.equal(out.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'), false);
  });

  it('redacts bare Bearer tokens without Authorization label', () => {
    const raw = `got Bearer ${FAKE_JWT} from clipboard`;
    const out = sanitizeClientErrorField(raw);
    assert.match(out, /Bearer \[REDACTED\]/);
    assert.equal(out.includes(FAKE_JWT), false);
  });

  it('redacts JWT-shaped strings even without Bearer prefix', () => {
    const out = sanitizeClientErrorField(`token=${FAKE_JWT}`);
    assert.equal(out.includes(FAKE_JWT), false);
    assert.match(out, /\[REDACTED\]/);
  });

  it('redacts api_key / access_token assignment forms and AIza/sk- prefixes', () => {
    const googleish = ['AIza', 'SyFakeKeyForUnitTestOnly123'].join('');
    const openaiish = ['sk-', 'live-not-real'].join('');
    const out = sanitizeClientErrorField(
      `api_key=${googleish} refresh_token=abc123${openaiish}`,
    );
    assert.equal(out.includes(googleish), false);
    assert.match(out, /\[REDACTED\]/);
  });

  it('redacts PEM private key blocks', () => {
    const pem = `crash ${fakePemBlock()} trailing`;
    const out = sanitizeClientErrorField(pem);
    assert.equal(out.includes('BEGIN PRIVATE KEY'), false);
    assert.equal(out.includes(FAKE_PEM_BODY), false);
    assert.match(out, /\[REDACTED\]/);
    assert.match(out, /crash/);
    assert.match(out, /trailing/);
  });

  it('keeps ordinary diagnostic messages useful', () => {
    const msg = 'TypeError: Cannot read properties of undefined (reading "id") at HomePage';
    assert.equal(sanitizeClientErrorField(msg), msg);
  });

  it('collapses newlines and truncates long fields', () => {
    const out = sanitizeClientErrorField(`line1\nline2 ${'x'.repeat(600)}`, 80);
    assert.equal(out.includes('\n'), false);
    assert.equal(out.length, 80);
  });
});

describe('formatClientErrorLogLine (SEC-LOG-008)', () => {
  it('redacts credentials across path, digest, and message', () => {
    const line = formatClientErrorLogLine({
      errorId: 'ERR-20261016-ABC12',
      path: `/x?access_token=${FAKE_JWT}`,
      digest: `Bearer ${FAKE_JWT}`,
      message: `Authorization: Bearer ${FAKE_JWT} crash`,
    });
    assert.match(line, /^errorId=ERR-20261016-ABC12 /);
    assert.equal(line.includes(FAKE_JWT), false);
    assert.equal(line.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'), false);
    assert.match(line, /Bearer \[REDACTED\]/);
    assert.match(line, /message=.*crash/);
  });
});
