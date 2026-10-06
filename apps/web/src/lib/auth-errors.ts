import { OTP_EXPIRED_MESSAGE } from '@careerbridge/shared';

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
  INVALID_OTP: 'The OTP is incorrect.',
};

export function authErrorMessage(err: unknown, stage: 'request' | 'verify') {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';

  // Prefer the API/Firebase message when present (avoid masking real server errors).
  if (err instanceof Error && err.message && !FIREBASE_CODES[code]) {
    if (stage === 'verify') {
      if (code === 'TOO_MANY_ATTEMPTS') {
        return "You've reached the maximum number of attempts. Please request a new OTP.";
      }
      if (code === 'ACCOUNT_EXISTS' || code === 'DUPLICATE_RESOURCE') {
        return err.message;
      }
      return err.message;
    }
  }

  if (code && FIREBASE_CODES[code]) {
    return FIREBASE_CODES[code];
  }

  if (stage === 'verify') {
    if (code === 'TOO_MANY_ATTEMPTS') {
      return "You've reached the maximum number of attempts. Please request a new OTP.";
    }
    if (code === 'ACCOUNT_EXISTS' || code === 'DUPLICATE_RESOURCE') {
      if (err instanceof Error && err.message) return err.message;
      return 'This account is already registered. Please login.';
    }
    if (err instanceof Error && err.message) {
      return err.message;
    }
    return "We couldn't verify your number right now. Please try again.";
  }

  if (code === 'ACCOUNT_NOT_FOUND') {
    if (err instanceof Error && err.message) return err.message;
    return 'No account found. Create your free Career Passport.';
  }
  if (code === 'ACCOUNT_EXISTS' || code === 'DUPLICATE_RESOURCE') {
    if (err instanceof Error && err.message) return err.message;
    return 'This account is already registered. Please login.';
  }
  if (code === 'TOO_MANY_ATTEMPTS') {
    return "You've reached the maximum number of attempts. Please try again later.";
  }
  if (code === 'VALIDATION_ERROR' && err instanceof Error) {
    return err.message;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return "We couldn't send the OTP right now. Please try again.";
}
