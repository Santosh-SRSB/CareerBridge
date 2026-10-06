/**
 * DEV-only WhatsApp Business profile settings and guards, used by whatsapp-profile-setup-dev.ts.
 * The only profile this may change is the DEV number below in the DEV WABA.
 */
import { createHash } from 'crypto';

export const DEV_WABA_ID = '946009308557431';
export const DEV_DISPLAY_PHONE = '+91 95137 91117';
export const DEV_META_APP_ID = '1356370663141517';
export const GRAPH_VERSION = 'v25.0';

/** Byte-identical copy of the official SRSB logo provided for the WhatsApp profile photo. */
export const PROFILE_IMAGE_RELATIVE_PATH = 'infrastructure/branding/srsb-logo-whatsapp-profile.png';
export const PROFILE_IMAGE_SHA256 = '4d6f16f21cd2602f6a43a05cd1573043f36a8631a8fa40c7e88b4be527bb6249';

/** Wording already used by the website (apps/web/src/app/layout.tsx metadata). */
export const DESIRED_PROFILE = {
  displayName: 'SRSB CareerBridge',
  website: 'https://www.srsbcareerbridge.com',
  about: 'Build your career. Build your future.',
  description:
    'Create your free Career Passport, improve your skills with AI, practice interviews, and find jobs. Free for candidates.',
} as const;

const digits = (value: string | undefined | null) => String(value ?? '').replace(/\D/g, '');

export type DevTargetCheck = {
  configuredWabaId: string | undefined;
  phoneNumberId: string;
  /** `GET /{DEV_WABA_ID}/phone_numbers` as returned by Meta. */
  wabaPhones: Array<{ id: string; display_phone_number?: string }>;
  /** `GET /{phoneNumberId}?fields=display_phone_number`. */
  phoneDisplayNumber: string | undefined;
};

/** Throws unless Meta confirms the phone number ID is the DEV number inside the DEV WABA. */
export function assertDevTarget(input: DevTargetCheck) {
  if (input.configuredWabaId !== DEV_WABA_ID) {
    throw new Error(`Configured WABA ${input.configuredWabaId ?? '(unset)'} is not the DEV WABA ${DEV_WABA_ID}`);
  }
  if (!/^\d+$/.test(input.phoneNumberId)) throw new Error('Phone number ID is missing or not numeric');
  const listed = input.wabaPhones.find((p) => p.id === input.phoneNumberId);
  if (!listed) throw new Error(`Phone number ID is not listed under DEV WABA ${DEV_WABA_ID}`);
  if (digits(listed.display_phone_number) !== digits(DEV_DISPLAY_PHONE)) {
    throw new Error(`DEV WABA lists ${listed.display_phone_number}, expected ${DEV_DISPLAY_PHONE}`);
  }
  if (digits(input.phoneDisplayNumber) !== digits(DEV_DISPLAY_PHONE)) {
    throw new Error(`Phone number reports ${input.phoneDisplayNumber}, expected ${DEV_DISPLAY_PHONE}`);
  }
  return { wabaId: DEV_WABA_ID, phoneNumberId: input.phoneNumberId, displayPhone: DEV_DISPLAY_PHONE };
}

export type ImageCheck = {
  ok: boolean;
  format: 'image/png' | 'image/jpeg' | null;
  width: number | null;
  height: number | null;
  bytes: number;
  sha256: string;
  problems: string[];
};

function jpegSize(buf: Buffer): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

/** Meta profile photo: PNG or JPEG, at most 5 MB; square and at least 192 px so WhatsApp's circle crop does not distort it. */
export function checkProfileImage(buf: Buffer): ImageCheck {
  const sha256 = createHash('sha256').update(buf).digest('hex');
  const problems: string[] = [];
  let format: ImageCheck['format'] = null;
  let size: { width: number; height: number } | null = null;
  if (buf.length > 24 && buf.subarray(1, 4).toString('latin1') === 'PNG') {
    format = 'image/png';
    size = { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  } else if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    format = 'image/jpeg';
    size = jpegSize(buf);
  }
  if (!format) problems.push('not a PNG or JPEG');
  if (buf.length > 5 * 1024 * 1024) problems.push('larger than 5 MB');
  if (format && !size) problems.push('could not read dimensions');
  if (size && size.width !== size.height) problems.push(`not square (${size.width}x${size.height})`);
  if (size && Math.min(size.width, size.height) < 192) problems.push('smaller than 192 px');
  return {
    ok: problems.length === 0,
    format,
    width: size?.width ?? null,
    height: size?.height ?? null,
    bytes: buf.length,
    sha256,
    problems,
  };
}

export function graphUrl(path: string) {
  return `https://graph.facebook.com/${GRAPH_VERSION}${path}`;
}

/** Resumable Upload API, step 1: open an upload session on the Meta app that owns the token. */
export function uploadSessionPath(appId: string, image: Pick<ImageCheck, 'bytes' | 'format'>) {
  if (appId !== DEV_META_APP_ID) throw new Error(`Unexpected Meta app ${appId}`);
  if (!image.format) throw new Error('Unsupported image format');
  return `/${appId}/uploads?file_length=${image.bytes}&file_type=${encodeURIComponent(image.format)}`;
}

/** `POST /{phoneNumberId}/whatsapp_business_profile` body. The display name is not part of this endpoint. */
export function buildProfileUpdate(profilePictureHandle?: string) {
  return {
    messaging_product: 'whatsapp',
    about: DESIRED_PROFILE.about,
    description: DESIRED_PROFILE.description,
    websites: [DESIRED_PROFILE.website],
    ...(profilePictureHandle ? { profile_picture_handle: profilePictureHandle } : {}),
  };
}

/** Display name changes go through Meta review: `POST /{phoneNumberId}?new_display_name=...`. */
export function displayNameChangePath(phoneNumberId: string) {
  if (!/^\d+$/.test(phoneNumberId)) throw new Error('Phone number ID is missing or not numeric');
  return `/${phoneNumberId}?new_display_name=${encodeURIComponent(DESIRED_PROFILE.displayName)}`;
}

/** Removes every secret value (and anything that looks like a Meta token) before text is printed. */
export function redact(text: string, secrets: Array<string | undefined>) {
  let out = text;
  for (const secret of secrets) {
    if (secret && secret.length >= 6) out = out.split(secret).join('[redacted]');
  }
  return out.replace(/EAA[A-Za-z0-9]{20,}/g, '[redacted]');
}
