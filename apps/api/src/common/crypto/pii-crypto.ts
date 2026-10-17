import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'crypto';

/**
 * Field-level encryption for sensitive identifiers (AES-256-GCM, 96-bit random IV, 128-bit tag).
 *
 * Stored form: `pii:v1:<keyId>:<iv>:<tag>:<ciphertext>` (base64url parts). `v1` is the format version,
 * `keyId` names the key in PII_ENCRYPTION_KEYS so older keys stay readable after a rotation.
 * The column name and key id are bound as additional authenticated data, so a ciphertext copied
 * to another column or relabelled with another key id fails authentication.
 *
 * Exact-match lookups use an HMAC-SHA256 blind index under a separate key (PII_LOOKUP_KEY).
 */

export const PII_CIPHERTEXT_PREFIX = 'pii:v1:';

export type PiiField =
  | 'employers.gst_number'
  | 'employers.pan_number'
  | 'employers.cin'
  | 'companies.gstin'
  | 'gst_verification_audits.gstin';

export type PiiLookupKind = 'gstin';

export type PiiKeyring = {
  activeKeyId: string;
  keys: ReadonlyMap<string, Buffer>;
  lookupKey: Buffer;
};

/** Messages name environment variables only, never key material. */
export class PiiConfigError extends Error {}
/** Messages never include the stored value or the plaintext. */
export class PiiDecryptError extends Error {}

const KEY_ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

function decodeKey(raw: string, name: string): Buffer {
  const key = Buffer.from(raw.trim(), 'base64');
  if (key.length !== KEY_BYTES) {
    throw new PiiConfigError(`${name} must be a base64-encoded ${KEY_BYTES}-byte key.`);
  }
  return key;
}

/**
 * PII_ENCRYPTION_KEYS: comma-separated `keyId:base64Key` entries (every key that may still be needed to decrypt).
 * PII_ENCRYPTION_ACTIVE_KEY_ID: key id used for new writes (optional when there is exactly one key).
 * PII_LOOKUP_KEY: base64 32-byte HMAC key for blind indexes; it does not rotate with the encryption keys.
 * Returns null when nothing is configured; throws PiiConfigError when the configuration is partial or malformed.
 */
export function loadPiiKeyring(env: Record<string, string | undefined>): PiiKeyring | null {
  const rawKeys = (env.PII_ENCRYPTION_KEYS || '').trim();
  const rawLookup = (env.PII_LOOKUP_KEY || '').trim();
  if (!rawKeys && !rawLookup) return null;
  if (!rawKeys) throw new PiiConfigError('PII_ENCRYPTION_KEYS is not set.');
  if (!rawLookup) throw new PiiConfigError('PII_LOOKUP_KEY is not set.');

  const keys = new Map<string, Buffer>();
  for (const entry of rawKeys.split(',').map((item) => item.trim()).filter(Boolean)) {
    const separator = entry.indexOf(':');
    const keyId = separator > 0 ? entry.slice(0, separator).trim() : '';
    if (!KEY_ID_RE.test(keyId)) {
      throw new PiiConfigError('PII_ENCRYPTION_KEYS entries must look like keyId:base64Key (keyId: letters, digits, _ or -).');
    }
    if (keys.has(keyId)) throw new PiiConfigError(`PII_ENCRYPTION_KEYS lists key id "${keyId}" more than once.`);
    keys.set(keyId, decodeKey(entry.slice(separator + 1), `PII_ENCRYPTION_KEYS[${keyId}]`));
  }
  if (!keys.size) throw new PiiConfigError('PII_ENCRYPTION_KEYS has no keys.');

  const requestedActive = (env.PII_ENCRYPTION_ACTIVE_KEY_ID || '').trim();
  const activeKeyId = requestedActive || (keys.size === 1 ? [...keys.keys()][0] : '');
  if (!activeKeyId) {
    throw new PiiConfigError('PII_ENCRYPTION_ACTIVE_KEY_ID is required when PII_ENCRYPTION_KEYS has more than one key.');
  }
  if (!keys.has(activeKeyId)) {
    throw new PiiConfigError('PII_ENCRYPTION_ACTIVE_KEY_ID does not match a key id in PII_ENCRYPTION_KEYS.');
  }

  const lookupKey = decodeKey(rawLookup, 'PII_LOOKUP_KEY');
  if ([...keys.values()].some((key) => key.equals(lookupKey))) {
    throw new PiiConfigError('PII_LOOKUP_KEY must be different from every encryption key.');
  }
  return { activeKeyId, keys, lookupKey };
}

