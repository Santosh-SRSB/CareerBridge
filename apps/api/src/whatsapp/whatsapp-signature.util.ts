import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Pure Meta webhook HMAC check.
 * When requireSignature is false (DEV), always accept.
 * When true, appSecret is mandatory and x-hub-signature-256 must match.
 */
export function validateWhatsAppSignature(input: {
  requireSignature: boolean;
  appSecret: string;
  rawBody: Buffer | string | undefined;
  signatureHeader: string | undefined;
}): boolean {
  if (!input.requireSignature) return true;
  if (!input.appSecret) return false;
  if (!input.rawBody || !input.signatureHeader?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', input.appSecret).update(input.rawBody).digest('hex');
  const provided = input.signatureHeader.slice('sha256='.length);
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function isWhatsAppSendConfigured(input: {
  accessToken: boolean;
  phoneNumberId: boolean;
  verifyToken: boolean;
}) {
  return Boolean(input.accessToken && input.phoneNumberId && input.verifyToken);
}

export function signatureModeLabel(requireSignature: boolean, appSecretPresent: boolean) {
  if (!requireSignature) return 'disabled_dev' as const;
  if (!appSecretPresent) return 'required_missing_secret' as const;
  return 'required' as const;
}
