/**
 * Admin / Super Admin employer details: GSTIN is returned in full for authorised staff.
 * PAN, CIN and ciphertext never leave the API.
 * Synthetic identifiers and test-only keys.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AdminService } from './admin.service';
import { encryptPii, loadPiiKeyring } from '../common/crypto/pii-crypto';
import { PiiCryptoService } from '../common/crypto/pii-crypto.service';

const key = (fill: number) => Buffer.alloc(32, fill).toString('base64');
const ENV = { PII_ENCRYPTION_KEYS: `k1:${key(1)}`, PII_LOOKUP_KEY: key(9) };
const RING = loadPiiKeyring(ENV)!;
const pii = new PiiCryptoService({ get: (name: string) => (ENV as Record<string, string>)[name] } as any);

const GSTIN = '27AAPFU0939F1ZV';
const PAN = 'AAPFU0939F';
const CIN = 'U72900MH2015PTC123456';

function harness(overrides: Record<string, unknown>) {
  const employer = {
    id: 'emp-1',
    companyName: 'Synthetic Traders',
    verified: false,
    verificationStatus: 'PENDING',
    city: 'Bengaluru',
    state: 'Karnataka',
    gstNumber: encryptPii(RING, 'employers.gst_number', GSTIN),
    panNumber: encryptPii(RING, 'employers.pan_number', PAN),
    cin: encryptPii(RING, 'employers.cin', CIN),
    createdAt: new Date('2026-10-01T00:00:00Z'),
    user: { phone: '+919800000001', email: 'owner@example.test', status: 'ACTIVE', createdAt: new Date('2026-10-01T00:00:00Z') },
    jobs: [],
    _count: { jobs: 0, interviews: 0 },
    ...overrides,
  };
  const updates: Array<Record<string, unknown>> = [];
  const prisma = {
    employer: {
      findUnique: async () => employer,
      update: async (args: { data: Record<string, unknown>; select?: Record<string, true> }) => {
        updates.push(args);
        const next: Record<string, unknown> = { ...employer, ...args.data };
        return args.select ? Object.fromEntries(Object.keys(args.select).map((k) => [k, next[k]])) : next;
      },
    },
    application: { count: async () => 0, findMany: async () => [] },
    employerInterview: { findMany: async () => [] },
    platformSetting: { findMany: async () => [] },
    job: { count: async () => 0 },
    employerCandidateView: { count: async () => 0 },
    auditLog: { create: async () => ({}), findMany: async () => [] },
    user: { findMany: async () => [] },
  };
  return { service: new AdminService(prisma as never, {} as never, {} as never, {} as never, pii), updates };
}

function assertNoSensitiveIdentifiers(result: unknown) {
  const json = JSON.stringify(result);
  assert.ok(!json.includes(`"${PAN}"`), 'PAN leaked');
  assert.ok(!json.includes(CIN), 'CIN leaked');
  assert.ok(!json.includes('pii:v1'), 'ciphertext leaked');
  assert.ok(!/"(gstNumber|panNumber|cin)"/.test(json), 'raw identifier field returned');
}

describe('AdminService.employerDetails business identifiers', () => {
  it('returns the full GSTIN plus saved city and state, and never PAN, CIN or ciphertext', async () => {
    const { service } = harness({});
    const details = (await service.employerDetails('emp-1')) as Record<string, unknown>;
    assert.equal(details.gstin, GSTIN);
    assert.equal(details.city, 'Bengaluru');
    assert.equal(details.state, 'Karnataka');
    assertNoSensitiveIdentifiers(details);
  });

  it('legacy employers without GSTIN or location load with empty values', async () => {
    const { service } = harness({ gstNumber: null, panNumber: null, cin: null, city: null, state: null });
    const details = (await service.employerDetails('emp-1')) as Record<string, unknown>;
    assert.equal(details.gstin, null);
    assert.equal(details.city, null);
    assert.equal(details.state, null);
  });

  it('legacy plaintext GSTIN is shown in full', async () => {
    const { service } = harness({ gstNumber: GSTIN });
    const details = (await service.employerDetails('emp-1')) as Record<string, unknown>;
    assert.equal(details.gstin, GSTIN);
    assertNoSensitiveIdentifiers(details);
  });

  it('a GSTIN that cannot be decrypted shows as unavailable instead of failing the page', async () => {
    const foreign = loadPiiKeyring({ PII_ENCRYPTION_KEYS: `k7:${key(7)}`, PII_LOOKUP_KEY: key(9) })!;
    const { service } = harness({ gstNumber: encryptPii(foreign, 'employers.gst_number', GSTIN) });
    const details = (await service.employerDetails('emp-1')) as Record<string, unknown>;
    assert.equal(details.gstin, 'Unavailable');
    assertNoSensitiveIdentifiers(details);
  });
});

describe('AdminService.verifyEmployer response', () => {
  it('returns only the verification fields, never the stored identifiers', async () => {
    const { service, updates } = harness({});
    const result = await service.verifyEmployer('admin-1', 'emp-1');
    assert.deepEqual(Object.keys(result).sort(), ['companyName', 'id', 'verificationStatus', 'verified']);
    assert.ok(updates[0].select, 'update must select explicit columns');
    assertNoSensitiveIdentifiers(result);
  });
});
