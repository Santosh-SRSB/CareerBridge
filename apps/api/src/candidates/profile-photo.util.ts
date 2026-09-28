import { PDFDocument } from 'pdf-lib';

export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_PHOTO_FOLDER = 'Images';

export type ProfilePhotoType = 'png' | 'jpg';

export const PROFILE_PHOTO_CONTENT_TYPE: Record<ProfilePhotoType, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEGACY_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif'] as const;

function assertCandidateId(candidateId: string) {
  if (!UUID_RE.test(candidateId)) throw new Error('Invalid candidate id for profile photo path');
}

/** Canonical object key, derived only from the authenticated candidate id. */
export function profilePhotoPath(candidateId: string, type: ProfilePhotoType): string {
  assertCandidateId(candidateId);
  return `${PROFILE_PHOTO_FOLDER}/profile-photo-${candidateId.toLowerCase()}.${type}`;
}

export function profilePhotoUrl(bucket: string, candidateId: string, type: ProfilePhotoType): string {
  return `https://storage.googleapis.com/${bucket}/${profilePhotoPath(candidateId, type)}`;
}

/**
 * Keys written by earlier releases, keyed on the first 8 chars of the candidate id.
 * Readable by their owner; never deleted while another candidate still references them.
 */
export function legacyProfilePhotoPaths(candidateId: string): string[] {
  assertCandidateId(candidateId);
  const id8 = candidateId.slice(0, 8).toLowerCase();
  return LEGACY_EXTS.flatMap((ext) => [
    `${PROFILE_PHOTO_FOLDER}/profile-photo-${id8}.${ext}`,
    `${PROFILE_PHOTO_FOLDER}/photo-${id8}.${ext}`,
  ]);
}

export function canonicalProfilePhotoPaths(candidateId: string): string[] {
  return (['png', 'jpg'] as const).map((type) => profilePhotoPath(candidateId, type));
}

/**
 * Resolve a stored photo reference to an object key in the configured bucket, but only when
 * that key is one of this candidate's own profile-photo keys. Exact matching (no decoding,
 * no normalisation) rejects other buckets, other objects, traversal, encodings and query tricks.
 */
export function ownedProfilePhotoPath(
  stored: string | null | undefined,
  candidateId: string,
  bucket: string,
): { path: string; legacy: boolean } | null {
  if (!stored || typeof stored !== 'string' || !bucket || !UUID_RE.test(candidateId)) return null;
  const prefix = `https://storage.googleapis.com/${bucket}/`;
  if (!stored.startsWith(prefix)) return null;
  const path = stored.slice(prefix.length);
  if (canonicalProfilePhotoPaths(candidateId).includes(path)) return { path, legacy: false };
  if (legacyProfilePhotoPaths(candidateId).includes(path)) return { path, legacy: true };
  return null;
}

/** Stored inline photos from earlier releases; only plain JPG/PNG base64 data URLs are honoured. */
export function isSafeInlinePhoto(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=\s]+$/.test(stored);
}

export function contentTypeForPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

/** Magic-byte sniffing; the declared Content-Type is never trusted on its own. */
export function sniffProfilePhotoType(buffer: Buffer): ProfilePhotoType | null {
  if (!buffer || buffer.length < 12) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  return null;
}

export type PhotoValidationResult =
  | { ok: true; type: ProfilePhotoType; contentType: string }
  | { ok: false; reason: 'missing' | 'too_large' | 'unsupported_type' | 'signature_mismatch' | 'malformed' };

/**
 * Accept only JPG/PNG whose bytes match the signature and actually decode (pdf-lib parses the
 * PNG image data and the JPEG frame header), so renamed PDFs/text or truncated files are rejected.
 */
export async function validateProfilePhoto(file: {
  buffer?: Buffer;
  mimetype?: string;
  size?: number;
}): Promise<PhotoValidationResult> {
  const buffer = file.buffer;
  if (!buffer?.length) return { ok: false, reason: 'missing' };
  if (buffer.length > PROFILE_PHOTO_MAX_BYTES || (file.size ?? 0) > PROFILE_PHOTO_MAX_BYTES) {
    return { ok: false, reason: 'too_large' };
  }
  const declared = (file.mimetype || '').toLowerCase().split(';')[0].trim();
  if (!['image/jpeg', 'image/jpg', 'image/png'].includes(declared)) return { ok: false, reason: 'unsupported_type' };
  const type = sniffProfilePhotoType(buffer);
  if (!type) return { ok: false, reason: 'signature_mismatch' };
  try {
    const doc = await PDFDocument.create();
    // Fresh copy: pdf-lib's JPEG parser ignores byteOffset, so pooled Node Buffers misparse.
    const bytes = new Uint8Array(buffer);
    const image = type === 'png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    if (!(image.width > 0 && image.height > 0)) return { ok: false, reason: 'malformed' };
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  return { ok: true, type, contentType: PROFILE_PHOTO_CONTENT_TYPE[type] };
}

export interface PhotoObjectReader {
  isConfigured(): boolean;
  getBucketName(): string;
  downloadFile(path: string): Promise<Buffer>;
}

/** Bytes of the candidate's own stored photo as a data URL; null for anything not owned or unreadable. */
export async function readOwnedProfilePhotoDataUrl(
  storage: PhotoObjectReader,
  candidateId: string,
  stored: string | null | undefined,
): Promise<string | null> {
  if (!stored) return null;
  if (isSafeInlinePhoto(stored)) return stored;
  if (!storage.isConfigured()) return null;
  const owned = ownedProfilePhotoPath(stored, candidateId, storage.getBucketName());
  if (!owned) return null;
  try {
    const buffer = await storage.downloadFile(owned.path);
    return `data:${contentTypeForPath(owned.path)};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

export const PHOTO_VALIDATION_MESSAGES: Record<Exclude<PhotoValidationResult, { ok: true }>['reason'], string> = {
  missing: 'Please choose a JPG or PNG photo.',
  too_large: 'Photo must be under 5 MB.',
  unsupported_type: 'Please upload a JPG or PNG photo.',
  signature_mismatch: 'The file is not a valid JPG or PNG image.',
  malformed: 'The image file is damaged or could not be read.',
};
