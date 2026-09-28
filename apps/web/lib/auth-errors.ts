const FIREBASE_CODES: Record<string, string> = {
  'auth/invalid-verification-code': 'The OTP is incorrect.',
  'auth/code-expired': 'This OTP has expired. Please request a new one.',
  'auth/invalid-verification-id': 'Please request a new OTP.',
  'auth/too-many-requests': 'Too many attempts. Please wait and try again later.',
  'auth/quota-exceeded':
    'Too many OTP requests for this number. Wait a while, or use a Firebase test phone number.',
  'auth/captcha-check-failed':
    'Verification could not be completed. Please try again.',
  'auth/invalid-phone-number': 'Enter a valid mobile number.',
  'auth/operation-not-allowed': 'Phone OTP is not enabled in Firebase yet.',
  'auth/billing-not-enabled':
    'Firebase Phone OTP needs billing enabled for real SMS. Use a test phone number for local setup.',
  FIREBASE_NOT_CONFIGURED: 'Firebase OTP is not configured yet. Add NEXT_PUBLIC_FIREBASE_* in apps/web/.env.local.',
  OTP_EXPIRED: 'This OTP has expired. Please request a new one.',
  INVALID_OTP: 'The OTP is incorrect.',
  ACCOUNT_EXISTS: 'An account already exists with this phone/email. Please sign in.',
  DUPLICATE_RESOURCE: 'An account already exists with this phone/email. Please sign in.',
};

export function authErrorMessage(err: unknown, stage: 'request' | 'verify') {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';

  if (code && FIREBASE_CODES[code]) {
    return FIREBASE_CODES[code];
  }

  if (stage === 'verify') {
    if (code === 'TOO_MANY_ATTEMPTS') {
      return "You've reached the maximum number of attempts. Please request a new OTP.";
    }
    if (code === 'ACCOUNT_EXISTS' || code === 'DUPLICATE_RESOURCE') {
      if (err instanceof Error && err.message) return err.message;
      return 'An account already exists with this phone/email. Please sign in.';
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
    return 'An account already exists with this phone/email. Please sign in.';
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return "We couldn't send the OTP right now. Please try again.";
}
