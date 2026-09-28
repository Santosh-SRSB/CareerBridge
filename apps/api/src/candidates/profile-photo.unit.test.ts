import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestException, PayloadTooLargeException, ServiceUnavailableException } from '@nestjs/common';
import {
  ownedProfilePhotoPath,
  profilePhotoPath,
  readOwnedProfilePhotoDataUrl,
  validateProfilePhoto,
} from './profile-photo.util';
import { CandidatesService } from './candidates.service';
import { UpdateCandidateDto } from './dto/update-candidate.dto';

const BUCKET = 'srsbbucket';
const A = '837b3954-f983-4ae7-9f0a-b4710414dedc';
const B = 'e9f9a85b-38aa-0a6f-7329-3830da597839';
const GCS = `https://storage.googleapis.com/${BUCKET}/`;

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const JPEG_1X1 = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
);

describe('ownedProfilePhotoPath', () => {
  it('accepts the candidate canonical keys and own legacy 8-char keys', () => {
    assert.deepEqual(ownedProfilePhotoPath(`${GCS}Images/profile-photo-${A}.png`, A, BUCKET), {
      path: `Images/profile-photo-${A}.png`,
      legacy: false,
    });
    assert.deepEqual(ownedProfilePhotoPath(`${GCS}Images/profile-photo-837b3954.jpg`, A, BUCKET), {
      path: 'Images/profile-photo-837b3954.jpg',
      legacy: true,
    });
  });

  const attacks: Array<[string, string]> = [
    ['B resume object', `${GCS}resumes/original-resume-8867273c-2aff-4624-800a-da008c2a2d93.pdf`],
    ['B canonical photo', `${GCS}Images/profile-photo-${B}.png`],
    ['B legacy photo', `${GCS}Images/profile-photo-e9f9a85b.png`],
    ['arbitrary resumes path', `${GCS}resumes/anything.pdf`],
    ['arbitrary Images path', `${GCS}Images/other.png`],
    ['other bucket, own key', `https://storage.googleapis.com/evil-bucket/Images/profile-photo-${A}.png`],
    ['external URL', 'https://example.com/tracker.png'],
    ['http scheme', `http://storage.googleapis.com/${BUCKET}/Images/profile-photo-${A}.png`],
    ['gs uri', `gs://${BUCKET}/Images/profile-photo-${A}.png`],
    ['bare path', `Images/profile-photo-${A}.png`],
    ['path traversal', `${GCS}Images/profile-photo-${A}.png/../../resumes/x.pdf`],
    ['traversal into own key', `${GCS}resumes/../Images/profile-photo-${A}.png`],
    ['encoded traversal', `${GCS}Images/%2e%2e/resumes/x.pdf`],
    ['encoded own key', `${GCS}Images%2Fprofile-photo-${A}.png`],
    ['query string', `${GCS}Images/profile-photo-${A}.png?alt=media`],
    ['fragment', `${GCS}Images/profile-photo-${A}.png#x`],
    ['double slash', `${GCS}/Images/profile-photo-${A}.png`],
    ['upper-case extension', `${GCS}Images/profile-photo-${A}.PNG`],
    ['unsupported canonical ext', `${GCS}Images/profile-photo-${A}.gif`],
    ['host confusion', `https://storage.googleapis.com.evil.com/${BUCKET}/Images/profile-photo-${A}.png`],
    ['userinfo trick', `https://storage.googleapis.com@evil.com/${BUCKET}/Images/profile-photo-${A}.png`],
    ['data url', 'data:text/html;base64,PHNjcmlwdD4='],
    ['empty', ''],
  ];
  for (const [label, value] of attacks) {
    it(`rejects ${label}`, () => {
      assert.equal(ownedProfilePhotoPath(value, A, BUCKET), null);
    });
  }

  it('rejects when bucket or candidate id is missing/invalid', () => {
    assert.equal(ownedProfilePhotoPath(`${GCS}Images/profile-photo-${A}.png`, A, ''), null);
    assert.equal(ownedProfilePhotoPath(`${GCS}Images/profile-photo-${A}.png`, 'not-a-uuid', BUCKET), null);
  });

  it('derives the canonical key from the full candidate id (no 8-char collisions)', () => {
    assert.equal(profilePhotoPath(A, 'png'), `Images/profile-photo-${A}.png`);
    assert.throws(() => profilePhotoPath('../../resumes/x', 'png'));
  });
});

