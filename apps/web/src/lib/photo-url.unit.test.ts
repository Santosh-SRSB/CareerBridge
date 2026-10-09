import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { browserReadablePhotoUrl } from '../../../web/src/lib/photo-url';

const OBJECT = 'https://storage.googleapis.com/srsbbucket/Images/profile-photo-837b3954-f983-4ae7-9f0a-b4710414dedc.png';

describe('browserReadablePhotoUrl', () => {
  it('drops unsigned private-bucket object URLs', () => {
    assert.equal(browserReadablePhotoUrl(OBJECT), null);
    assert.equal(browserReadablePhotoUrl(`${OBJECT}?v=abc`), null);
  });

  it('keeps signed object URLs', () => {
    const v4 = `${OBJECT}?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Signature=abc`;
    const v2 = `${OBJECT}?GoogleAccessId=sa&Expires=1&Signature=abc`;
    assert.equal(browserReadablePhotoUrl(v4), v4);
    assert.equal(browserReadablePhotoUrl(v2), v2);
  });

  it('keeps inline, local preview and non-bucket URLs', () => {
    assert.equal(browserReadablePhotoUrl('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
    assert.equal(browserReadablePhotoUrl('blob:http://localhost:3000/x'), 'blob:http://localhost:3000/x');
    assert.equal(browserReadablePhotoUrl('https://cdn.example.com/a.png'), 'https://cdn.example.com/a.png');
  });

  it('returns null for empty or malformed values', () => {
    assert.equal(browserReadablePhotoUrl(null), null);
    assert.equal(browserReadablePhotoUrl(undefined), null);
    assert.equal(browserReadablePhotoUrl(''), null);
    assert.equal(browserReadablePhotoUrl('not a url'), null);
  });
});
