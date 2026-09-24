import { initializeApp, getApps } from 'firebase/app';
import {
  ConfirmationResult,
  PhoneAuthProvider,
  RecaptchaVerifier,
  getAuth,
  signInWithCredential,
  signInWithPhoneNumber,
} from 'firebase/auth';

let recaptcha: RecaptchaVerifier | null = null;
let confirmation: ConfirmationResult | null = null;

const FB_VID_KEY = 'cb_firebase_vid';
const FB_PHONE_KEY = 'cb_firebase_phone';

const FIREBASE_MESSAGES: Record<string, string> = {
  'auth/invalid-verification-code': 'Incorrect OTP. Please check the code and try again.',
  'auth/code-expired': 'This OTP has expired. Tap Resend OTP.',
  'auth/invalid-verification-id': 'Please request a new OTP.',
  'auth/missing-verification-code': 'Enter the 6-digit OTP.',
  'auth/too-many-requests': "You've reached the maximum number of attempts. Please try again later.",
  'auth/quota-exceeded':
    'Too many OTP requests for this number. Wait a while, or add this number under Firebase → Phone → Phone numbers for testing.',
  'auth/error-code:-39':
    'Too many OTP requests for this number. Wait a while, or add this number under Firebase → Phone → Phone numbers for testing.',
  'auth/captcha-check-failed': 'Verification check failed. Refresh the page and try again.',
  'auth/invalid-phone-number': 'Enter a valid mobile number with country code.',
  'auth/missing-phone-number': 'Enter a valid mobile number.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/operation-not-allowed': 'Phone OTP is not enabled in Firebase Console yet.',
  'auth/billing-not-enabled':
    'Firebase Phone OTP needs Blaze billing for real SMS. Add a test phone in Firebase Console for local testing.',
  'auth/session-expired': 'This OTP session expired. Tap Resend OTP.',
  'auth/invalid-app-credential':
    'Firebase blocked this browser session. Open http://127.0.0.1:3000 (not localhost), and ensure 127.0.0.1 is an Authorized domain in Firebase Authentication → Settings.',
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
    throw Object.assign(
      new Error('Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* in apps/web/.env.local'),
      { code: 'FIREBASE_NOT_CONFIGURED' },
    );
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

function storeVerification(phone: string, verificationId: string) {
  try {
    sessionStorage.setItem(FB_VID_KEY, verificationId);
    sessionStorage.setItem(FB_PHONE_KEY, phone);
  } catch {
    // private mode / SSR
  }
}

function readStoredVerification(phone?: string): string | null {
  try {
    const vid = sessionStorage.getItem(FB_VID_KEY);
    const storedPhone = sessionStorage.getItem(FB_PHONE_KEY);
    if (!vid) return null;
    if (phone && storedPhone && storedPhone !== phone) return null;
    return vid;
  } catch {
    return null;
  }
}

function clearStoredVerification() {
  try {
    sessionStorage.removeItem(FB_VID_KEY);
    sessionStorage.removeItem(FB_PHONE_KEY);
  } catch {
    // ignore
  }
}

function wrapFirebaseError(err: unknown): never {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
  const raw = err instanceof Error ? err.message : '';
  const alreadyRendered = /already been rendered/i.test(raw);
  const quotaHit =
    code === 'auth/error-code:-39' ||
    code === 'auth/quota-exceeded' ||
    /error code:\s*39/i.test(raw) ||
    /quota.?exceeded/i.test(raw);
  const mappedCode = quotaHit ? 'auth/quota-exceeded' : code;
  const message =
    (alreadyRendered && 'Please try Send OTP once more.') ||
    (quotaHit && FIREBASE_MESSAGES['auth/quota-exceeded']) ||
    (code === 'auth/operation-not-allowed' && /region/i.test(raw) && raw) ||
    FIREBASE_MESSAGES[code] ||
    raw ||
    "We couldn't send the OTP right now. Please try again.";
  throw Object.assign(new Error(message), {
    code: alreadyRendered ? 'auth/captcha-check-failed' : mappedCode || 'FIREBASE_ERROR',
  });
}

/** Keep one stable container Firebase can attach to (must stay in the DOM). */
function prepareRecaptchaContainer() {
  let el = document.getElementById('recaptcha-container');
  if (!el) {
    el = document.createElement('div');
    el.id = 'recaptcha-container';
    document.body.appendChild(el);
  }
  // Off-screen but still “visible” to reCAPTCHA (avoid display:none).
  el.setAttribute(
    'style',
    'position:fixed;left:-9999px;bottom:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;',
  );
  el.innerHTML = '';
  return el;
}

function clearRecaptchaVerifier() {
  if (recaptcha) {
    try {
      recaptcha.clear();
    } catch {
      // Widget may already be gone after a failed send.
    }
    recaptcha = null;
  }
}

export async function sendFirebaseOtp(phone: string) {
  const normalized = phone.trim();
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw Object.assign(new Error('Enter a valid mobile number with country code.'), {
      code: 'auth/invalid-phone-number',
    });
  }

  async function sendOnce() {
    const auth = getClientAuth();
    clearRecaptchaVerifier();
    prepareRecaptchaContainer();

    recaptcha = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {
        // solved
      },
      'expired-callback': () => {
        clearRecaptchaVerifier();
      },
    });

    // Let Firebase drive reCAPTCHA + SMS in one step (do not pre-render).
    confirmation = await signInWithPhoneNumber(auth, normalized, recaptcha);
    storeVerification(normalized, confirmation.verificationId);
  }

  try {
    await sendOnce();
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    clearRecaptchaVerifier();
    if (/already been rendered/i.test(raw)) {
      try {
        await sendOnce();
        return;
      } catch (retryErr) {
        clearRecaptchaVerifier();
        wrapFirebaseError(retryErr);
      }
    }
    wrapFirebaseError(err);
  }
}

export async function confirmFirebaseOtp(otp: string) {
  const auth = getClientAuth();
  const verificationId = confirmation?.verificationId || readStoredVerification();
  if (!verificationId) {
    throw Object.assign(new Error('Please request a new OTP.'), { code: 'OTP_EXPIRED' });
  }
  try {
    const credential = PhoneAuthProvider.credential(verificationId, otp.trim());
    const result = await signInWithCredential(auth, credential);
    clearStoredVerification();
    confirmation = null;
    return result.user.getIdToken(true);
  } catch (err) {
    wrapFirebaseError(err);
  }
}

export function clearFirebaseOtp() {
  confirmation = null;
  clearStoredVerification();
  clearRecaptchaVerifier();
}

export function hasFirebaseOtpConfirmation(phone?: string) {
  if (confirmation?.verificationId) return true;
  return Boolean(readStoredVerification(phone));
}
