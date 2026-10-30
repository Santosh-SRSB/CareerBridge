import { hasMarketingConsent } from './cookie-consent';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

const PIXEL_ID = (process.env.NEXT_PUBLIC_META_PIXEL_ID || '').trim();

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
let lastPageViewPath: string | null = null;
const firedConversionKeys = new Set<string>();

export function getMetaPixelId(): string {
  return PIXEL_ID;
}

export function isMetaPixelConfigured(): boolean {
  return PIXEL_ID.length > 0;
}

export function isMetaPixelAllowlisted(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.split('?')[0] || '/';
  return ALLOWLIST_EXACT.has(path);
}

export function canUseMetaPixel(pathname?: string | null): boolean {
  if (!isMetaPixelConfigured() || !hasMarketingConsent()) return false;
  if (pathname === undefined) return true;
  return isMetaPixelAllowlisted(pathname);
}

function safeFbq(...args: unknown[]) {
  try {
    if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
    window.fbq(...args);
  } catch {
    // Never break product flows because of tracking.
  }
}

/** Install fbq stub + fbevents.js once. No-ops without consent / Pixel ID. */
export function ensureMetaPixelLoaded(): boolean {
  if (!isMetaPixelConfigured() || !hasMarketingConsent()) return false;
  if (typeof window === 'undefined') return false;

  try {
    if (typeof window.fbq === 'function') {
      return true;
    }

    const fbq = function (...args: unknown[]) {
      const queue = (fbq as unknown as { queue?: unknown[] }).queue;
      if (queue) queue.push(args);
    } as ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; callMethod?: unknown };

    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = '2.0';
    window.fbq = fbq;
    if (!window._fbq) window._fbq = fbq;

    if (!scriptRequested) {
      scriptRequested = true;
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      const first = document.getElementsByTagName('script')[0];
      first?.parentNode?.insertBefore(script, first);
      window.fbq('init', PIXEL_ID);
    }
    return true;
  } catch {
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
  if (!hasMarketingConsent() || !isMetaPixelConfigured()) return;
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
