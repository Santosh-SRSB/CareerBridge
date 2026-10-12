/**
 * Legacy plaintext backfill against an in-memory table double. Synthetic identifiers and test-only keys only.
 * Run: npm run test:pii -w api
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BackfillDb,
  BackfillOptions,
  BackfillRefusedError,
  backfillComplete,
  runBusinessIdBackfill,
} from './business-id-backfill';
import {
  PiiKeyring,
  decryptPii,
  encryptPii,
  isPiiCiphertext,
  loadPiiKeyring,
  piiCiphertextKeyId,
  piiKeyringFingerprint,
  piiLookupHash,
} from './pii-crypto';

const key = (fill: number) => Buffer.alloc(32, fill).toString('base64');
const RING = loadPiiKeyring({ PII_ENCRYPTION_KEYS: `k1:${key(1)}`, PII_LOOKUP_KEY: key(9) })!;
const ROTATED = loadPiiKeyring({
  PII_ENCRYPTION_KEYS: `k1:${key(1)},k2:${key(2)}`,
  PII_ENCRYPTION_ACTIVE_KEY_ID: 'k2',
  PII_LOOKUP_KEY: key(9),
})!;
/** Same key id as RING but different key bytes: what a stale or wrong .env looks like. */
const WRONG_KEY = loadPiiKeyring({ PII_ENCRYPTION_KEYS: `k1:${key(7)}`, PII_LOOKUP_KEY: key(9) })!;
/** Right encryption key, wrong blind-index key. */
const WRONG_LOOKUP = loadPiiKeyring({ PII_ENCRYPTION_KEYS: `k1:${key(1)}`, PII_LOOKUP_KEY: key(8) })!;

const DATABASE = 'careerbridge_test';
const GST_A = '27AAPFU0939F1ZV';
const GST_B = '29AAAAA0000A1ZY';
const PAN = 'AAPFU0939F';
const CIN = 'U72900MH2015PTC123456';

const apply = (ring: PiiKeyring, extra: Partial<BackfillOptions> = {}): BackfillOptions => ({
  mode: 'apply',
  confirmDatabase: DATABASE,
  expectedKeyFingerprint: piiKeyringFingerprint(ring),
  ...extra,
});

type Row = Record<string, string | null> & { id: string };

function table(rows: Row[], uniqueColumn?: string) {
  const writes: Array<Record<string, unknown>> = [];
  return {
    rows,
    writes,
    async findMany(args: { where?: { id: { gt: string } }; take: number; select: Record<string, true> }) {
      return rows
        .filter((row) => !args.where || row.id > args.where.id.gt)
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, args.take)
        .map((row) => Object.fromEntries(Object.keys(args.select).map((k) => [k, row[k] ?? null])) as Row);
    },
    async updateMany({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) {
      const row = rows.find((r) => Object.entries(where).every(([k, v]) => (r[k] ?? null) === v));
      if (!row) return { count: 0 };
      if (uniqueColumn && data[uniqueColumn] && rows.some((r) => r !== row && r[uniqueColumn] === data[uniqueColumn])) {
        throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      }
      writes.push(data);
      Object.assign(row, data);
      return { count: 1 };
    },
  };
}

function fixture() {
  const employer = table([
    { id: 'e1', gstNumber: GST_A, panNumber: PAN, cin: CIN },
    { id: 'e2', gstNumber: encryptPii(RING, 'employers.gst_number', GST_B), panNumber: 'aapfu 0939f', cin: null },
    { id: 'e3', gstNumber: null, panNumber: null, cin: '  ' },
  ]);
  const company = table(
    [
      { id: 'c1', gstin: GST_A, gstinHash: null },
      {
        id: 'c2',
        gstin: encryptPii(RING, 'companies.gstin', GST_B),
        gstinHash: piiLookupHash(RING, 'gstin', GST_B),
      },
    ],
    'gstinHash',
  );
  const gstVerificationAudit = table([
    { id: 'a1', gstin: GST_A, gstinHash: null },
    { id: 'a2', gstin: GST_B, gstinHash: null },
  ]);
  const db: BackfillDb = {
    employer,
    company,
    gstVerificationAudit,
    currentDatabase: async () => DATABASE,
  } as unknown as BackfillDb;
  const writeCount = () => employer.writes.length + company.writes.length + gstVerificationAudit.writes.length;
  const snapshot = () => JSON.stringify([employer.rows, company.rows, gstVerificationAudit.rows]);
  return { employer, company, gstVerificationAudit, db, writeCount, snapshot };
}

