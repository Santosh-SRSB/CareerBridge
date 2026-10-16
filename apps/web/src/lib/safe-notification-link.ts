/**
 * SEC-FE-008 — only same-origin relative paths are allowed for notification / FCM navigation.
 * Rejects absolute URLs, protocol-relative URLs, backslashes, and scheme-bearing paths.
 */

export const SAFE_NOTIFICATION_LINK_FALLBACK = '/notifications';

export function safeNotificationLink(
  link: unknown,
  fallback: string = SAFE_NOTIFICATION_LINK_FALLBACK,
): string {
  if (typeof link !== 'string') return fallback;
  const trimmed = link.trim();
  if (!trimmed) return fallback;
  if (!trimmed.startsWith('/')) return fallback;
  if (trimmed.startsWith('//')) return fallback;
  if (trimmed.includes('\\')) return fallback;
  // Reject "/javascript:..." style and any path that embeds a URI scheme after the leading slash.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed.slice(1))) return fallback;
  return trimmed;
}

/**
 * ES5-compatible function source embedded in firebase-messaging-sw.js (no module imports).
 * Must stay behaviorally identical to {@link safeNotificationLink}.
 */
export const SAFE_NOTIFICATION_LINK_SW_SOURCE = `
function safeNotificationLink(link, fallback) {
  fallback = fallback || '${SAFE_NOTIFICATION_LINK_FALLBACK}';
  if (typeof link !== 'string') return fallback;
  var trimmed = link.replace(/^\\s+|\\s+$/g, '');
  if (!trimmed) return fallback;
  if (trimmed.charAt(0) !== '/') return fallback;
  if (trimmed.charAt(1) === '/') return fallback;
  if (trimmed.indexOf('\\\\') !== -1) return fallback;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed.slice(1))) return fallback;
  return trimmed;
}
`.trim();
