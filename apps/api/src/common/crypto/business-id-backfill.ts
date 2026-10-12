/**
 * Encrypts legacy plaintext GSTIN / PAN / CIN values in place and fills the GSTIN blind index.
 * Safe to re-run: rows already holding ciphertext under the active key are left alone, and every write is
 * conditional on the row still holding the value that was read, so a concurrent KYC save is never overwritten.
 *
 * Apply refuses to write unless the target database name is confirmed, the keyring fingerprint matches the one the
 * running API logged at startup, and a full read-only preflight finds every stored ciphertext readable and every
 * stored blind index consistent with these keys. Plaintext alone cannot reveal a wrong key, hence the fingerprint.
 * Reports counts only; identifier values never leave this module.
 */
import { normalizeBusinessIdentifier } from '@careerbridge/shared';
import {
  PiiField,
  PiiKeyring,
  decryptPii,
  encryptPii,
  isPiiCiphertext,
  piiCiphertextKeyId,
  piiKeyringFingerprint,
  piiLookupHash,
} from './pii-crypto';

export type BackfillMode = 'dry-run' | 'apply' | 'verify';

export type BackfillOptions = {
  mode: BackfillMode;
  /** Also re-encrypt ciphertext written under a non-active key (apply only). */
  rotate?: boolean;
  batchSize?: number;
  /** Required for apply: must equal the database the connection actually points at. */
  confirmDatabase?: string;
  /** Required for apply; checked in every mode when given. */
  expectedKeyFingerprint?: string;
};

export type ColumnCounts = {
  scanned: number;
  empty: number;
  plaintext: number;
  /** Ciphertext under the active key. */
  current: number;
  /** Ciphertext under an older key that is still configured. */
  staleKey: number;
  /** Ciphertext that fails authentication or uses a key that is no longer configured. */
  undecryptable: number;
  /** Rows with a value but no GSTIN blind index yet. */
  missingHash: number;
  /** Rows whose stored GSTIN blind index differs from the one these keys produce (wrong PII_LOOKUP_KEY or bad data). */
  hashMismatch: number;
  updated: number;
  /** The row changed between read and write; a re-run picks it up. */
  raced: number;
  /** Another row already owns the same GSTIN blind index; needs a manual merge. */
  conflicts: number;
};

export type BackfillReport = Record<PiiField, ColumnCounts>;

type Row = Record<string, string | null> & { id: string };

export type BackfillTable = {
  findMany(args: {
    where?: { id: { gt: string } };
    orderBy: { id: 'asc' };
    take: number;
    select: Record<string, true>;
  }): Promise<Row[]>;
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
};

export type BackfillDb = {
  employer: BackfillTable;
  company: BackfillTable;
  gstVerificationAudit: BackfillTable;
  currentDatabase(): Promise<string>;
};

/** Messages carry counts and flag names only. */
export class BackfillRefusedError extends Error {}

type ColumnSpec = { field: PiiField; column: string; hashColumn?: string };
type TableName = Exclude<keyof BackfillDb, 'currentDatabase'>;

const TABLES: Array<{ table: TableName; columns: ColumnSpec[] }> = [
  {
    table: 'employer',
    columns: [
      { field: 'employers.gst_number', column: 'gstNumber' },
      { field: 'employers.pan_number', column: 'panNumber' },
      { field: 'employers.cin', column: 'cin' },
    ],
  },
  { table: 'company', columns: [{ field: 'companies.gstin', column: 'gstin', hashColumn: 'gstinHash' }] },
  {
    table: 'gstVerificationAudit',
    columns: [{ field: 'gst_verification_audits.gstin', column: 'gstin', hashColumn: 'gstinHash' }],
  },
];

const emptyCounts = (): ColumnCounts => ({
  scanned: 0,
  empty: 0,
  plaintext: 0,
  current: 0,
  staleKey: 0,
  undecryptable: 0,
  missingHash: 0,
  hashMismatch: 0,
  updated: 0,
  raced: 0,
  conflicts: 0,
});

function isUniqueViolation(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as { code?: unknown }).code === 'P2002');
}

const total = (report: BackfillReport, key: keyof ColumnCounts) =>
  Object.values(report).reduce((sum, counts) => sum + counts[key], 0);

