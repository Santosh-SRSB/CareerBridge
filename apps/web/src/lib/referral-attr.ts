const KEY = 'cb_referral_code';

export function saveReferralCode(code: string) {
  const cleaned = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 30);
  if (!cleaned || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, cleaned);
  } catch {
    // ignore quota / private mode
  }
}

export function loadReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(KEY);
    if (!value) return null;
    return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 30) || null;
  } catch {
    return null;
  }
}

export function clearReferralCode() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function whatsAppShareUrl(shareUrl: string, referralCode: string) {
  // Keep the URL alone on its own line so WhatsApp / chat apps detect a clickable link.
  const text = [
    shareUrl,
    '',
    'Join me on CareerBridge — build your Career Passport and apply to jobs.',
    `Referral code: ${referralCode}`,
  ].join('\n');
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

const POINTS_EVENT = 'cb-referral-points';

export function notifyReferralPoints(points: number) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(POINTS_EVENT, { detail: { points } }));
}

export function subscribeReferralPoints(listener: (points: number) => void) {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (event: Event) => {
    const points = (event as CustomEvent<{ points?: number }>).detail?.points;
    if (typeof points === 'number') listener(points);
  };
  window.addEventListener(POINTS_EVENT, handler);
  return () => window.removeEventListener(POINTS_EVENT, handler);
}
