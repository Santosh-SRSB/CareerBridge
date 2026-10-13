/**
 * Local development may omit GCS_BUCKET and use the historical bucket name.
 * Production and Cloud Run must name a bucket. They must not inherit that default.
 */
export function resolveGcsBucket(
  configured: string | undefined,
  env: { NODE_ENV?: string; GCP_PROJECT_ID?: string },
): string {
  const name = (configured || '').trim();
  if (name) return name;
  const cloud = env.NODE_ENV === 'production' || Boolean((env.GCP_PROJECT_ID || '').trim());
  if (cloud) {
    throw new Error('GCS_BUCKET is required when the API runs in production or on Cloud Run.');
  }
  return 'srsbbucket';
}