export async function runBusinessIdBackfill(
  db: BackfillDb,
  ring: PiiKeyring,
  options: BackfillOptions,
): Promise<BackfillReport> {
  const fingerprint = piiKeyringFingerprint(ring);
  if (options.expectedKeyFingerprint !== undefined && options.expectedKeyFingerprint !== fingerprint) {
    throw new BackfillRefusedError(
      'The configured PII keys do not match --expect-key-fingerprint. No rows were changed.',
    );
  }
  if (options.mode !== 'apply') return scan(db, ring, options, false);

  if (!options.expectedKeyFingerprint) {
    throw new BackfillRefusedError(
      '--apply needs --expect-key-fingerprint (from the running API startup log). No rows were changed.',
    );
  }
  const database = await db.currentDatabase();
  if (!options.confirmDatabase || options.confirmDatabase !== database) {
    throw new BackfillRefusedError('--apply needs --database=<current database> to confirm the target. No rows were changed.');
  }

  const preflight = await scan(db, ring, options, false);
  const undecryptable = total(preflight, 'undecryptable');
  if (undecryptable) {
    throw new BackfillRefusedError(
      `${undecryptable} stored value(s) cannot be decrypted with the configured keys. No rows were changed.`,
    );
  }
  const hashMismatch = total(preflight, 'hashMismatch');
  if (hashMismatch) {
    throw new BackfillRefusedError(
      `${hashMismatch} GSTIN lookup hash(es) do not match the configured PII_LOOKUP_KEY. No rows were changed.`,
    );
  }
  return scan(db, ring, options, true);
}

async function scan(db: BackfillDb, ring: PiiKeyring, options: BackfillOptions, write: boolean): Promise<BackfillReport> {
  const batchSize = Math.max(1, Math.min(options.batchSize ?? 200, 1000));
  const rotate = write && Boolean(options.rotate);
  const report = {} as BackfillReport;

  for (const { table, columns } of TABLES) {
    for (const spec of columns) report[spec.field] = emptyCounts();
    const select: Record<string, true> = { id: true };
    for (const spec of columns) {
      select[spec.column] = true;
      if (spec.hashColumn) select[spec.hashColumn] = true;
    }

    let lastId: string | undefined;
    for (;;) {
      const rows = await db[table].findMany({
        ...(lastId ? { where: { id: { gt: lastId } } } : {}),
        orderBy: { id: 'asc' },
        take: batchSize,
        select,
      });
      if (!rows.length) break;
      lastId = rows[rows.length - 1].id;

      for (const row of rows) {
        const where: Record<string, unknown> = { id: row.id };
        const data: Record<string, unknown> = {};
        const touched: ColumnSpec[] = [];

        for (const spec of columns) {
          const counts = report[spec.field];
          counts.scanned += 1;
          const stored = row[spec.column];
          if (!stored || !normalizeBusinessIdentifier(stored)) {
            counts.empty += 1;
            continue;
          }

          let plain: string;
          let needsWrite = false;
          if (isPiiCiphertext(stored)) {
            try {
              plain = decryptPii(ring, spec.field, stored);
            } catch {
              counts.undecryptable += 1;
              if (write) {
                throw new BackfillRefusedError(
                  'A stored value became unreadable after the preflight; stopped before writing it. Run --verify.',
                );
              }
              continue;
            }
            if (piiCiphertextKeyId(stored) === ring.activeKeyId) {
              counts.current += 1;
            } else {
              counts.staleKey += 1;
              needsWrite = rotate;
            }
          } else {
            counts.plaintext += 1;
            plain = stored;
            needsWrite = true;
          }

          const normalized = normalizeBusinessIdentifier(plain);
          let hash: string | undefined;
          if (spec.hashColumn) {
            hash = piiLookupHash(ring, 'gstin', normalized);
            const storedHash = row[spec.hashColumn];
            if (!storedHash) {
              counts.missingHash += 1;
              needsWrite = true;
            } else if (storedHash !== hash) {
              counts.hashMismatch += 1;
              if (write) {
                throw new BackfillRefusedError(
                  'A GSTIN lookup hash stopped matching after the preflight; stopped before writing it. Run --verify.',
                );
              }
              continue;
            }
          }
          if (!needsWrite || !write) continue;

          where[spec.column] = stored;
          if (spec.hashColumn) where[spec.hashColumn] = row[spec.hashColumn];
          const reencrypt = !isPiiCiphertext(stored) || (rotate && piiCiphertextKeyId(stored) !== ring.activeKeyId);
          data[spec.column] = reencrypt ? encryptPii(ring, spec.field, normalized) : stored;
          if (spec.hashColumn) data[spec.hashColumn] = hash;
          touched.push(spec);
        }

        if (!touched.length) continue;
        try {
          const { count } = await db[table].updateMany({ where, data });
          for (const spec of touched) report[spec.field][count ? 'updated' : 'raced'] += 1;
        } catch (err) {
          if (!isUniqueViolation(err)) throw err;
          for (const spec of touched) report[spec.field].conflicts += 1;
        }
      }
    }
  }
  return report;
}

/**
 * True when nothing is left to migrate: no plaintext, no unreadable ciphertext, no missing or mismatched blind
 * index, no unresolved conflict. With requireActiveKey, ciphertext under an older key also counts as unfinished.
 */
export function backfillComplete(report: BackfillReport, opts: { requireActiveKey?: boolean } = {}): boolean {
  return Object.values(report).every(
    (c) =>
      c.plaintext === 0 &&
      c.undecryptable === 0 &&
      c.missingHash === 0 &&
      c.hashMismatch === 0 &&
      c.conflicts === 0 &&
      (!opts.requireActiveKey || c.staleKey === 0),
  );
}
