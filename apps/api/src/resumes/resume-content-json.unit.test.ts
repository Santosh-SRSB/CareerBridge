import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseResumeContentJson, scrubDangerousKeys } from './resume-content-json';

describe('parseResumeContentJson (SEC-INJ-011)', () => {
  it('drops __proto__ / constructor / prototype keys and does not pollute Object.prototype', () => {
    const marker = `__cb_pollute_${Date.now()}`;
    const raw = JSON.stringify({
      fullName: 'Safe Name',
      __proto__: { [marker]: true },
      constructor: { prototype: { [marker]: true } },
      skills: ['SQL'],
      nested: { __proto__: { [marker]: true }, ok: 1 },
    });
    const parsed = parseResumeContentJson(raw);
    assert.equal(parsed.fullName, 'Safe Name');
    assert.deepEqual(parsed.skills, ['SQL']);
    assert.equal(Object.prototype.hasOwnProperty.call(parsed, '__proto__'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(parsed, 'constructor'), false);
    assert.equal((parsed.nested as { ok: number }).ok, 1);
    assert.equal(Object.prototype.hasOwnProperty.call(parsed.nested as object, '__proto__'), false);
    assert.equal((Object.prototype as Record<string, unknown>)[marker], undefined);
  });

  it('returns {} for invalid JSON', () => {
    assert.deepEqual(parseResumeContentJson('not-json'), {});
    assert.deepEqual(parseResumeContentJson('[]'), {});
  });

  it('scrubDangerousKeys is idempotent on clean objects', () => {
    const clean = { a: 1, b: { c: 2 } };
    assert.deepEqual(scrubDangerousKeys(clean), clean);
  });

  it('resumes.service parseContent path wires parseResumeContentJson (source contract)', () => {
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const { resolve } = require('node:path') as typeof import('node:path');
    const src = readFileSync(resolve(__dirname, 'resumes.service.ts'), 'utf8');
    assert.match(src, /import \{ parseResumeContentJson \} from '\.\/resume-content-json'/);
    assert.match(src, /normalizeStoredContent\(parseResumeContentJson\(raw\)\)/);
  });
});
