import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { requireJwtAccessSecret, requireJwtRefreshSecret } from './jwt-secrets';

function configOf(map: Record<string, string | undefined>): ConfigService {
  return {
    get: <T = string>(key: string) => map[key] as T,
  } as ConfigService;
}

describe('jwt-secrets', () => {
  it('returns distinct access and refresh secrets when set', () => {
    const config = configOf({
      JWT_ACCESS_SECRET: 'access-secret-value-abc12345',
      JWT_REFRESH_SECRET: 'refresh-secret-value-xyz98765',
    });
    assert.equal(requireJwtAccessSecret(config), 'access-secret-value-abc12345');
    assert.equal(requireJwtRefreshSecret(config), 'refresh-secret-value-xyz98765');
    assert.notEqual(requireJwtAccessSecret(config), requireJwtRefreshSecret(config));
  });

  it('throws when JWT_ACCESS_SECRET is missing', () => {
    const config = configOf({ JWT_REFRESH_SECRET: 'refresh-secret-value-xyz98765' });
    assert.throws(() => requireJwtAccessSecret(config), /JWT_ACCESS_SECRET is not set/);
  });

  it('throws when JWT_REFRESH_SECRET is missing', () => {
    const config = configOf({ JWT_ACCESS_SECRET: 'access-secret-value-abc12345' });
    assert.throws(() => requireJwtRefreshSecret(config), /JWT_REFRESH_SECRET is not set/);
  });

  it('rejects known insecure fallback access secret', () => {
    const config = configOf({ JWT_ACCESS_SECRET: 'dev-access-secret' });
    assert.throws(() => requireJwtAccessSecret(config), /known insecure fallback/);
  });

  it('rejects known insecure fallback refresh secret', () => {
    const config = configOf({ JWT_REFRESH_SECRET: 'dev-refresh-secret' });
    assert.throws(() => requireJwtRefreshSecret(config), /known insecure fallback/);
  });
});
