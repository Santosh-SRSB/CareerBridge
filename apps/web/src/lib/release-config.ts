/**
 * DEV images keep working when NEXT_PUBLIC_CAREERBRIDGE_RELEASE is unset or "dev".
 * A production image must set it to "production" and must not bake DEV endpoints.
 */

const DEV_MARKERS = ['careerbridge-api-dev', 'careerbridge-f7b72', 'localhost', '127.0.0.1', 'srsbbucket'];

export function isProductionRelease(release: string | undefined): boolean {
  return (release || '').trim() === 'production';
}

export function clientApiUrl(configured: string | undefined, release: string | undefined, nodeEnv: string | undefined): string {
  const url = (configured || '').trim().replace(/\/$/, '');
  if (isProductionRelease(release)) {
    const lower = url.toLowerCase();
    if (!lower.startsWith('https://')) return '';
    if (DEV_MARKERS.some((marker) => lower.includes(marker))) return '';
    return url;
  }
  if (url) return url;
  if (nodeEnv !== 'production') return 'http://localhost:3001/api/v1';
  return '';
}

export function firebaseConfigAllowed(
  config: { projectId?: string; authDomain?: string; storageBucket?: string },
  release: string | undefined,
): boolean {
  if (!isProductionRelease(release)) return true;
  const fields = [config.projectId, config.authDomain, config.storageBucket];
  return fields.every((value) => {
    const text = (value || '').trim().toLowerCase();
    return text.length > 0 && !DEV_MARKERS.some((marker) => text.includes(marker));
  });
}
