/**
 * Field-level encryption core: key ring parsing, round trips, key rotation, tamper detection, blind index.
 * Run: npm run test:pii -w api
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PiiConfigError,
  PiiDecryptError,
  decryptPii,
  encryptPii,
  isPiiCiphertext,
  loadPiiKeyring,
  piiCiphertextKeyId,
  piiKeyringFingerprint,
  piiLookupHash,
} from './pii-crypto';

/** Test-only key material. */
const key = (fill: number) => Buffer.alloc(32, fill).toString('base64');
const ENV = { PII_ENCRYPTION_KEYS: `k1:${key(1)}`, PII_LOOKUP_KEY: key(9) };
const GSTIN = '27AAPFU0939F1ZV';

describe('loadPiiKeyring', () => {
  it('returns null when nothing is configured', () => {
    assert.equal(loadPiiKeyring({}), null);
  });

  it('a single key is active by default', () => {
    const ring = loadPiiKeyring(ENV)!;
    assert.equal(ring.activeKeyId, 'k1');
    assert.equal(ring.keys.size, 1);
  });

  it('rejects partial or malformed configuration without echoing key material', () => {
    const cases: Array<Record<string, string>> = [
      { PII_ENCRYPTION_KEYS: `k1:${key(1)}` },
      { PII_LOOKUP_KEY: key(9) },
      { ...ENV, PII_ENCRYPTION_KEYS: 'k1:c2hvcnQ=' },
      { ...ENV, PII_ENCRYPTION_KEYS: `bad id:${key(1)}` },
      { ...ENV, PII_ENCRYPTION_KEYS: `k1:${key(1)},k1:${key(2)}` },
      { ...ENV, PII_ENCRYPTION_KEYS: `k1:${key(1)},k2:${key(2)}` },
      { ...ENV, PII_ENCRYPTION_ACTIVE_KEY_ID: 'k9' },
      { ...ENV, PII_LOOKUP_KEY: key(1) },
    ];
    for (const env of cases) {
      assert.throws(() => loadPiiKeyring(env), (err: unknown) => {
        assert.ok(err instanceof PiiConfigError);
        assert.ok(!err.message.includes(key(1)) && !err.message.includes(key(2)));
        return true;
      });
    }
  });
});

describe('encryptPii / decryptPii', () => {
  const ring = loadPiiKeyring(ENV)!;

  it('round-trips, uses a fresh IV per write and never contains the plaintext', () => {
    const a = encryptPii(ring, 'employers.gst_number', GSTIN);
    const b = encryptPii(ring, 'employers.gst_number', GSTIN);
    assert.notEqual(a, b);
    assert.ok(isPiiCiphertext(a));
    assert.ok(!a.includes(GSTIN));
    assert.equal(piiCiphertextKeyId(a), 'k1');
    assert.equal(decryptPii(ring, 'employers.gst_number', a), GSTIN);
  });

  it('detects tampering with the ciphertext, tag, IV or key id', () => {
    const stored = encryptPii(ring, 'employers.pan_number', 'AAPFU0939F');
    const parts = stored.split(':');
    const flip = (value: string) => `${value[0] === 'A' ? 'B' : 'A'}${value.slice(1)}`;
    for (const index of [3, 4, 5]) {
      const copy = [...parts];
      copy[index] = flip(copy[index]);
      assert.throws(() => decryptPii(ring, 'employers.pan_number', copy.join(':')), PiiDecryptError);
    }
    const twoKeys = loadPiiKeyring({ ...ENV, PII_ENCRYPTION_KEYS: `k1:${key(1)},k2:${key(1)}`, PII_ENCRYPTION_ACTIVE_KEY_ID: 'k1' })!;
    const relabelled = [...parts];
    relabelled[2] = 'k2';
    assert.throws(() => decryptPii(twoKeys, 'employers.pan_number', relabelled.join(':')), PiiDecryptError);
  });

  it('binds the ciphertext to its column', () => {
    const stored = encryptPii(ring, 'employers.gst_number', GSTIN);
    assert.throws(() => decryptPii(ring, 'companies.gstin', stored), PiiDecryptError);
  });

  it('rotation: new writes use the active key, older ciphertext stays readable while its key is listed', () => {
    const old = encryptPii(ring, 'employers.cin', 'U72900MH2015PTC123456');
    const rotated = loadPiiKeyring({ ...ENV, PII_ENCRYPTION_KEYS: `k1:${key(1)},k2:${key(2)}`, PII_ENCRYPTION_ACTIVE_KEY_ID: 'k2' })!;
    const fresh = encryptPii(rotated, 'employers.cin', 'U72900MH2015PTC123456');
    assert.equal(piiCiphertextKeyId(fresh), 'k2');
    assert.equal(decryptPii(rotated, 'employers.cin', old), 'U72900MH2015PTC123456');
    const retired = loadPiiKeyring({ ...ENV, PII_ENCRYPTION_KEYS: `k2:${key(2)}` })!;
    assert.throws(() => decryptPii(retired, 'employers.cin', old), (err: unknown) => {
      assert.ok(err instanceof PiiDecryptError);
      assert.ok(!err.message.includes('U72900'));
      return true;
    });
  });

  it('rejects values that are not ciphertext', () => {
    assert.throws(() => decryptPii(ring, 'employers.gst_number', GSTIN), PiiDecryptError);
    assert.throws(() => decryptPii(ring, 'employers.gst_number', 'pii:v1:k1:abc'), PiiDecryptError);
  });
});

