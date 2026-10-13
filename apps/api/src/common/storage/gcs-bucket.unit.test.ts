import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveGcsBucket } from './gcs-bucket';

describe('GCS bucket selection', () => {
  it('uses an explicit bucket in every environment', () => {
    assert.equal(resolveGcsBucket('careerbridgeprod-uploads', { NODE_ENV: 'production' }), 'careerbridgeprod-uploads');
    assert.equal(resolveGcsBucket(' srsbbucket ', { GCP_PROJECT_ID: 'careerbridge-f7b72' }), 'srsbbucket');
  });

  it('keeps the local default only outside production and Cloud Run', () => {
    assert.equal(resolveGcsBucket(undefined, { NODE_ENV: 'development' }), 'srsbbucket');
    assert.equal(resolveGcsBucket('  ', {}), 'srsbbucket');
  });

  it('refuses to invent a bucket for production or Cloud Run', () => {
    assert.throws(() => resolveGcsBucket(undefined, { NODE_ENV: 'production' }), /GCS_BUCKET is required/);
    assert.throws(() => resolveGcsBucket('', { GCP_PROJECT_ID: 'careerbridgeprod' }), /GCS_BUCKET is required/);
    assert.throws(() => resolveGcsBucket('   ', { NODE_ENV: 'production', GCP_PROJECT_ID: 'careerbridgeprod' }), /GCS_BUCKET is required/);
  });
});