export function isPiiCiphertext(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(PII_CIPHERTEXT_PREFIX);
}

function aad(field: PiiField, keyId: string) {
  return Buffer.from(`careerbridge/pii/v1/${field}/${keyId}`, 'utf8');
}

export function encryptPii(ring: PiiKeyring, field: PiiField, plaintext: string): string {
  const key = ring.keys.get(ring.activeKeyId);
  if (!key) throw new PiiConfigError('Active PII encryption key is missing.');
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(aad(field, ring.activeKeyId));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    `${PII_CIPHERTEXT_PREFIX}${ring.activeKeyId}`,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
}

/** Key id a stored ciphertext was written with, or null for legacy plaintext / malformed values. */
export function piiCiphertextKeyId(stored: string): string | null {
  if (!isPiiCiphertext(stored)) return null;
  const keyId = stored.slice(PII_CIPHERTEXT_PREFIX.length).split(':')[0] || '';
  return KEY_ID_RE.test(keyId) ? keyId : null;
}

export function decryptPii(ring: PiiKeyring, field: PiiField, stored: string): string {
  if (!isPiiCiphertext(stored)) throw new PiiDecryptError('Value is not PII ciphertext.');
  const parts = stored.slice(PII_CIPHERTEXT_PREFIX.length).split(':');
  if (parts.length !== 4) throw new PiiDecryptError('Malformed PII ciphertext.');
  const [keyId, ivPart, tagPart, dataPart] = parts;
  const key = ring.keys.get(keyId);
  if (!key) throw new PiiDecryptError(`No PII key is configured for key id "${keyId}".`);
  const iv = Buffer.from(ivPart, 'base64url');
  const tag = Buffer.from(tagPart, 'base64url');
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new PiiDecryptError('Malformed PII ciphertext.');
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(aad(field, keyId));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    throw new PiiDecryptError('PII ciphertext failed authentication.');
  }
}

/**
 * Identifies a keyring configuration without revealing it, so an operator can confirm two processes (the running
 * API and the backfill) hold the same keys. Built from per-key HMAC check values, never from the keys directly;
 * changes when any key, key id, the active key id or the lookup key changes.
 */
export function piiKeyringFingerprint(ring: PiiKeyring): string {
  const check = (key: Buffer) => createHmac('sha256', key).update('careerbridge/pii-key-check/v1', 'utf8').digest('hex');
  const digest = createHash('sha256').update('careerbridge/pii-keyring-fingerprint/v1\n', 'utf8');
  digest.update(`active=${ring.activeKeyId}\n`, 'utf8');
  for (const keyId of [...ring.keys.keys()].sort((a, b) => a.localeCompare(b, 'en'))) {
    digest.update(`key=${keyId}:${check(ring.keys.get(keyId) as Buffer)}\n`, 'utf8');
  }
  digest.update(`lookup=${check(ring.lookupKey)}\n`, 'utf8');
  return `kfp1-${digest.digest('hex').slice(0, 32)}`;
}

/** Deterministic blind index for exact-match lookups. Pass a normalised value. */
export function piiLookupHash(ring: PiiKeyring, kind: PiiLookupKind, normalized: string): string {
  return createHmac('sha256', ring.lookupKey).update(`careerbridge/pii-lookup/v1/${kind}/${normalized}`, 'utf8').digest('hex');
}
