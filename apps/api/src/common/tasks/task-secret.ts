import { timingSafeEqual } from 'crypto';

export type TaskSecretStatus = 'ok' | 'missing_secret' | 'mismatch';

/**
 * Shared-secret checks for public Cloud Tasks callbacks.
 * Production and Cloud Run must have a secret configured. Local development may omit it.
 */
export function cloudTaskSecretStatus(
  expected: string,
  provided: string | undefined,
  env: { NODE_ENV?: string; GCP_PROJECT_ID?: string },
): TaskSecretStatus {
  const configured = expected.trim();
  const cloud = env.NODE_ENV === 'production' || Boolean((env.GCP_PROJECT_ID || '').trim());
  if (!configured) return cloud ? 'missing_secret' : 'ok';
  const given = provided ?? '';
  const left = Buffer.from(configured);
  const right = Buffer.from(given);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return 'mismatch';
  return 'ok';
}
