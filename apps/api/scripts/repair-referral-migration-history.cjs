/**
 * Idempotent Prisma history repair for DEV → main sync.
 *
 * Old DEV branch applied referral as `20261103190000_referral_earn`.
 * main ships `20261103180000_referral_earn` (same additive tables).
 * Also DEV may have `20261103180000_kaizentrix_training_commission` in history
 * while main no longer ships that folder — orphan rows block `migrate deploy`.
 *
 * Safe on PROD: if `20261103180000_referral_earn` is already applied, this is a no-op.
 * Never drops tables. Only rewrites `_prisma_migrations` rows when needed.
 */
'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const { PrismaClient } = require('../generated/prisma');

const MAIN_REFERRAL = '20261103180000_referral_earn';
const OLD_DEV_REFERRAL = '20261103190000_referral_earn';
const ORPHAN_PREFIXES = [
  OLD_DEV_REFERRAL,
  '20261103180000_kaizentrix_training_commission',
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('repair-referral-migration-history: DATABASE_URL missing; skip');
    return;
  }

  const prisma = new PrismaClient();
  try {
    const applied = await prisma.$queryRaw`
      SELECT migration_name
      FROM "_prisma_migrations"
      WHERE rolled_back_at IS NULL
    `;
    const names = new Set(applied.map((r) => r.migration_name));

    if (names.has(MAIN_REFERRAL) && !names.has(OLD_DEV_REFERRAL)) {
      console.log('repair-referral-migration-history: already aligned; nothing to do');
      return;
    }

    const tables = await prisma.$queryRaw`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('referral_campaigns', 'candidate_referral_codes')
    `;
    const hasReferralTables = tables.length > 0;

    for (const orphan of ORPHAN_PREFIXES) {
      if (!names.has(orphan)) continue;
      // Keep data; only remove history row that is absent from this image's migrations folder.
      console.log(`repair-referral-migration-history: removing orphan history row ${orphan}`);
      await prisma.$executeRaw`
        DELETE FROM "_prisma_migrations"
        WHERE migration_name = ${orphan}
      `;
      names.delete(orphan);
    }

    if (hasReferralTables && !names.has(MAIN_REFERRAL)) {
      console.log(
        `repair-referral-migration-history: marking ${MAIN_REFERRAL} applied (tables already exist)`,
      );
      execFileSync(
        process.platform === 'win32' ? 'npx.cmd' : 'npx',
        ['--yes', 'prisma@6', 'migrate', 'resolve', '--applied', MAIN_REFERRAL, '--schema=./prisma/schema.prisma'],
        {
          stdio: 'inherit',
          cwd: path.join(__dirname, '..'),
          env: process.env,
        },
      );
    } else {
      console.log('repair-referral-migration-history: no resolve needed');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('repair-referral-migration-history failed:', err);
  process.exit(1);
});
