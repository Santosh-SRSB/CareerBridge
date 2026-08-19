import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash?: string | null) {
  if (!storedHash || !storedHash.includes(':')) {
    return false;
  }
  const [salt, hash] = storedHash.split(':');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const stored = Buffer.from(hash, 'hex');
  if (stored.length !== derived.length) {
    return false;
  }
  return timingSafeEqual(stored, derived);
}