describe('validateProfilePhoto', () => {
  it('accepts a real PNG and a real JPEG', async () => {
    assert.deepEqual(await validateProfilePhoto({ buffer: PNG_1X1, mimetype: 'image/png', size: PNG_1X1.length }), {
      ok: true,
      type: 'png',
      contentType: 'image/png',
    });
    assert.deepEqual(await validateProfilePhoto({ buffer: JPEG_1X1, mimetype: 'image/jpeg', size: JPEG_1X1.length }), {
      ok: true,
      type: 'jpg',
      contentType: 'image/jpeg',
    });
  });

  it('rejects PDF or text bytes labelled image/png', async () => {
    const pdf = Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n');
    const text = Buffer.from('this is definitely not an image file');
    assert.deepEqual(await validateProfilePhoto({ buffer: pdf, mimetype: 'image/png', size: pdf.length }), {
      ok: false,
      reason: 'signature_mismatch',
    });
    assert.deepEqual(await validateProfilePhoto({ buffer: text, mimetype: 'image/png', size: text.length }), {
      ok: false,
      reason: 'signature_mismatch',
    });
  });

  it('rejects a PNG signature followed by garbage (malformed)', async () => {
    const broken = Buffer.concat([PNG_1X1.subarray(0, 8), Buffer.alloc(64, 7)]);
    assert.deepEqual(await validateProfilePhoto({ buffer: broken, mimetype: 'image/png', size: broken.length }), {
      ok: false,
      reason: 'malformed',
    });
  });

  it('rejects oversized, unsupported and missing files', async () => {
    const big = Buffer.concat([PNG_1X1, Buffer.alloc(5 * 1024 * 1024)]);
    assert.equal((await validateProfilePhoto({ buffer: big, mimetype: 'image/png', size: big.length })) .ok, false);
    assert.deepEqual(await validateProfilePhoto({ buffer: big, mimetype: 'image/png', size: big.length }), {
      ok: false,
      reason: 'too_large',
    });
    const gif = Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'binary');
    assert.deepEqual(await validateProfilePhoto({ buffer: gif, mimetype: 'image/gif', size: gif.length }), {
      ok: false,
      reason: 'unsupported_type',
    });
    assert.deepEqual(await validateProfilePhoto({ buffer: Buffer.alloc(0), mimetype: 'image/png', size: 0 }), {
      ok: false,
      reason: 'missing',
    });
  });
});

function makeHarness(initialPhoto: string | null, opts: { uploadFails?: boolean; configured?: boolean; sharedRefs?: number } = {}) {
  const state = {
    candidate: {
      id: A,
      userId: 'user-a',
      photoUrl: initialPhoto as string | null,
      firstName: 'Dev',
      lastName: null,
      city: null,
      state: null,
      preferredWorkCity: null,
      careerInterests: '[]',
      certifications: '[]',
      projects: '[]',
      profileLinks: '{}',
      education: [],
      skills: [],
      experiences: [],
      user: { phone: null, email: null },
      profileCompletion: 0,
      hasExperience: null,
      experienceLevel: null,
    } as Record<string, unknown>,
    updates: [] as Array<Record<string, unknown>>,
    uploads: [] as string[],
    deletes: [] as string[],
    downloads: [] as string[],
  };
  const prisma = {
    candidate: {
      findUnique: async () => ({ ...state.candidate }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        state.updates.push(data);
        Object.assign(state.candidate, data);
        return { ...state.candidate };
      },
      count: async () => opts.sharedRefs ?? 0,
    },
  };
  const storage = {
    isConfigured: () => opts.configured !== false,
    getBucketName: () => BUCKET,
    uploadFile: async (path: string) => {
      if (opts.uploadFails) throw new Error('simulated GCS outage');
      state.uploads.push(path);
      return { publicUrl: `${GCS}${path}`, gcsUri: `gs://${BUCKET}/${path}` };
    },
    deleteFile: async (path: string) => {
      state.deletes.push(path);
      return true;
    },
    downloadFile: async (path: string) => {
      state.downloads.push(path);
      return Buffer.from('img');
    },
    getSignedUrl: async () => {
      throw new Error('no signer on Cloud Run');
    },
  };
  const service = new CandidatesService(
    prisma as never,
    { recomputeMatchesForPublishedJobs: async () => undefined } as never,
    {} as never,
    storage as never,
    { markEligible: async () => undefined } as never,
  );
  return { service, state };
}

const FOREIGN = `${GCS}resumes/original-resume-8867273c-2aff-4624-800a-da008c2a2d93.pdf`;

