import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import {
  assertDevTarget,
  buildProfileUpdate,
  checkProfileImage,
  DESIRED_PROFILE,
  DEV_DISPLAY_PHONE,
  DEV_META_APP_ID,
  DEV_WABA_ID,
  displayNameChangePath,
  graphUrl,
  PROFILE_IMAGE_RELATIVE_PATH,
  PROFILE_IMAGE_SHA256,
  redact,
  uploadSessionPath,
} from './whatsapp-profile-dev.lib';

const REPO = resolve(__dirname, '..', '..', '..');
const PHONE_ID = '1273799179152382';
const goodTarget = {
  configuredWabaId: DEV_WABA_ID,
  phoneNumberId: PHONE_ID,
  wabaPhones: [{ id: PHONE_ID, display_phone_number: '+91 95137 91117' }],
  phoneDisplayNumber: '+91 95137 91117',
};

function pngHeader(width: number, height: number) {
  const buf = Buffer.alloc(64);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'latin1');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

describe('DEV target selection', () => {
  it('accepts only the DEV phone inside the DEV WABA', () => {
    assert.deepEqual(assertDevTarget(goodTarget), { wabaId: '946009308557431', phoneNumberId: PHONE_ID, displayPhone: DEV_DISPLAY_PHONE });
    assert.equal(DEV_DISPLAY_PHONE, '+91 95137 91117');
  });

  it('refuses any other configured WABA', () => {
    assert.throws(() => assertDevTarget({ ...goodTarget, configuredWabaId: '123456789012345' }), /not the DEV WABA/);
    assert.throws(() => assertDevTarget({ ...goodTarget, configuredWabaId: undefined }), /not the DEV WABA/);
  });

  it('refuses a phone number ID that Meta does not list under the DEV WABA', () => {
    assert.throws(() => assertDevTarget({ ...goodTarget, wabaPhones: [{ id: '999', display_phone_number: '+91 95137 91117' }] }), /not listed/);
    assert.throws(() => assertDevTarget({ ...goodTarget, phoneNumberId: '' }), /missing or not numeric/);
  });

  it('refuses when Meta reports a different number', () => {
    assert.throws(
      () => assertDevTarget({ ...goodTarget, wabaPhones: [{ id: PHONE_ID, display_phone_number: '+91 90000 00000' }] }),
      /expected \+91 95137 91117/,
    );
    assert.throws(() => assertDevTarget({ ...goodTarget, phoneDisplayNumber: '+1 555 0100' }), /expected \+91 95137 91117/);
  });
});

describe('desired profile', () => {
  it('uses the SRSB CareerBridge name and website', () => {
    assert.equal(DESIRED_PROFILE.displayName, 'SRSB CareerBridge');
    assert.equal(DESIRED_PROFILE.website, 'https://www.srsbcareerbridge.com');
    assert.ok(DESIRED_PROFILE.about.length <= 139);
    assert.ok(DESIRED_PROFILE.description.length <= 512);
  });

  it('reuses the website description text rather than new copy', () => {
    const layout = readFileSync(resolve(REPO, 'apps/web/src/app/layout.tsx'), 'utf8');
    assert.ok(layout.includes(DESIRED_PROFILE.description));
    assert.ok(layout.includes(DESIRED_PROFILE.about));
  });
});

describe('profile photo', () => {
  it('is the provided official SRSB logo and meets Meta requirements unchanged', () => {
    const check = checkProfileImage(readFileSync(resolve(REPO, PROFILE_IMAGE_RELATIVE_PATH)));
    assert.equal(check.sha256, PROFILE_IMAGE_SHA256);
    assert.deepEqual({ ok: check.ok, format: check.format, width: check.width, height: check.height }, {
      ok: true,
      format: 'image/png',
      width: 640,
      height: 640,
    });
  });

  it('rejects non-square, too small, oversized and non-image files', () => {
    assert.match(checkProfileImage(pngHeader(800, 400)).problems.join(), /not square/);
    assert.match(checkProfileImage(pngHeader(100, 100)).problems.join(), /smaller than 192/);
    const big = Buffer.concat([pngHeader(640, 640), Buffer.alloc(5 * 1024 * 1024)]);
    assert.match(checkProfileImage(big).problems.join(), /larger than 5 MB/);
    assert.match(checkProfileImage(Buffer.from('GIF89a........................')).problems.join(), /not a PNG or JPEG/);
  });
});

describe('Meta API requests', () => {
  it('opens the upload session on the DEV Meta app only', () => {
    assert.equal(
      uploadSessionPath(DEV_META_APP_ID, { bytes: 360565, format: 'image/png' }),
      '/1356370663141517/uploads?file_length=360565&file_type=image%2Fpng',
    );
    assert.throws(() => uploadSessionPath('111', { bytes: 1, format: 'image/png' }), /Unexpected Meta app/);
    assert.equal(graphUrl('/x'), 'https://graph.facebook.com/v25.0/x');
  });

  it('builds the business profile body with website and photo handle', () => {
    assert.deepEqual(buildProfileUpdate('4::aGFuZGxl'), {
      messaging_product: 'whatsapp',
      about: DESIRED_PROFILE.about,
      description: DESIRED_PROFILE.description,
      websites: ['https://www.srsbcareerbridge.com'],
      profile_picture_handle: '4::aGFuZGxl',
    });
    assert.equal('profile_picture_handle' in buildProfileUpdate(), false);
  });

  it('submits the display name for review on the DEV phone number ID', () => {
    assert.equal(displayNameChangePath(PHONE_ID), `/${PHONE_ID}?new_display_name=SRSB%20CareerBridge`);
    assert.throws(() => displayNameChangePath('abc'), /not numeric/);
  });
});

describe('secrets', () => {
  it('redacts the token and token-shaped strings', () => {
    const token = 'EAAJBexampleexampleexampleexample123';
    assert.equal(redact(`Bearer ${token} failed`, [token]), 'Bearer [redacted] failed');
    assert.equal(redact('x EAAGabcdefghijklmnopqrstuvwxyz y', []), 'x [redacted] y');
    assert.equal(redact('secret-value-1 here', ['secret-value-1']), '[redacted] here');
  });

  it('the setup script never prints the token directly', () => {
    const src = readFileSync(resolve(__dirname, 'whatsapp-profile-setup-dev.ts'), 'utf8');
    for (const line of src.split('\n').filter((l) => /console\.(log|error|warn|info)/.test(l))) {
      assert.equal(/\bTOKEN\b/.test(line), false, line.trim());
    }
    assert.match(src, /Authorization: `Bearer \$\{TOKEN\}`/);
  });
});
