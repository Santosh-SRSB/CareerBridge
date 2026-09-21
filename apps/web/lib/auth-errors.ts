const FIREBASE_CODES: Record<string, string> = {
  'auth/invalid-verification-code': 'Incorrect OTP. Please check the code and try again.',
  'auth/code-expired': 'This OTP has expired.',
  'auth/invalid-verification-id': 'Please request a new OTP.',
  'auth/too-many-requests': "You've reached the maximum number of attempts. Please try again later.",
  'auth/quota-exceeded': "We couldn't send the OTP right now. Please try again later.",
  'auth/captcha-check-failed': 'Verification check failed. Refresh the page and try again.',
  'auth/invalid-phone-number': 'Enter a valid mobile number.',
  'auth/operation-not-allowed': 'Phone OTP is not enabled in Firebase yet.',
  'auth/billing-not-enabled':
    'Firebase Phone OTP needs billing enabled for real SMS. Use a test phone number for local setup.',
  FIREBASE_NOT_CONFIGURED: 'Firebase OTP is not configured yet. Add NEXT_PUBLIC_FIREBASE_* in apps/web/.env.local.',
  OTP_EXPIRED: 'This OTP has expired.',
  INVALID_OTP: 'Incorrect OTP. Please check the code and try again.',
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
    if (err instanceof Error && err.message) {
      return err.message;
    }
    return "We couldn't verify your number right now. Please try again.";
  }

  if (code === 'ACCOUNT_NOT_FOUND') {
    if (err instanceof Error && err.message) return err.message;
    return 'No account found. Create your free Career Passport.';
  }
  if (code === 'ACCOUNT_EXISTS') {
    if (err instanceof Error && err.message) return err.message;
    return 'An account already exists. Please sign in.';
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
