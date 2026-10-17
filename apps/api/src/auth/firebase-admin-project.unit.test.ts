import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { resolveFirebaseAdminProjectId } from './firebase.service';
import { gcpClientOptions } from '../common/gcp/gcp-credentials';

describe('resolveFirebaseAdminProjectId (PROD shared Firebase)', () => {
  it('prefers FIREBASE_PROJECT_ID over GCP_PROJECT_ID when both are set', () => {
    assert.equal(
      resolveFirebaseAdminProjectId({
        FIREBASE_PROJECT_ID: 'careerbridge-f7b72',
        GCP_PROJECT_ID: 'careerbridgeprod',
      }),
      'careerbridge-f7b72',
    );
  });

  it('falls back to GCP_PROJECT_ID when FIREBASE_PROJECT_ID is absent', () => {
    assert.equal(
      resolveFirebaseAdminProjectId({
        GCP_PROJECT_ID: 'careerbridge-f7b72',
      }),
      'careerbridge-f7b72',
    );
  });

  it('treats blank FIREBASE_PROJECT_ID as unset and falls back to GCP_PROJECT_ID', () => {
    assert.equal(
      resolveFirebaseAdminProjectId({
        FIREBASE_PROJECT_ID: '   ',
        GCP_PROJECT_ID: 'careerbridgeprod',
      }),
      'careerbridgeprod',
    );
  });

  it('falls back to GCLOUD_PROJECT / GOOGLE_CLOUD_PROJECT when config ids are unset', () => {
    assert.equal(
      resolveFirebaseAdminProjectId({
        GCLOUD_PROJECT: 'from-gcloud',
      }),
      'from-gcloud',
    );
    assert.equal(
      resolveFirebaseAdminProjectId({
        GOOGLE_CLOUD_PROJECT: 'from-google-cloud',
      }),
      'from-google-cloud',
    );
  });

  it('prefers FIREBASE_PROJECT_ID over GCLOUD_PROJECT when both are set', () => {
    assert.equal(
      resolveFirebaseAdminProjectId({
        FIREBASE_PROJECT_ID: 'careerbridge-f7b72',
        GCLOUD_PROJECT: 'careerbridgeprod',
      }),
      'careerbridge-f7b72',
    );
  });

  it('prefers GCLOUD_PROJECT over GOOGLE_CLOUD_PROJECT when both are set', () => {
    assert.equal(
      resolveFirebaseAdminProjectId({
        GCLOUD_PROJECT: 'from-gcloud',
        GOOGLE_CLOUD_PROJECT: 'from-google-cloud',
      }),
      'from-gcloud',
    );
  });

  it('returns undefined when no project id is available', () => {
    assert.equal(resolveFirebaseAdminProjectId({}), undefined);
  });
});

describe('Firebase Admin project selection does not alter GCP client project', () => {
  it('gcpClientOptions still prefers GCP_PROJECT_ID (Storage/Tasks/DocAI)', () => {
    const config = {
      get: (key: string) =>
        ({
          GCP_PROJECT_ID: 'careerbridgeprod',
          FIREBASE_PROJECT_ID: 'careerbridge-f7b72',
        })[key],
    } as unknown as ConfigService;

    const opts = gcpClientOptions(config);
    assert.equal(opts.projectId, 'careerbridgeprod');
  });
});

describe('Firebase Admin credential init paths (source contract)', () => {
  const source = readFileSync(join(__dirname, 'firebase.service.ts'), 'utf8');

  it('ADC path uses resolveFirebaseAdminProjectId (FIREBASE first)', () => {
    assert.match(source, /resolveFirebaseAdminProjectId\s*\(/);
    assert.match(
      source,
      /pick\(env\.FIREBASE_PROJECT_ID\)\s*\|\|\s*pick\(env\.GCP_PROJECT_ID\)/,
    );
  });

  it('cert path still initializes with credential.cert and FIREBASE_PROJECT_ID', () => {
    assert.match(source, /credential:\s*admin\.credential\.cert\(/);
    assert.match(
      source,
      /fromFile\?\.project_id\s*\|\|\s*this\.config\.get<string>\('FIREBASE_PROJECT_ID'\)/,
    );
    assert.match(source, /credential:\s*admin\.credential\.applicationDefault\(\)/);
  });
});
