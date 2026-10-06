import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Pure Meta webhook HMAC check.
 * Whenever an App Secret is configured, x-hub-signature-256 must match it.
 * requireSignature=true without an App Secret rejects everything; only requireSignature=false
 * with no App Secret (local DEV without Meta) accepts unsigned payloads.
 */
export function validateWhatsAppSignature(input: {
  requireSignature: boolean;
  appSecret: string;
  rawBody: Buffer | string | undefined;
  signatureHeader: string | undefined;
}): boolean {
  if (!input.appSecret) return !input.requireSignature;
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
  if (appSecretPresent) return 'required' as const;
  if (!requireSignature) return 'disabled_dev' as const;
  return 'required_missing_secret' as const;
}

function waDigits(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

/** Meta rejects messages addressed to the sending business number with a generic (#100) Invalid parameter. */
export function isOwnBusinessNumber(recipientWaId: string, businessDisplayPhone: string | null | undefined) {
  const business = waDigits(businessDisplayPhone || '');
  const recipient = waDigits(recipientWaId || '');
  return Boolean(business) && Boolean(recipient) && business === recipient;
}
