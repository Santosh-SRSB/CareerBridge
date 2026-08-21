import { initializeApp, getApps } from 'firebase/app';
import {
  ConfirmationResult,
  RecaptchaVerifier,
  getAuth,
  signInWithPhoneNumber,
} from 'firebase/auth';

let recaptcha: RecaptchaVerifier | null = null;
let confirmation: ConfirmationResult | null = null;

const FIREBASE_MESSAGES: Record<string, string> = {
  'auth/invalid-verification-code': 'Incorrect OTP. Please check the code and try again.',
  'auth/code-expired': 'This OTP has expired.',
  'auth/invalid-verification-id': 'Please request a new OTP.',
  'auth/missing-verification-code': 'Enter the 6-digit OTP.',
  'auth/too-many-requests': "You've reached the maximum number of attempts. Please try again later.",
  'auth/quota-exceeded': "We couldn't send the OTP right now. Please try again later.",
  'auth/captcha-check-failed': 'Verification check failed. Refresh the page and try again.',
  'auth/invalid-phone-number': 'Enter a valid mobile number.',
  'auth/missing-phone-number': 'Enter a valid mobile number.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/operation-not-allowed': 'Phone OTP is not enabled in Firebase yet.',
  'auth/billing-not-enabled': 'Firebase Phone OTP needs billing enabled for real SMS. Use a test phone number for local setup.',
};

function getClientAuth() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  if (!config.apiKey || !config.projectId || !config.authDomain || !config.appId) {
    throw Object.assign(new Error('Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* in apps/web/.env.local'), {
      code: 'FIREBASE_NOT_CONFIGURED',
    });
  }
  const app = getApps()[0] || initializeApp(config);
  const auth = getAuth(app);
  auth.useDeviceLanguage();
  return auth;
}

export function isFirebaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  );
}

export function isDevOtpEnabled() {
  return process.env.NEXT_PUBLIC_AUTH_DEV_OTP === 'true';
}

export function usesFirebasePhoneOtp() {
  return !isDevOtpEnabled();
}

function wrapFirebaseError(err: unknown): never {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
  const raw = err instanceof Error ? err.message : '';
  const alreadyRendered = /already been rendered/i.test(raw);
  const message =
    (alreadyRendered && 'Please try Send OTP once more.') ||
    (code === 'auth/operation-not-allowed' && /region/i.test(raw) && raw) ||
    FIREBASE_MESSAGES[code] ||
    raw ||
    "We couldn't send the OTP right now. Please try again.";
  throw Object.assign(new Error(message), { code: alreadyRendered ? 'auth/captcha-check-failed' : code || 'FIREBASE_ERROR' });
}

function resetRecaptchaContainer() {
  if (recaptcha) {
    try {
      recaptcha.clear();
    } catch {
      // Widget may already be gone after a failed send.
    }
    recaptcha = null;
  }
  confirmation = null;
  const el = document.getElementById('recaptcha-container');
  if (!el?.parentNode) return;
  const next = document.createElement('div');
  next.id = 'recaptcha-container';
  el.parentNode.replaceChild(next, el);
}

export async function sendFirebaseOtp(phone: string) {
  async function sendOnce() {
    const auth = getClientAuth();
    resetRecaptchaContainer();
    recaptcha = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
    });
    confirmation = await signInWithPhoneNumber(auth, phone, recaptcha);
  }

  try {
    await sendOnce();
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    if (/already been rendered/i.test(raw)) {
      try {
        await sendOnce();
        return;
      } catch (retryErr) {
        wrapFirebaseError(retryErr);
      }
    }
    wrapFirebaseError(err);
  }
}

export async function confirmFirebaseOtp(otp: string) {
  if (!confirmation) {
    throw Object.assign(new Error('Please request a new OTP.'), { code: 'OTP_EXPIRED' });
  }
  try {
    const credential = await confirmation.confirm(otp);
    return credential.user.getIdToken();
  } catch (err) {
    wrapFirebaseError(err);
  }
}

export function clearFirebaseOtp() {
  resetRecaptchaContainer();
}
