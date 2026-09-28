import { ConfigService } from '@nestjs/config';

/**
 * Access and refresh tokens use separate secrets.
 * Never fall back to a known hardcoded string — fail clearly if unset.
 */
export function requireJwtAccessSecret(config: ConfigService): string {
  return requireJwtSecret(config, 'JWT_ACCESS_SECRET');
}

export function requireJwtRefreshSecret(config: ConfigService): string {
  return requireJwtSecret(config, 'JWT_REFRESH_SECRET');
}

function requireJwtSecret(config: ConfigService, envKey: string): string {
  const fromEnv = (config.get<string>(envKey) || process.env[envKey] || '').trim();
  if (fromEnv) {
    assertNotKnownFallback(envKey, fromEnv);
    return fromEnv;
  }

  throw new Error(
    `${envKey} is not set. Set it in the environment (local: apps/api/.env; Cloud Run: Secret Manager). ` +
      'The API will not start with a hardcoded JWT fallback.',
  );
}

/** Reject known historical fallbacks even if somehow injected. */
function assertNotKnownFallback(envKey: string, value: string) {
  const banned = new Set([
    'dev-access-secret',
    'dev-refresh-secret',
    'careerbridge-access-secret',
    'careerbridge-refresh-secret',
  ]);
  if (banned.has(value)) {
    throw new Error(
      `${envKey} is set to a known insecure fallback value. Generate a new random secret and update Secret Manager / .env.`,
    );
  }
}
