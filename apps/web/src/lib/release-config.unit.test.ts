import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clientApiUrl, firebaseConfigAllowed } from './release-config';

describe('production web configuration', () => {
  it('accepts an explicit https production API URL', () => {
    assert.equal(
      clientApiUrl('https://careerbridge-api-prod.example/api/v1', 'production', 'production'),
      'https://careerbridge-api-prod.example/api/v1',
    );
  });

  it('drops DEV, local, and empty API URLs from a production release', () => {
    assert.equal(clientApiUrl('', 'production', 'production'), '');
    assert.equal(clientApiUrl('http://localhost:3001/api/v1', 'production', 'production'), '');
    assert.equal(
      clientApiUrl('https://careerbridge-api-dev-601892050765.asia-south1.run.app/api/v1', 'production', 'production'),
      '',
    );
    assert.equal(clientApiUrl('https://example.careerbridge-f7b72.run.app/api/v1', 'production', 'production'), '');
  });

  it('keeps the local default for a development build', () => {
    assert.equal(clientApiUrl('', 'dev', 'development'), 'http://localhost:3001/api/v1');
    assert.equal(clientApiUrl(undefined, undefined, 'test'), 'http://localhost:3001/api/v1');
  });

  it('rejects the DEV Firebase project only for a production release', () => {
    assert.equal(firebaseConfigAllowed({ projectId: 'careerbridge-f7b72', authDomain: 'careerbridge-f7b72.firebaseapp.com', storageBucket: 'careerbridge-f7b72.firebasestorage.app' }, 'dev'), true);
    assert.equal(firebaseConfigAllowed({ projectId: 'careerbridge-f7b72', authDomain: 'careerbridge-f7b72.firebaseapp.com', storageBucket: 'careerbridge-f7b72.firebasestorage.app' }, 'production'), false);
    assert.equal(firebaseConfigAllowed({ projectId: 'careerbridgeprod', authDomain: 'careerbridgeprod.firebaseapp.com', storageBucket: 'careerbridgeprod.appspot.com' }, 'production'), true);
    assert.equal(firebaseConfigAllowed({ projectId: 'careerbridgeprod', authDomain: '', storageBucket: 'careerbridgeprod.appspot.com' }, 'production'), false);
  });
});