const allValues = (t: { rows: Row[] }) => t.rows.flatMap((r) => Object.values(r)).filter(Boolean) as string[];

async function refused(run: Promise<unknown>, pattern: RegExp): Promise<string> {
  let message = '';
  await assert.rejects(run, (err) => {
    assert.ok(err instanceof BackfillRefusedError, `expected a refusal, got ${String(err)}`);
    message = err.message;
    assert.match(message, pattern);
    return true;
  });
  return message;
}

describe('runBusinessIdBackfill: read-only modes', () => {
  it('dry run counts the mixed state and writes nothing', async () => {
    const f = fixture();
    const report = await runBusinessIdBackfill(f.db, RING, { mode: 'dry-run', batchSize: 1 });
    assert.equal(report['employers.gst_number'].plaintext, 1);
    assert.equal(report['employers.gst_number'].current, 1);
    assert.equal(report['employers.pan_number'].plaintext, 2);
    assert.equal(report['employers.cin'].plaintext, 1);
    assert.equal(report['employers.cin'].empty, 2, 'whitespace-only CIN counts as empty');
    assert.equal(report['companies.gstin'].missingHash, 1);
    assert.equal(report['companies.gstin'].hashMismatch, 0);
    assert.equal(report['gst_verification_audits.gstin'].plaintext, 2);
    assert.equal(f.writeCount(), 0);
    assert.equal(backfillComplete(report), false);
  });

  it('a decryptable dataset dry-runs with a matching fingerprint; a mismatched one is refused', async () => {
    const f = fixture();
    const ok = await runBusinessIdBackfill(f.db, RING, {
      mode: 'dry-run',
      expectedKeyFingerprint: piiKeyringFingerprint(RING),
    });
    assert.equal(Object.values(ok).reduce((n, c) => n + c.undecryptable, 0), 0);
    await refused(
      runBusinessIdBackfill(f.db, RING, { mode: 'verify', expectedKeyFingerprint: piiKeyringFingerprint(WRONG_KEY) }),
      /do not match --expect-key-fingerprint/,
    );
    assert.equal(f.writeCount(), 0);
  });

  it('verify fails while plaintext, unreadable values or mismatched hashes remain', async () => {
    const f = fixture();
    await runBusinessIdBackfill(f.db, RING, apply(RING));
    assert.ok(backfillComplete(await runBusinessIdBackfill(f.db, RING, { mode: 'verify' })));

    const writes = f.writeCount();
    assert.equal(backfillComplete(await runBusinessIdBackfill(f.db, WRONG_KEY, { mode: 'verify' })), false);
    assert.equal(backfillComplete(await runBusinessIdBackfill(f.db, WRONG_LOOKUP, { mode: 'verify' })), false);
    f.employer.rows[0].cin = CIN;
    assert.equal(backfillComplete(await runBusinessIdBackfill(f.db, RING, { mode: 'verify' })), false);
    assert.equal(f.writeCount(), writes, 'verify never writes');
  });
});