describe('CandidatesService photo handling', () => {
  it('storage failure → 503, DB photo reference unchanged, no base64 persisted', async () => {
    const own = `${GCS}Images/profile-photo-837b3954.png`;
    const { service, state } = makeHarness(own, { uploadFails: true });
    await assert.rejects(
      service.uploadPhotoFile('user-a', { buffer: PNG_1X1, mimetype: 'image/png', size: PNG_1X1.length }),
      ServiceUnavailableException,
    );
    assert.equal(state.candidate.photoUrl, own);
    assert.equal(state.updates.length, 0);
    assert.equal(state.deletes.length, 0);
  });

  it('storage not configured → 503 and no DB write', async () => {
    const { service, state } = makeHarness(null, { configured: false });
    await assert.rejects(
      service.uploadPhotoFile('user-a', { buffer: PNG_1X1, mimetype: 'image/png', size: PNG_1X1.length }),
      ServiceUnavailableException,
    );
    assert.equal(state.updates.length, 0);
  });

  it('invalid bytes are rejected before any storage or DB work', async () => {
    const { service, state } = makeHarness(null);
    const pdf = Buffer.from('%PDF-1.7 fake image payload');
    await assert.rejects(
      service.uploadPhotoFile('user-a', { buffer: pdf, mimetype: 'image/png', size: pdf.length }),
      BadRequestException,
    );
    const big = Buffer.concat([PNG_1X1, Buffer.alloc(5 * 1024 * 1024)]);
    await assert.rejects(
      service.uploadPhotoFile('user-a', { buffer: big, mimetype: 'image/png', size: big.length }),
      PayloadTooLargeException,
    );
    assert.equal(state.uploads.length + state.updates.length + state.deletes.length, 0);
  });

  it('successful upload stores the full-id key and never deletes a foreign stored path', async () => {
    const { service, state } = makeHarness(FOREIGN);
    await service.uploadPhotoFile('user-a', { buffer: JPEG_1X1, mimetype: 'image/jpeg', size: JPEG_1X1.length });
    assert.deepEqual(state.uploads, [`Images/profile-photo-${A}.jpg`]);
    assert.equal(state.candidate.photoUrl, `${GCS}Images/profile-photo-${A}.jpg`);
    assert.deepEqual(state.deletes, [`Images/profile-photo-${A}.png`]);
  });

  it('own legacy key is deleted only when no other candidate references it', async () => {
    const legacy = `${GCS}Images/profile-photo-837b3954.png`;
    const shared = makeHarness(legacy, { sharedRefs: 1 });
    await shared.service.uploadPhotoFile('user-a', { buffer: PNG_1X1, mimetype: 'image/png', size: PNG_1X1.length });
    assert.ok(!shared.state.deletes.includes('Images/profile-photo-837b3954.png'));

    const sole = makeHarness(legacy, { sharedRefs: 0 });
    await sole.service.uploadPhotoFile('user-a', { buffer: PNG_1X1, mimetype: 'image/png', size: PNG_1X1.length });
    assert.ok(sole.state.deletes.includes('Images/profile-photo-837b3954.png'));
    assert.ok(sole.state.deletes.every((p) => p.startsWith('Images/profile-photo-')));
  });

  it('PATCH with a non-empty photoUrl is rejected and nothing changes', async () => {
    for (const value of [FOREIGN, 'https://example.com/tracker.png', `${GCS}Images/profile-photo-${A}.png`]) {
      const { service, state } = makeHarness(null);
      await assert.rejects(service.updateMe('user-a', { photoUrl: value } as never), BadRequestException);
      assert.equal(state.updates.length, 0);
      assert.equal(state.deletes.length, 0);
    }
  });

  it('PATCH photoUrl:null clears the reference and deletes only own keys', async () => {
    const { service, state } = makeHarness(FOREIGN);
    await service.updateMe('user-a', { photoUrl: null } as never);
    assert.equal(state.candidate.photoUrl, null);
    assert.ok(state.deletes.length > 0);
    assert.ok(state.deletes.every((p) => p === `Images/profile-photo-${A}.png` || p === `Images/profile-photo-${A}.jpg`));
  });

  it('profile read never downloads a foreign stored reference', async () => {
    const { service, state } = makeHarness(FOREIGN);
    const me = await service.me('user-a');
    assert.equal(me.photoUrl, null);
    assert.deepEqual(state.downloads, []);
  });

  it('profile read of own photo downloads exactly the owned key', async () => {
    const { service, state } = makeHarness(`${GCS}Images/profile-photo-837b3954.png`);
    const me = await service.me('user-a');
    assert.match(String(me.photoUrl), /^data:image\/png;base64,/);
    assert.deepEqual(state.downloads, ['Images/profile-photo-837b3954.png']);
  });

  it('resume PDF photo loader refuses foreign references', async () => {
    const downloads: string[] = [];
    const storage = {
      isConfigured: () => true,
      getBucketName: () => BUCKET,
      downloadFile: async (p: string) => {
        downloads.push(p);
        return Buffer.from('x');
      },
    };
    assert.equal(await readOwnedProfilePhotoDataUrl(storage, A, FOREIGN), null);
    assert.equal(await readOwnedProfilePhotoDataUrl(storage, A, 'http://169.254.169.254/computeMetadata/v1/'), null);
    assert.deepEqual(downloads, []);
  });
});

describe('UpdateCandidateDto.photoUrl', () => {
  async function errorsFor(photoUrl: unknown) {
    return validate(plainToInstance(UpdateCandidateDto, { photoUrl }));
  }
  it('allows null, empty string or omission', async () => {
    assert.equal((await errorsFor(null)).length, 0);
    assert.equal((await errorsFor('')).length, 0);
    assert.equal((await validate(plainToInstance(UpdateCandidateDto, {}))).length, 0);
  });
  it('rejects any URL or path', async () => {
    for (const value of [FOREIGN, 'https://example.com/x.png', `Images/profile-photo-${A}.png`, 'data:image/png;base64,AAAA']) {
      assert.ok((await errorsFor(value)).length > 0, value);
    }
  });
});
