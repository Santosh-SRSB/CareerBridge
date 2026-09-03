import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scryptCb);

/** Standard scrypt for candidate/employer passwords. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

function scryptPlatform(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(
      password,
      salt,
      64,
      { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (err, key) => {
        if (err) reject(err);
        else resolve(key as Buffer);
      },
    );
  });
}

/**
 * Higher-cost scrypt for Super Admin / Admin passwords.
 * Format: v2:salt:hexHash
 */
export async function hashPlatformPassword(password: string) {
  const salt = randomBytes(32).toString('hex');
  const derived = await scryptPlatform(password, salt);
  return `v2:${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash?: string | null) {
  if (!storedHash) return false;

  if (storedHash.startsWith('v2:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 3) return false;
    const [, salt, hash] = parts;
    const derived = await scryptPlatform(password, salt);
    const stored = Buffer.from(hash, 'hex');
    if (stored.length !== derived.length) return false;
    return timingSafeEqual(stored, derived);
  }

  if (!storedHash.includes(':')) return false;
  const [salt, hash] = storedHash.split(':');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const stored = Buffer.from(hash, 'hex');
  if (stored.length !== derived.length) return false;
  return timingSafeEqual(stored, derived);
}

function platformKey(secret: string) {
  return createHash('sha256').update(`careerbridge-platform:${secret}`).digest();
}

/** AES-256-GCM encrypt for platform secrets at rest. */
export function encryptPlatformSecret(plain: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', platformKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptPlatformSecret(payload: string, secret: string) {
  if (!payload.startsWith('enc:')) return payload;
  const parts = payload.split(':');
  if (parts.length !== 4) return null;
  const [, ivHex, tagHex, dataHex] = parts;
  try {
    const decipher = createDecipheriv('aes-256-gcm', platformKey(secret), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

/** Blind index so platform emails can be looked up without storing only ciphertext. */
export function platformEmailLookup(email: string, secret: string) {
  return createHash('sha256')
    .update(`platform-email:${secret}:${email.trim().toLowerCase()}`)
    .digest('hex');
}
