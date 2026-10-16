import { timingSafeEqual } from 'crypto';
import { ForbiddenException } from '@nestjs/common';

type EnvLike = {
  NODE_ENV?: string;
  GCP_PROJECT_ID?: string;
};

/**
 * Deployed / non-development surfaces (Cloud Run UAT/prod) must not run workers
 * without a configured shared secret. Local development may omit the secret.
 */
export function isTaskSecretRequired(env: EnvLike = process.env): boolean {
  return env.NODE_ENV === 'production' || Boolean(env.GCP_PROJECT_ID?.trim());
}

export type AssertTaskSecretOptions = {
  requireConfigured: boolean;
  /** Reject missing/wrong credentials, and unconfigured secret when required. */
  invalidMessage: string | Record<string, unknown>;
};

/**
 * Shared Cloud Tasks worker secret check.
 * - Configured secret: provided header must match exactly (missing/wrong → Forbidden).
 * - Unconfigured secret: allowed only when requireConfigured is false (development-only).
 * - Comparison uses crypto.timingSafeEqual on UTF-8 buffers (same pattern as WhatsApp HMAC).
 * Never log secret values.
 */
export function assertTaskSecret(
  expectedRaw: string | undefined | null,
  provided: string | undefined,
  options: AssertTaskSecretOptions,
): void {
  const expected = (expectedRaw ?? '').trim();
  if (!expected) {
    if (options.requireConfigured) {
      throw new ForbiddenException(options.invalidMessage);
    }
    return;
  }
  if (typeof provided !== 'string' || provided.length === 0) {
    throw new ForbiddenException(options.invalidMessage);
  }
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(provided, 'utf8');
  if (
    expectedBuf.length !== providedBuf.length ||
    !timingSafeEqual(expectedBuf, providedBuf)
  ) {
    throw new ForbiddenException(options.invalidMessage);
  }
}
