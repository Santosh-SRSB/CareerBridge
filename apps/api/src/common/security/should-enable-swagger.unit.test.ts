import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldEnableSwagger } from './should-enable-swagger';

describe('shouldEnableSwagger (SEC-CLOUD-010)', () => {
  it('enables swagger for plain local development', () => {
    assert.equal(shouldEnableSwagger({ NODE_ENV: 'development' }), true);
    assert.equal(shouldEnableSwagger({}), true);
  });

  it('enables swagger locally even if ENABLE_SWAGGER is unset or true', () => {
    assert.equal(shouldEnableSwagger({ NODE_ENV: 'development', ENABLE_SWAGGER: 'true' }), true);
    assert.equal(shouldEnableSwagger({ NODE_ENV: 'development' }), true);
  });

  it('disables swagger when NODE_ENV=production', () => {
    assert.equal(shouldEnableSwagger({ NODE_ENV: 'production' }), false);
  });

  it('disables swagger when GCP_PROJECT_ID is set (Cloud Run)', () => {
    assert.equal(shouldEnableSwagger({ GCP_PROJECT_ID: 'careerbridge-f7b72' }), false);
    assert.equal(
      shouldEnableSwagger({ NODE_ENV: 'development', GCP_PROJECT_ID: 'careerbridge-f7b72' }),
      false,
    );
  });

  it('ignores ENABLE_SWAGGER=true when NODE_ENV=production', () => {
    assert.equal(
      shouldEnableSwagger({
        NODE_ENV: 'production',
        ENABLE_SWAGGER: 'true',
      }),
      false,
    );
  });

  it('ignores ENABLE_SWAGGER=true when GCP_PROJECT_ID is set', () => {
    assert.equal(
      shouldEnableSwagger({
        NODE_ENV: 'development',
        GCP_PROJECT_ID: 'careerbridge-f7b72',
        ENABLE_SWAGGER: 'true',
      }),
      false,
    );
    assert.equal(
      shouldEnableSwagger({
        NODE_ENV: 'production',
        GCP_PROJECT_ID: 'careerbridge-f7b72',
        ENABLE_SWAGGER: 'true',
      }),
      false,
    );
  });

  it('does not treat ENABLE_SWAGGER=false/1/yes as enabling in production', () => {
    assert.equal(shouldEnableSwagger({ NODE_ENV: 'production', ENABLE_SWAGGER: 'false' }), false);
    assert.equal(shouldEnableSwagger({ NODE_ENV: 'production', ENABLE_SWAGGER: '1' }), false);
    assert.equal(shouldEnableSwagger({ NODE_ENV: 'production', ENABLE_SWAGGER: 'yes' }), false);
  });
});
