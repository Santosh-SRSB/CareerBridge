/**
 * Encrypts legacy plaintext employer GSTIN / PAN / CIN, company GSTIN and GST audit GSTIN, and fills gstin_hash.
 *
 *   npx ts-node -T scripts/backfill-business-id-encryption.ts                     dry run (default, read-only)
 *   npx ts-node -T scripts/backfill-business-id-encryption.ts --verify            read-only; exit 1 if anything is left
 *   npx ts-node -T scripts/backfill-business-id-encryption.ts --apply --database=<current_database()> \
 *       --expect-key-fingerprint=<kfp1-... from the running API log line "PII keyring loaded">
 *   add --rotate (with --apply) to re-encrypt ciphertext written under a non-active key; keep the old key configured
 *   until --verify passes
 *
 * Needs DATABASE_URL, PII_ENCRYPTION_KEYS, PII_LOOKUP_KEY (and PII_ENCRYPTION_ACTIVE_KEY_ID with more than one key)
 * for the target environment. Take the expected fingerprint from the target API revision's startup log, not from the
 * environment this script runs in: only that comparison shows these keys are the ones the API uses.
 * Take a database backup before --apply. Prints counts only, never identifier values or key material.
 */
import 'dotenv/config';
import { PrismaClient } from '../generated/prisma';
import { loadPiiKeyring, piiKeyringFingerprint } from '../src/common/crypto/pii-crypto';
import {
  BackfillDb,
  BackfillMode,
  BackfillTable,
  backfillComplete,
  runBusinessIdBackfill,
} from '../src/common/crypto/business-id-backfill';

function parseArgs(argv: string[]) {
  const flag = (name: string) => argv.includes(`--${name}`);
  const value = (name: string) => argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const mode: BackfillMode = flag('apply') ? 'apply' : flag('verify') ? 'verify' : 'dry-run';
  const batch = Number(value('batch') || 200);
  return {
    mode,
    rotate: flag('rotate'),
    database: value('database'),
    expectedKeyFingerprint: value('expect-key-fingerprint'),
    batchSize: Number.isFinite(batch) ? batch : 200,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ring = loadPiiKeyring(process.env);
  if (!ring) throw new Error('PII_ENCRYPTION_KEYS and PII_LOOKUP_KEY are not set for this environment.');
  if (args.rotate && args.mode !== 'apply') console.log('--rotate only takes effect with --apply; this run writes nothing.');

  const prisma = new PrismaClient();
  try {
    const currentDatabase = async () => {
      const [{ db }] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
      return db;
    };
    console.log(
      `database: ${await currentDatabase()}  mode: ${args.mode}${args.rotate ? ' +rotate' : ''}  ` +
        `active key: ${ring.activeKeyId}  key fingerprint: ${piiKeyringFingerprint(ring)}`,
    );

    const db: BackfillDb = {
      employer: prisma.employer as unknown as BackfillTable,
      company: prisma.company as unknown as BackfillTable,
      gstVerificationAudit: prisma.gstVerificationAudit as unknown as BackfillTable,
      currentDatabase,
    };
    const report = await runBusinessIdBackfill(db, ring, {
      mode: args.mode,
      rotate: args.rotate,
      batchSize: args.batchSize,
      confirmDatabase: args.database,
      expectedKeyFingerprint: args.expectedKeyFingerprint,
    });
    console.table(report);

    const complete = backfillComplete(report, { requireActiveKey: args.rotate });
    if (args.mode === 'dry-run') {
      console.log(
        'Dry run: no rows were changed. Apply needs --apply --database=<name> --expect-key-fingerprint=<from API log> after a backup.',
      );
    } else if (args.mode === 'apply') {
      console.log('Apply finished. Run again with --verify to confirm nothing is left.');
    } else {
      console.log(
        complete ? 'Verify: OK, no plaintext, unreadable or mismatched values remain.' : 'Verify: FAILED, see counts above.',
      );
      if (!complete) process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  // Only the message: Prisma errors can echo query parameters.
  const message = err instanceof Error ? err.message.split('\n')[0] : 'unknown error';
  console.error(`backfill failed: ${message}`);
  process.exitCode = 1;
});