describe('runBusinessIdBackfill: apply', () => {
  it('encrypts plaintext (normalised), fills the blind index, and a re-run changes nothing', async () => {
    const f = fixture();
    const before = f.employer.rows[1].gstNumber;
    const report = await runBusinessIdBackfill(f.db, RING, apply(RING, { batchSize: 2 }));
    assert.equal(report['employers.pan_number'].updated, 2);
    assert.equal(f.employer.rows[1].gstNumber, before, 'already-encrypted values are not rewritten');

    for (const value of [...allValues(f.employer), ...allValues(f.company), ...allValues(f.gstVerificationAudit)]) {
      for (const plain of [GST_A, GST_B, PAN, CIN]) assert.ok(!value.includes(plain));
    }
    assert.equal(decryptPii(RING, 'employers.pan_number', f.employer.rows[1].panNumber!), PAN);
    assert.equal(decryptPii(RING, 'employers.cin', f.employer.rows[0].cin!), CIN);
    assert.equal(f.employer.rows[2].cin, '  ');
    assert.equal(f.company.rows[0].gstinHash, piiLookupHash(RING, 'gstin', GST_A));
    assert.ok(isPiiCiphertext(f.gstVerificationAudit.rows[1].gstin!));

    assert.ok(backfillComplete(await runBusinessIdBackfill(f.db, RING, { mode: 'verify' })));
    const writes = f.writeCount();
    await runBusinessIdBackfill(f.db, RING, apply(RING));
    assert.equal(f.writeCount(), writes);
  });

  it('refuses before the first write when any stored value cannot be decrypted', async () => {
    const f = fixture();
    // The unreadable value sits in the last table, after rows the old loop would already have rewritten.
    f.gstVerificationAudit.rows[1].gstin = encryptPii(WRONG_KEY, 'gst_verification_audits.gstin', GST_B);
    const before = f.snapshot();
    await refused(runBusinessIdBackfill(f.db, RING, apply(RING)), /1 stored value\(s\) cannot be decrypted/);
    assert.equal(f.writeCount(), 0);
    assert.equal(f.snapshot(), before);
  });

  it('wrong encryption key: refused before any write, even if the operator passes that key set\'s own fingerprint', async () => {
    const f = fixture();
    const before = f.snapshot();
    await refused(runBusinessIdBackfill(f.db, WRONG_KEY, apply(RING)), /do not match --expect-key-fingerprint/);
    await refused(runBusinessIdBackfill(f.db, WRONG_KEY, apply(WRONG_KEY)), /cannot be decrypted/);
    assert.equal(f.writeCount(), 0);
    assert.equal(f.snapshot(), before);
  });

  it('wrong lookup key: mismatched blind indexes are refused, never rewritten', async () => {
    const f = fixture();
    const before = f.snapshot();
    const dry = await runBusinessIdBackfill(f.db, WRONG_LOOKUP, { mode: 'dry-run' });
    assert.equal(dry['companies.gstin'].hashMismatch, 1);
    await refused(runBusinessIdBackfill(f.db, WRONG_LOOKUP, apply(WRONG_LOOKUP)), /do not match the configured PII_LOOKUP_KEY/);
    assert.equal(f.writeCount(), 0);
    assert.equal(f.snapshot(), before);
  });

  it('a value that turns unreadable after the preflight stops the run instead of being skipped', async () => {
    const f = fixture();
    const original = f.employer.updateMany.bind(f.employer);
    f.employer.updateMany = async (args) => {
      f.gstVerificationAudit.rows[0].gstin = encryptPii(WRONG_KEY, 'gst_verification_audits.gstin', GST_A);
      return original(args);
    };
    const unreadable = () => f.gstVerificationAudit.rows[0].gstin;
    await refused(runBusinessIdBackfill(f.db, RING, apply(RING)), /became unreadable after the preflight/);
    assert.equal(f.gstVerificationAudit.writes.length, 0, 'nothing in the affected table was written');
    assert.ok(isPiiCiphertext(unreadable()));
  });

  it('needs the database name confirmed against the live connection and the expected fingerprint', async () => {
    const f = fixture();
    await refused(runBusinessIdBackfill(f.db, RING, apply(RING, { confirmDatabase: undefined })), /--database=/);
    await refused(runBusinessIdBackfill(f.db, RING, apply(RING, { confirmDatabase: 'careerbridge_prod' })), /--database=/);
    await refused(
      runBusinessIdBackfill(f.db, RING, apply(RING, { expectedKeyFingerprint: undefined })),
      /--expect-key-fingerprint/,
    );
    assert.equal(f.writeCount(), 0);
  });

  it('skips a row that changed between read and write instead of overwriting it', async () => {
    const f = fixture();
    const original = f.employer.updateMany.bind(f.employer);
    f.employer.updateMany = async (args) => {
      if (args.where.id === 'e1') f.employer.rows[0].panNumber = encryptPii(RING, 'employers.pan_number', 'ABCPE1234F');
      return original(args);
    };
    const report = await runBusinessIdBackfill(f.db, RING, apply(RING));
    assert.equal(report['employers.pan_number'].raced, 1);
    assert.equal(decryptPii(RING, 'employers.pan_number', f.employer.rows[0].panNumber!), 'ABCPE1234F');
  });

  it('reports a duplicate GSTIN blind index as a conflict, keeps going, and never merges', async () => {
    const f = fixture();
    f.company.rows.push({ id: 'c3', gstin: GST_B.toLowerCase(), gstinHash: null });
    const report = await runBusinessIdBackfill(f.db, RING, apply(RING));
    assert.equal(report['companies.gstin'].conflicts, 1);
    assert.equal(report['companies.gstin'].updated, 1);
    assert.equal(f.company.rows[2].gstin, GST_B.toLowerCase(), 'the conflicting row is left for a manual merge');
    assert.equal(backfillComplete(await runBusinessIdBackfill(f.db, RING, { mode: 'verify' })), false);
  });
});

