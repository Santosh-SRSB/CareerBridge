import { browserReadablePhotoUrl } from '@/lib/photo-url';
import { getStoredUser, patchStoredUser } from '@/lib/session';

export {
  browserReadablePhotoUrl as displayableCandidatePhotoUrl,
  cacheBustedPhotoSrc,
} from '@/lib/photo-url';

export const CANDIDATE_PHOTO_UPDATED_EVENT = 'cb-photo-updated';

export type CandidatePhotoUpdatedDetail = {
  photoUrl: string | null;
};

/** Readable photo from the cached session user, if any. */
export function sessionCandidatePhotoUrl(): string | null {
  return browserReadablePhotoUrl(getStoredUser()?.photoUrl);
}

/**
 * Persist a browser-readable photo on the session user.
 * Private GCS object URLs are ignored so /auth/me cannot wipe a good avatar.
 */
export function patchSessionCandidatePhoto(photoUrl: string | null): void {
  if (photoUrl !== null && !browserReadablePhotoUrl(photoUrl)) return;
  try {
    patchStoredUser({ photoUrl: photoUrl === null ? null : browserReadablePhotoUrl(photoUrl) });
  } catch {
    // localStorage quota (large data URLs) — in-memory listeners still get the event
  }
}

/** Broadcast + persist so every candidate shell/page stays in sync after upload/remove. */
export function notifyCandidatePhotoUpdated(photoUrl: string | null): void {
  if (photoUrl !== null) {
    const readable = browserReadablePhotoUrl(photoUrl);
    // Never broadcast private GCS object URLs (browser 403). Callers should pass /candidates/me URLs.
    if (!readable) return;
    patchSessionCandidatePhoto(readable);
    dispatchPhotoUpdated(readable);
    return;
  }
  patchSessionCandidatePhoto(null);
  dispatchPhotoUpdated(null);
}

function dispatchPhotoUpdated(photoUrl: string | null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<CandidatePhotoUpdatedDetail>(CANDIDATE_PHOTO_UPDATED_EVENT, {
      detail: { photoUrl },
    }),
  );
}

export function subscribeCandidatePhotoUpdated(
  onChange: (photoUrl: string | null) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<CandidatePhotoUpdatedDetail>).detail;
    if (!detail || !('photoUrl' in detail)) {
      onChange(sessionCandidatePhotoUrl());
      return;
    }
    onChange(detail.photoUrl);
  };
  window.addEventListener(CANDIDATE_PHOTO_UPDATED_EVENT, handler);
  return () => window.removeEventListener(CANDIDATE_PHOTO_UPDATED_EVENT, handler);
}
