/**
 * Employer policy + company logo helpers (pure, no Nest DI, no network).
 * Run: npm.cmd run test:employer -w api
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applicationTransitionError,
  effectiveVerificationStatus,
  formatAvailabilityWindow,
  hasCompletedKyc,
  interviewActionCheck,
  intervalsOverlap,
  parseCandidateAvailability,
  parseCompanyWebsite,
  parseInterviewInstant,
  parseNotifyPrefs,
  salaryRangeError,
  stripNotifyMarkers,
  withEffectiveVerification,
  withNotifyPrefs,
} from './employer-policy';
import {
  companyLogoPath,
  companyLogoUrl,
  ownedCompanyLogoPath,
  readableCompanyLogoUrl,
  validateCompanyLogo,
} from './company-logo.util';

const BUCKET = 'srsbbucket';
const EMP_A = '6d318eed-780b-eee3-7027-5827611b6d55';
const EMP_B = '11111111-2222-3333-4444-555555555555';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const JPEG_1X1 = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
);

describe('Employer verification — verificationStatus is authoritative', () => {
  it('legacy verified=true + UNVERIFIED (seed/admin before the enum) is VERIFIED', () => {
    assert.equal(effectiveVerificationStatus({ verified: true, verificationStatus: 'UNVERIFIED' }), 'VERIFIED');
    assert.deepEqual(withEffectiveVerification({ verified: true, verificationStatus: 'UNVERIFIED' }), {
      verified: true,
      verificationStatus: 'VERIFIED',
    });
  });
  it('status wins over a stale boolean', () => {
    assert.deepEqual(withEffectiveVerification({ verified: true, verificationStatus: 'PENDING' }), {
      verified: false,
      verificationStatus: 'PENDING',
    });
    assert.equal(withEffectiveVerification({ verified: false, verificationStatus: 'VERIFIED' }).verified, true);
  });
  it('unverified employers stay restricted; KYC_COMPLETE/PENDING/VERIFIED pass the KYC gate', () => {
    assert.equal(hasCompletedKyc({ verified: false, verificationStatus: 'UNVERIFIED' }), false);
    for (const s of ['KYC_COMPLETE', 'PENDING', 'VERIFIED']) {
      assert.equal(hasCompletedKyc({ verified: false, verificationStatus: s }), true, s);
    }
  });
});

describe('Company website — http/https only', () => {
  it('accepts http, https and bare domains', () => {
    assert.deepEqual(parseCompanyWebsite('https://acme.in'), { ok: true, value: 'https://acme.in/' });
    assert.deepEqual(parseCompanyWebsite('http://acme.in/about'), { ok: true, value: 'http://acme.in/about' });
    assert.deepEqual(parseCompanyWebsite('www.acme.in'), { ok: true, value: 'https://www.acme.in/' });
    assert.deepEqual(parseCompanyWebsite('  '), { ok: true, value: null });
  });
  it('rejects javascript:, data:, file:, other schemes and junk', () => {
    for (const bad of [
      'javascript:alert(1)',
      'JavaScript:alert(document.cookie)',
      'javascript://acme.in/%0aalert(1)',
      'data:text/html;base64,PHNjcmlwdD4=',
      'file:///etc/passwd',
      'ftp://acme.in',
      'mailto:hr@acme.in',
      'vbscript:msgbox(1)',
      'localhost',
      'https://user:pass@acme.in',
      'not a url',
    ]) {
      assert.equal(parseCompanyWebsite(bad).ok, false, bad);
    }
  });
});

describe('Salary range', () => {
  it('min must not exceed max', () => {
    assert.match(String(salaryRangeError(50000, 20000)), /Minimum salary/);
    assert.equal(salaryRangeError(20000, 50000), null);
    assert.equal(salaryRangeError(30000, 30000), null);
    assert.equal(salaryRangeError(undefined, 50000), null);
    assert.equal(salaryRangeError(50000, undefined), null);
  });
});

describe('Application status transitions (existing status model)', () => {
  it('terminal statuses cannot move', () => {
    for (const from of ['HIRED', 'REJECTED', 'WITHDRAWN']) {
      for (const to of ['UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'SELECTED', 'HIRED', 'REJECTED']) {
        if (from === to) continue;
        assert.ok(applicationTransitionError(from, to), `${from} -> ${to}`);
      }
    }
  });
  it('pipeline statuses can move, same-status is not an error', () => {
    assert.equal(applicationTransitionError('APPLIED', 'SHORTLISTED'), null);
    assert.equal(applicationTransitionError('SHORTLISTED', 'UNDER_REVIEW'), null);
    assert.equal(applicationTransitionError('INTERVIEW', 'HIRED'), null);
    assert.equal(applicationTransitionError('SELECTED', 'REJECTED'), null);
    assert.equal(applicationTransitionError('HIRED', 'HIRED'), null);
  });
});

describe('Interview lifecycle', () => {
  it('cancelled interviews cannot be completed, confirmed or rescheduled', () => {
    for (const action of ['complete', 'confirm', 'reschedule'] as const) {
      assert.match(String(interviewActionCheck('CANCELLED', action)), /cancelled/);
    }
  });
  it('completed interviews cannot be cancelled or rescheduled', () => {
    assert.match(String(interviewActionCheck('COMPLETED', 'cancel')), /completed/);
    assert.match(String(interviewActionCheck('COMPLETED', 'reschedule')), /completed/);
  });
  it('repeating the same final action is a no-op; notes always allowed', () => {
    assert.equal(interviewActionCheck('COMPLETED', 'complete'), 'noop');
    assert.equal(interviewActionCheck('CANCELLED', 'cancel'), 'noop');
    assert.equal(interviewActionCheck('CANCELLED', 'notes'), null);
  });
  it('active interviews allow every action', () => {
    for (const status of ['PROPOSED', 'SCHEDULED', 'CONFIRMED']) {
      for (const action of ['confirm', 'reschedule', 'complete', 'cancel'] as const) {
        assert.equal(interviewActionCheck(status, action), null, `${status}/${action}`);
      }
    }
  });
  it('a candidate reschedule request cannot be "confirmed" at the old time; reschedule/cancel still allowed', () => {
    for (const status of ['RESCHEDULE_NEEDED', 'RESCHEDULE_REQUESTED']) {
      assert.match(String(interviewActionCheck(status, 'confirm')), /Use Reschedule/);
      for (const action of ['reschedule', 'cancel', 'complete'] as const) {
        assert.equal(interviewActionCheck(status, action), null, `${status}/${action}`);
      }
    }
  });
  it('candidate availability: date + from + until, validated and stored as IST instants', () => {
    const now = new Date('2026-10-01T04:30:00.000Z'); // 1 Oct 10:00 IST
    const ok = parseCandidateAvailability({ date: '2026-10-03', availableFrom: '15:00', availableUntil: '18:00' }, now);
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.value.availableFrom.toISOString(), '2026-10-03T09:30:00.000Z');
      assert.equal(ok.value.availableUntil.toISOString(), '2026-10-03T12:30:00.000Z');
      assert.equal(ok.value.proposedDate.toISOString(), '2026-10-03T00:00:00.000Z');
      assert.equal(ok.value.timezone, 'Asia/Kolkata');
      assert.equal(
        formatAvailabilityWindow(ok.value.availableFrom, ok.value.availableUntil, ok.value.timezone),
        '3 October, 3:00 PM - 6:00 PM',
      );
    }
    const reject = (input: Record<string, unknown>, pattern: RegExp) => {
      const res = parseCandidateAvailability(input, now);
      assert.equal(res.ok, false, JSON.stringify(input));
      if (!res.ok) assert.match(res.message, pattern);
    };
    reject({ date: '2026-10-03', availableFrom: '15:00' }, /Select a date/);
    reject({ availableFrom: '15:00', availableUntil: '18:00' }, /Select a date/);
    reject({ date: '2026-10-03', availableFrom: '18:00', availableUntil: '15:00' }, /earlier than/);
    reject({ date: '2026-10-03', availableFrom: '15:00', availableUntil: '15:00' }, /earlier than/);
    reject({ date: '2026-02-30', availableFrom: '15:00', availableUntil: '18:00' }, /valid date/);
    reject({ date: '03/10/2026', availableFrom: '15:00', availableUntil: '18:00' }, /valid date/);
    reject({ date: '2026-10-03', availableFrom: '25:00', availableUntil: '26:00' }, /valid times/);
    reject({ date: '2026-09-30', availableFrom: '15:00', availableUntil: '18:00' }, /past/);
    reject({ date: '2027-12-01', availableFrom: '15:00', availableUntil: '18:00' }, /within the next/);
    reject({ date: '2026-10-03', availableFrom: '15:00', availableUntil: '18:00', timezone: 'Mars/Base' }, /time zone/);
  });
  it('overlap detection is half-open', () => {
    const t = (m: number) => new Date(Date.UTC(2026, 9, 1, 4, m));
    assert.equal(intervalsOverlap(t(0), t(30), t(15), t(45)), true);
    assert.equal(intervalsOverlap(t(0), t(30), t(30), t(60)), false);
    assert.equal(intervalsOverlap(t(0), t(60), t(10), t(20)), true);
  });
  it('offset-less times are Asia/Kolkata wall-clock, explicit offsets are kept', () => {
    assert.equal(parseInterviewInstant('2026-10-01T10:00')?.toISOString(), '2026-10-01T04:30:00.000Z');
    assert.equal(parseInterviewInstant('2026-10-01T10:00:00Z')?.toISOString(), '2026-10-01T10:00:00.000Z');
    assert.equal(parseInterviewInstant('2026-10-01T10:00:00+05:30')?.toISOString(), '2026-10-01T04:30:00.000Z');
    assert.equal(parseInterviewInstant('garbage'), null);
  });
  it('notify preferences survive note edits and are hidden from display', () => {
    const stored = withNotifyPrefs('Bring ID', { whatsapp: false, email: true });
    assert.deepEqual(parseNotifyPrefs(stored), { whatsapp: false, email: true });
    assert.equal(stripNotifyMarkers(stored), 'Bring ID');
    const edited = withNotifyPrefs('New note', parseNotifyPrefs(stored));
    assert.deepEqual(parseNotifyPrefs(edited), { whatsapp: false, email: true });
    assert.deepEqual(parseNotifyPrefs('x\nWhatsApp notify: no\nEmail notify: yes'), { whatsapp: false, email: true });
    assert.equal(stripNotifyMarkers('x\nWhatsApp notify: no\nEmail notify: yes'), 'x');
    assert.deepEqual(parseNotifyPrefs(null), { whatsapp: true, email: true });
  });
});

describe('Company logo validation (magic bytes, not Content-Type)', () => {
  it('accepts a real PNG and a real JPEG', async () => {
    assert.deepEqual(await validateCompanyLogo({ buffer: PNG_1X1, mimetype: 'image/png', size: PNG_1X1.length }), {
      ok: true,
      type: 'png',
      contentType: 'image/png',
    });
    assert.deepEqual(await validateCompanyLogo({ buffer: JPEG_1X1, mimetype: 'image/jpeg', size: JPEG_1X1.length }), {
      ok: true,
      type: 'jpg',
      contentType: 'image/jpeg',
    });
  });
  it('rejects mismatched declared type vs bytes', async () => {
    const r1 = await validateCompanyLogo({ buffer: PNG_1X1, mimetype: 'image/jpeg', size: PNG_1X1.length });
    assert.deepEqual(r1, { ok: false, reason: 'signature_mismatch' });
    const html = Buffer.from('<html><script>alert(1)</script></html>');
    assert.deepEqual(await validateCompanyLogo({ buffer: html, mimetype: 'image/png', size: html.length }), {
      ok: false,
      reason: 'signature_mismatch',
    });
    const pdf = Buffer.from('%PDF-1.7\n1 0 obj<<>>endobj');
    assert.deepEqual(await validateCompanyLogo({ buffer: pdf, mimetype: 'image/jpeg', size: pdf.length }), {
      ok: false,
      reason: 'signature_mismatch',
    });
  });
  it('rejects unsupported declared types (svg) and truncated images', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    assert.deepEqual(await validateCompanyLogo({ buffer: svg, mimetype: 'image/svg+xml', size: svg.length }), {
      ok: false,
      reason: 'unsupported_type',
    });
    const truncated = PNG_1X1.subarray(0, 30);
    assert.deepEqual(await validateCompanyLogo({ buffer: truncated, mimetype: 'image/png', size: truncated.length }), {
      ok: false,
      reason: 'malformed',
    });
  });
  it('rejects oversized files', async () => {
    const big = Buffer.concat([PNG_1X1, Buffer.alloc(5 * 1024 * 1024)]);
    assert.deepEqual(await validateCompanyLogo({ buffer: big, mimetype: 'image/png', size: big.length }), {
      ok: false,
      reason: 'too_large',
    });
  });
});

describe('Company logo ownership (private bucket, no external URLs)', () => {
  const store = (overrides: Partial<{ signed: boolean }> = {}) => {
    const reads: string[] = [];
    return {
      reads,
      isConfigured: () => true,
      getBucketName: () => BUCKET,
      downloadFile: async (path: string) => {
        reads.push(path);
        return PNG_1X1;
      },
      getSignedUrl: async (path: string) => {
        if (overrides.signed === false) throw new Error('no signing key');
        reads.push(path);
        return `https://signed.example/${path}?sig=1`;
      },
    };
  };

  it('employer A reads their own logo (signed URL, else inline copy)', async () => {
    const own = companyLogoUrl(BUCKET, EMP_A, 'png');
    const s1 = store();
    assert.equal(await readableCompanyLogoUrl(s1, EMP_A, own), `https://signed.example/${companyLogoPath(EMP_A, 'png')}?sig=1`);
    const s2 = store({ signed: false });
    assert.match(String(await readableCompanyLogoUrl(s2, EMP_A, own)), /^data:image\/png;base64,/);
  });
  it("employer A cannot read employer B's logo, other buckets, or external URLs", async () => {
    const s = store();
    for (const foreign of [
      companyLogoUrl(BUCKET, EMP_B, 'png'),
      `https://storage.googleapis.com/other-bucket/${companyLogoPath(EMP_A, 'png')}`,
      'https://evil.example/logo.png',
      'http://169.254.169.254/computeMetadata/v1/',
      `https://storage.googleapis.com/${BUCKET}/resumes/secret.pdf`,
      `https://storage.googleapis.com/${BUCKET}/Images/../resumes/x.pdf`,
      'data:text/html;base64,PHNjcmlwdD4=',
    ]) {
      assert.equal(await readableCompanyLogoUrl(s, EMP_A, foreign), null, foreign);
    }
    assert.deepEqual(s.reads, []);
  });
  it('honours own legacy keys only', () => {
    const legacy = `https://storage.googleapis.com/${BUCKET}/Images/logo-1790000000000-6d318eed.png`;
    assert.equal(ownedCompanyLogoPath(legacy, EMP_A, BUCKET), 'Images/logo-1790000000000-6d318eed.png');
    assert.equal(ownedCompanyLogoPath(legacy, EMP_B, BUCKET), null);
  });
});