describe('piiLookupHash', () => {
  it('is deterministic per value, independent of the encryption key, and hides the input', () => {
    const ring = loadPiiKeyring(ENV)!;
    const rotated = loadPiiKeyring({ ...ENV, PII_ENCRYPTION_KEYS: `k2:${key(2)}` })!;
    const hash = piiLookupHash(ring, 'gstin', GSTIN);
    assert.match(hash, /^[0-9a-f]{64}$/);
    assert.equal(piiLookupHash(rotated, 'gstin', GSTIN), hash);
    assert.notEqual(piiLookupHash(ring, 'gstin', '29AAAAA0000A1ZY'), hash);
    assert.notEqual(piiLookupHash(loadPiiKeyring({ ...ENV, PII_LOOKUP_KEY: key(8) })!, 'gstin', GSTIN), hash);
  });
});

describe('piiKeyringFingerprint', () => {
  const TWO = {
    PII_ENCRYPTION_KEYS: `k1:${key(1)},k2:${key(2)}`,
    PII_ENCRYPTION_ACTIVE_KEY_ID: 'k2',
    PII_LOOKUP_KEY: key(9),
  };

  it('is the same for the same configuration, whatever the key order', () => {
    const fp = piiKeyringFingerprint(loadPiiKeyring(TWO)!);
    assert.match(fp, /^kfp1-[0-9a-f]{32}$/);
    assert.equal(piiKeyringFingerprint(loadPiiKeyring({ ...TWO, PII_ENCRYPTION_KEYS: `k2:${key(2)},k1:${key(1)}` })!), fp);
  });

  it('changes when any key, key id, the active key or the lookup key changes', () => {
    const fp = piiKeyringFingerprint(loadPiiKeyring(TWO)!);
    const variants = [
      { ...TWO, PII_ENCRYPTION_KEYS: `k1:${key(1)},k2:${key(3)}` },
      { ...TWO, PII_ENCRYPTION_KEYS: `k1:${key(4)},k2:${key(2)}` },
      { ...TWO, PII_ENCRYPTION_KEYS: `k1:${key(1)},k3:${key(2)}`, PII_ENCRYPTION_ACTIVE_KEY_ID: 'k3' },
      { ...TWO, PII_ENCRYPTION_ACTIVE_KEY_ID: 'k1' },
      { ...TWO, PII_LOOKUP_KEY: key(8) },
      { PII_ENCRYPTION_KEYS: `k2:${key(2)}`, PII_LOOKUP_KEY: key(9) },
    ];
    for (const env of variants) assert.notEqual(piiKeyringFingerprint(loadPiiKeyring(env)!), fp, JSON.stringify(env));
  });

  it('contains no key material in any encoding', () => {
    const ring = loadPiiKeyring(TWO)!;
    const fp = piiKeyringFingerprint(ring);
    for (const raw of [...ring.keys.values(), ring.lookupKey]) {
      for (const encoded of [raw.toString('hex'), raw.toString('base64'), raw.toString('base64url')]) {
        assert.ok(!fp.includes(encoded.slice(0, 16)));
      }
    }
  });
});
