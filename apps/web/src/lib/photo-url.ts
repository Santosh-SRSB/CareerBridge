const GCS_HOST = 'storage.googleapis.com';
const SIGNATURE_PARAMS = ['X-Goog-Signature', 'Signature'];

/**
 * Photo URL the browser can actually load. Plain storage.googleapis.com object URLs point at a
 * private bucket (anonymous reads are 403), so they are dropped until the API supplies a signed
 * URL or inline copy via /candidates/me.
 */
export function browserReadablePhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.hostname !== GCS_HOST) return url;
  return SIGNATURE_PARAMS.some((param) => parsed.searchParams.has(param)) ? url : null;
}

/** Alias used by candidate UI for the same browser-safe filter. */
export function displayableCandidatePhotoUrl(url: string | null | undefined): string | null {
  return browserReadablePhotoUrl(url);
}

/** Cache-bust remote URLs when the same object key is overwritten after upload. */
export function cacheBustedPhotoSrc(url: string | null | undefined): string | null {
  const src = browserReadablePhotoUrl(url);
  if (!src) return null;
  if (src.startsWith('data:') || src.startsWith('blob:')) return src;
  const token = src.slice(-24);
  return `${src}${src.includes('?') ? '&' : '?'}v=${encodeURIComponent(token)}`;
}
