import { PDFDocument } from 'pdf-lib';

export const COMPANY_LOGO_MAX_BYTES = 5 * 1024 * 1024;
export const COMPANY_LOGO_FOLDER = 'Images';

export type CompanyLogoType = 'png' | 'jpg' | 'webp';

export const COMPANY_LOGO_CONTENT_TYPE: Record<CompanyLogoType, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

const DECLARED_TYPES: Record<string, CompanyLogoType> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
};

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOGO_TYPES: CompanyLogoType[] = ['png', 'jpg', 'webp'];

/** Magic-byte sniffing; the declared Content-Type is never trusted on its own. */
export function sniffCompanyLogoType(buffer: Buffer): CompanyLogoType | null {
  if (!buffer || buffer.length < 12) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

export type LogoValidationResult =
  | { ok: true; type: CompanyLogoType; contentType: string }
  | { ok: false; reason: 'missing' | 'too_large' | 'unsupported_type' | 'signature_mismatch' | 'malformed' };

/** Declared type must be PNG/JPEG/WebP, match the file signature, and the image must actually parse. */
export async function validateCompanyLogo(file: {
  buffer?: Buffer;
  mimetype?: string;
  size?: number;
}): Promise<LogoValidationResult> {
  const buffer = file.buffer;
  if (!buffer?.length) return { ok: false, reason: 'missing' };
  if (buffer.length > COMPANY_LOGO_MAX_BYTES || (file.size ?? 0) > COMPANY_LOGO_MAX_BYTES) {
    return { ok: false, reason: 'too_large' };
  }
  const declared = DECLARED_TYPES[(file.mimetype || '').toLowerCase().split(';')[0].trim()];
  if (!declared) return { ok: false, reason: 'unsupported_type' };
  const type = sniffCompanyLogoType(buffer);
  if (!type || type !== declared) return { ok: false, reason: 'signature_mismatch' };
  if (type === 'webp') {
    // RIFF chunk size must describe this file (catches truncated or padded payloads).
    if (buffer.readUInt32LE(4) + 8 !== buffer.length) return { ok: false, reason: 'malformed' };
  } else {
    try {
      const doc = await PDFDocument.create();
      // Fresh copy: pdf-lib's JPEG parser ignores byteOffset, so pooled Node Buffers misparse.
      const bytes = new Uint8Array(buffer);
      const image = type === 'png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      if (!(image.width > 0 && image.height > 0)) return { ok: false, reason: 'malformed' };
    } catch {
      return { ok: false, reason: 'malformed' };
    }
  }
  return { ok: true, type, contentType: COMPANY_LOGO_CONTENT_TYPE[type] };
}

export const LOGO_VALIDATION_MESSAGES: Record<Exclude<LogoValidationResult, { ok: true }>['reason'], string> = {
  missing: 'Please choose a JPG, PNG, or WebP logo.',
  too_large: 'Logo must be under 5 MB.',
  unsupported_type: 'Please upload a JPG, PNG, or WebP logo.',
  signature_mismatch: 'The file is not a valid JPG, PNG, or WebP image.',
  malformed: 'The image file is damaged or could not be read.',
};

function assertEmployerId(employerId: string) {
  if (!ID_RE.test(employerId)) throw new Error('Invalid employer id for company logo path');
}

/** Canonical private object key, derived only from the authenticated employer id. */
export function companyLogoPath(employerId: string, type: CompanyLogoType): string {
  assertEmployerId(employerId);
  return `${COMPANY_LOGO_FOLDER}/company-logo-${employerId.toLowerCase()}.${type}`;
}

export function companyLogoUrl(bucket: string, employerId: string, type: CompanyLogoType): string {
  return `https://storage.googleapis.com/${bucket}/${companyLogoPath(employerId, type)}`;
}

export function canonicalCompanyLogoPaths(employerId: string): string[] {
  return LOGO_TYPES.map((type) => companyLogoPath(employerId, type));
}

/** Keys written by earlier releases: `Images/logo-<epoch ms>-<first 8 chars of employer id>.<ext>`. */
function isLegacyCompanyLogoPath(path: string, employerId: string): boolean {
  const id8 = employerId.slice(0, 8).toLowerCase();
  return new RegExp(`^${COMPANY_LOGO_FOLDER}/logo-\\d{10,16}-${id8}\\.(png|jpg|webp)$`).test(path);
}

/**
 * Resolve a stored logo reference to an object key in the configured bucket, only when that key is
 * this employer's own logo. Anything else (other buckets, other employers, external hosts) yields null.
 */
export function ownedCompanyLogoPath(
  stored: string | null | undefined,
  employerId: string,
  bucket: string,
): string | null {
  if (!stored || typeof stored !== 'string' || !bucket || !ID_RE.test(employerId)) return null;
  const prefix = `https://storage.googleapis.com/${bucket}/`;
  if (!stored.startsWith(prefix)) return null;
  const path = stored.slice(prefix.length);
  if (canonicalCompanyLogoPaths(employerId).includes(path)) return path;
  if (isLegacyCompanyLogoPath(path, employerId)) return path;
  return null;
}

/** Inline logos stored when GCS was unavailable; only plain PNG/JPEG/WebP base64 data URLs are honoured. */
export function isSafeInlineLogo(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/.test(stored);
}

function contentTypeForLogoPath(path: string): string {
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export interface LogoObjectStore {
  isConfigured(): boolean;
  getBucketName(): string;
  downloadFile(path: string): Promise<Buffer>;
  getSignedUrl(path: string, options: { action: 'read'; expiresInMinutes?: number }): Promise<string>;
}

/** Browser-readable URL for the employer's own logo: signed URL, else an inline copy; null if not owned. */
export async function readableCompanyLogoUrl(
  storage: LogoObjectStore,
  employerId: string,
  stored: string | null | undefined,
): Promise<string | null> {
  if (!stored) return null;
  if (isSafeInlineLogo(stored)) return stored;
  if (!storage.isConfigured()) return null;
  const path = ownedCompanyLogoPath(stored, employerId, storage.getBucketName());
  if (!path) return null;
  try {
    return await storage.getSignedUrl(path, { action: 'read', expiresInMinutes: 60 });
  } catch {
    // Cloud Run ADC has no signing key; fall back to an inline copy of the owned object.
  }
  try {
    const buffer = await storage.downloadFile(path);
    return `data:${contentTypeForLogoPath(path)};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}
