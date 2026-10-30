import { hasMarketingConsent } from './cookie-consent';

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & {
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
      callMethod?: unknown;
      __cbGated?: boolean;
    };
    _fbq?: unknown;
  }
}

/** Routes where Meta Pixel may load and fire events (after marketing consent). */
const ALLOWLIST_EXACT = new Set([
  '/',
  '/welcome',
  '/employer/welcome',
  '/support',
  '/privacy',
  '/terms',
  '/testimonials',
  '/register',
  '/employer/register',
  '/verify-otp',
]);

let scriptRequested = false;
let pixelInitialized = false;
/** Soft switch: false after Reject until Accept enables tracking again. */
let consentTrackingEnabled = false;
let lastPageViewPath: string | null = null;
const firedConversionKeys = new Set<string>();

export function getMetaPixelId(): string {
  return (process.env.NEXT_PUBLIC_META_PIXEL_ID || '').trim();
}

export function isMetaPixelConfigured(): boolean {
  return getMetaPixelId().length > 0;
}

export function isMetaPixelAllowlisted(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.split('?')[0] || '/';
  return ALLOWLIST_EXACT.has(path);
}

export function canUseMetaPixel(pathname?: string | null): boolean {
  if (!isMetaPixelConfigured() || !hasMarketingConsent() || !consentTrackingEnabled) return false;
  if (pathname === undefined) return true;
  return isMetaPixelAllowlisted(pathname);
}

function safeFbq(...args: unknown[]) {
  try {
    if (!consentTrackingEnabled || !hasMarketingConsent()) return;
    if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
    window.fbq(...args);
  } catch {
    // Never break product flows because of tracking.
  }
}

/**
 * Wrap fbq so track/init traffic stops immediately after Reject, even if fbevents.js
 * remains in the page. Consent grant/revoke commands are always forwarded.
 */
function gateExistingFbq() {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  const current = window.fbq;
  if (current.__cbGated) return;

  const underlying = current;
  const gated = function (...args: unknown[]) {
    const command = args[0];
    if (command === 'consent') {
      return underlying(...args);
    }
    if (!consentTrackingEnabled || !hasMarketingConsent()) {
      return undefined;
    }
    return underlying(...args);
  } as typeof current;

  gated.queue = underlying.queue;
  gated.loaded = underlying.loaded;
  gated.version = underlying.version;
  gated.callMethod = underlying.callMethod;
  gated.__cbGated = true;
  window.fbq = gated;
  window._fbq = gated;
}

/** Stop all Meta tracking immediately when the visitor Rejects advertising cookies. */
export function revokeMetaPixelConsent() {
  consentTrackingEnabled = false;
  lastPageViewPath = null;
  try {
    if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
      gateExistingFbq();
      window.fbq('consent', 'revoke');
    }
  } catch {
    // Ignore Meta SDK errors during revoke.
  }
}

/** Install fbq stub + fbevents.js once. No-ops without consent / Pixel ID. */
export function ensureMetaPixelLoaded(): boolean {
  if (!isMetaPixelConfigured() || !hasMarketingConsent()) {
    consentTrackingEnabled = false;
    return false;
  }
  if (typeof window === 'undefined') return false;

  try {
    consentTrackingEnabled = true;

    if (typeof window.fbq === 'function') {
      gateExistingFbq();
      if (pixelInitialized) {
        window.fbq('consent', 'grant');
      }
      return true;
    }

    const fbq = function (...args: unknown[]) {
      const queue = (fbq as unknown as { queue?: unknown[] }).queue;
      if (queue) queue.push(args);
    } as NonNullable<Window['fbq']>;

    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = '2.0';
    window.fbq = fbq;
    if (!window._fbq) window._fbq = fbq;
    gateExistingFbq();

    if (!scriptRequested) {
      scriptRequested = true;
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      const first = document.getElementsByTagName('script')[0];
      first?.parentNode?.insertBefore(script, first);
    }

    if (!pixelInitialized) {
      window.fbq('init', getMetaPixelId());
      window.fbq('consent', 'grant');
      pixelInitialized = true;
    } else {
      window.fbq('consent', 'grant');
    }
    return true;
  } catch {
    consentTrackingEnabled = false;
    return false;
  }
}

export function trackMetaPageView(pathname: string) {
  if (!canUseMetaPixel(pathname)) return;
  if (!ensureMetaPixelLoaded()) return;
  if (lastPageViewPath === pathname) return;
  lastPageViewPath = pathname;
  safeFbq('track', 'PageView');
}

/**
 * Call when the visitor leaves an allowlisted path or withdraws consent so a later
 * return to the same path can record a legitimate new PageView.
 */
export function resetMetaPageViewDedupe() {
  lastPageViewPath = null;
}

function trackOnce(key: string, eventName: string, params?: Record<string, string>) {
  if (firedConversionKeys.has(key)) return;
  if (!hasMarketingConsent() || !isMetaPixelConfigured() || !consentTrackingEnabled) return;
  if (!ensureMetaPixelLoaded()) return;
  firedConversionKeys.add(key);
  if (params) safeFbq('track', eventName, params);
  else safeFbq('track', eventName);
}

/** Successful candidate or employer registration (OTP verify). No PII. */
export function trackMetaCompleteRegistration(role: 'candidate' | 'employer', dedupeKey: string) {
  const key = `CompleteRegistration:${role}:${dedupeKey}`;
  trackOnce(key, 'CompleteRegistration', { content_name: `${role}_registration` });
}

/** Successful Request Demo submission. No PII. */
export function trackMetaLead(dedupeKey: string) {
  const key = `Lead:request_demo:${dedupeKey}`;
  trackOnce(key, 'Lead', { content_name: 'request_demo' });
}

/** Test helper — not used by production UI. */
export function __resetMetaPixelForTests() {
  scriptRequested = false;
  pixelInitialized = false;
  consentTrackingEnabled = false;
  lastPageViewPath = null;
  firedConversionKeys.clear();
}