describe('runBusinessIdBackfill: rotation', () => {
  it('re-encrypts older-key ciphertext only on apply with rotate', async () => {
    const f = fixture();
    await runBusinessIdBackfill(f.db, RING, apply(RING));
    const before = f.snapshot();

    for (const mode of ['dry-run', 'verify'] as const) {
      await runBusinessIdBackfill(f.db, ROTATED, { mode, rotate: true });
    }
    assert.equal(f.snapshot(), before, 'rotate never writes outside apply');

    const plainRun = await runBusinessIdBackfill(f.db, ROTATED, apply(ROTATED));
    assert.ok(plainRun['employers.gst_number'].staleKey > 0);
    assert.equal(piiCiphertextKeyId(f.employer.rows[0].gstNumber!), 'k1', 'without rotate old ciphertext stays');
    assert.ok(backfillComplete(plainRun));
    assert.equal(backfillComplete(plainRun, { requireActiveKey: true }), false);

    await refused(
      runBusinessIdBackfill(f.db, ROTATED, apply(RING, { rotate: true })),
      /do not match --expect-key-fingerprint/,
    );
    assert.equal(piiCiphertextKeyId(f.employer.rows[0].gstNumber!), 'k1');

    await runBusinessIdBackfill(f.db, ROTATED, apply(ROTATED, { rotate: true }));
    assert.equal(piiCiphertextKeyId(f.employer.rows[0].gstNumber!), 'k2');
    assert.equal(decryptPii(ROTATED, 'employers.gst_number', f.employer.rows[0].gstNumber!), GST_A);
    assert.equal(f.company.rows[0].gstinHash, piiLookupHash(RING, 'gstin', GST_A), 'blind index survives rotation');
    assert.ok(backfillComplete(await runBusinessIdBackfill(f.db, ROTATED, { mode: 'verify' }), { requireActiveKey: true }));
  });
});

describe('runBusinessIdBackfill: output', () => {
  it('reports and refusals carry counts only: no identifiers, ciphertext or key material', async () => {
    const forbidden = [GST_A, GST_B, PAN, CIN, GST_B.toLowerCase(), 'pii:v1', key(1), key(2), key(7), key(8), key(9)];
    const outputs: string[] = [];

    const f = fixture();
    outputs.push(JSON.stringify(await runBusinessIdBackfill(f.db, RING, { mode: 'dry-run' })));
    outputs.push(JSON.stringify(await runBusinessIdBackfill(f.db, RING, apply(RING))));
    outputs.push(JSON.stringify(await runBusinessIdBackfill(f.db, WRONG_LOOKUP, { mode: 'verify' })));
    outputs.push(await refused(runBusinessIdBackfill(f.db, WRONG_KEY, apply(WRONG_KEY)), /cannot be decrypted/));
    outputs.push(await refused(runBusinessIdBackfill(f.db, WRONG_LOOKUP, apply(WRONG_LOOKUP)), /PII_LOOKUP_KEY/));
    outputs.push(await refused(runBusinessIdBackfill(f.db, RING, apply(WRONG_KEY)), /fingerprint/));

    for (const output of outputs) {
      for (const value of forbidden) assert.ok(!output.includes(value), 'output leaks a sensitive value');
    }
  });
});
