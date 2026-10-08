import { OTP_EXPIRED_MESSAGE } from '@careerbridge/shared';

export const INVALID_OTP_MESSAGE = 'Invalid or expired OTP. Please enter the latest OTP or request a new one.';
export const RESET_OTP_EXPIRED_MESSAGE = 'This OTP has expired. Select "Send a new code" to get a new one.';

const FIREBASE_CODES: Record<string, string> = {
  'auth/captcha-check-failed':
    'Verification could not be completed. Please try again.',
  'auth/invalid-verification-code': 'The OTP is incorrect.',
  'auth/code-expired': OTP_EXPIRED_MESSAGE,
  'auth/too-many-requests': 'Too many attempts. Please wait and try again later.',
  'auth/quota-exceeded': 'Too many OTP requests for this number. Please wait a while and try again.',
  'auth/error-code:-39': 'Too many OTP requests for this number. Please wait a while and try again.',
  'auth/invalid-verification-id': 'Please request a new OTP.',
  'auth/session-expired': OTP_EXPIRED_MESSAGE,
  'auth/missing-verification-code': 'Enter the 6-digit OTP.',
  'auth/invalid-phone-number': 'Please enter a valid mobile number.',
  'auth/operation-not-allowed':
    'Mobile verification is temporarily unavailable. Please try again later.',
  'auth/billing-not-enabled':
    'Mobile verification is temporarily unavailable. Please try again later.',
  FIREBASE_NOT_CONFIGURED: 'Mobile verification is temporarily unavailable. Please try again later.',
  OTP_EXPIRED: OTP_EXPIRED_MESSAGE,
  INVALID_OTP: INVALID_OTP_MESSAGE,
};

type AuthStage = 'request' | 'verify' | 'reset';

const FALLBACK: Record<AuthStage, string> = {
  request: "We couldn't send the OTP right now. Please try again.",
  verify: "We couldn't verify your number right now. Please try again.",
  reset: "We couldn't reset your password right now. Please try again.",
};

const CHECK_DETAILS = 'Please check the details you entered and try again.';

/**
 * class-validator's default messages ("property x should not exist", "otp must be a string") start with the
 * raw property name; the DTO messages written for users start with a capital letter.
 */
export function isRawValidationMessage(message: string) {
  return (
    /^property \S+ should not exist/i.test(message) ||
    /^(an instance of|each value in|nested property)\b/i.test(message) ||
    /^[a-z][A-Za-z0-9_.]*\s(must|should|has to)\b/.test(message)
  );
}

/** A browser runtime fault such as "Cannot read properties of undefined" is a client bug, never a user message. */
function isRuntimeFault(err: unknown): boolean {
  return (
    err instanceof TypeError ||
    err instanceof ReferenceError ||
    err instanceof RangeError ||
    err instanceof SyntaxError
  );
}

export function authErrorMessage(err: unknown, stage: AuthStage) {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';

  // The reset form has no "Resend OTP" button; it offers "Send a new code" instead.
  if (stage === 'reset' && code === 'OTP_EXPIRED') return RESET_OTP_EXPIRED_MESSAGE;
  if (code && FIREBASE_CODES[code]) return FIREBASE_CODES[code];
  if (code === 'TOO_MANY_ATTEMPTS') {
    return stage === 'request'
      ? "You've reached the maximum number of attempts. Please try again later."
      : "You've reached the maximum number of attempts. Please request a new OTP.";
  }

  const message = err instanceof Error && !isRuntimeFault(err) ? err.message : '';
  if (message && isRawValidationMessage(message)) return CHECK_DETAILS;
  // Prefer the API/Firebase message when present (avoid masking real server errors).
  if (message) return message;

  if (code === 'ACCOUNT_EXISTS' || code === 'DUPLICATE_RESOURCE') {
    return 'This account is already registered. Please login.';
  }
  if (stage === 'request' && code === 'ACCOUNT_NOT_FOUND') {
    return 'No account found. Create your free Career Passport.';
  }
  return FALLBACK[stage];
}
