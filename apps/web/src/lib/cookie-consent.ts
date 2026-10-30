export type CookieConsentValue = 'accepted' | 'rejected';

const STORAGE_KEY = 'cb_cookie_consent_v1';
const CONSENT_EVENT = 'cb-cookie-consent-change';
const SETTINGS_EVENT = 'cb-cookie-settings-open';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/** Returns stored marketing-cookie preference, or null if the visitor has not chosen yet. */
export function getCookieConsent(): CookieConsentValue | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'accepted' || raw === 'rejected') return raw;
  } catch {
    // Private mode / blocked storage — treat as no choice.
  }
  return null;
}

export function hasMarketingConsent(): boolean {
  return getCookieConsent() === 'accepted';
}

export function setCookieConsent(value: CookieConsentValue) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Ignore persistence failures; in-memory listeners still update this tab.
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}

/** Re-open the consent UI so visitors can change Accept / Reject later. */
export function openCookieSettings() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

export function subscribeCookieConsent(listener: (value: CookieConsentValue | null) => void) {
  if (typeof window === 'undefined') return () => undefined;
  const onChange = () => listener(getCookieConsent());
  window.addEventListener(CONSENT_EVENT, onChange);
  return () => window.removeEventListener(CONSENT_EVENT, onChange);
}

export function subscribeCookieSettingsOpen(listener: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(SETTINGS_EVENT, listener);
  return () => window.removeEventListener(SETTINGS_EVENT, listener);
}

/**
 * Public marketing / auth surfaces where the consent banner may appear.
 * Private product areas (dashboards, passport, employer app, etc.) stay free of the banner.
 */
export function isPublicConsentPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.split('?')[0] || '/';

  const privateExact = new Set(['/employer']);
  if (privateExact.has(path)) return false;

  const privatePrefixes = [
    '/dashboard',
    '/passport',
    '/resume',
    '/resumes',
    '/applications',
    '/profile',
    '/onboarding',
    '/interviews',
    '/jobs',
    '/notifications',
    '/assessments',
    '/ats',
    '/courses',
    '/feedback',
    '/admin',
    '/adminsrsb',
    '/srsbaadmin',
  ];
  if (privatePrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return false;
  }

  // Employer product app is private; welcome / register / terms stay public.
  if (path.startsWith('/employer/')) {
    return (
      path === '/employer/welcome' ||
      path === '/employer/register' ||
      path === '/employer/terms' ||
      path.startsWith('/employer/welcome/') ||
      path.startsWith('/employer/register/') ||
      path.startsWith('/employer/terms/')
    );
  }

  return true;
}
