/**
 * Idempotent Prisma history repair when DEV DB history diverged from main's migration folders.
 *
 * - Removes orphan `_prisma_migrations` rows whose folders are not in this image
 * - If referral tables already exist but `20261103180000_referral_earn` is not marked applied,
 *   marks it applied (does not re-run DDL)
 *
 * Safe on PROD: when history already matches the image, this is a no-op.
 * Never drops tables / never touches data rows.
 */
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('../generated/prisma');

const MAIN_REFERRAL = '20261103180000_referral_earn';
const apiRoot = path.join(__dirname, '..');
const migrationsDir = path.join(apiRoot, 'prisma', 'migrations');

function localMigrationNames() {
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function runPrisma(args) {
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', 'prisma@6', ...args], {
    stdio: 'inherit',
    cwd: apiRoot,
    env: process.env,
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('repair-referral-migration-history: DATABASE_URL missing; skip');
    return;
  }

  const local = new Set(localMigrationNames());
  console.log(
    `repair-referral-migration-history: local migrations=${[...local].sort().join(',')}`,
  );

  const prisma = new PrismaClient();
  try {
    const appliedRows = await prisma.$queryRaw`
      SELECT migration_name
      FROM "_prisma_migrations"
      WHERE rolled_back_at IS NULL
    `;
    const applied = appliedRows.map((r) => r.migration_name);
    console.log(`repair-referral-migration-history: applied=${applied.join(',') || '(none)'}`);

    const orphans = applied.filter((name) => !local.has(name));
    for (const orphan of orphans) {
      console.log(`repair-referral-migration-history: deleting orphan history row ${orphan}`);
      await prisma.$executeRaw`
        DELETE FROM "_prisma_migrations"
        WHERE migration_name = ${orphan}
      `;
    }

    const stillApplied = await prisma.$queryRaw`
      SELECT migration_name
      FROM "_prisma_migrations"
      WHERE rolled_back_at IS NULL
    `;
    const names = new Set(stillApplied.map((r) => r.migration_name));

    const tables = await prisma.$queryRaw`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('referral_campaigns', 'candidate_referral_codes')
    `;
    const hasReferralTables = tables.length > 0;

    if (hasReferralTables && local.has(MAIN_REFERRAL) && !names.has(MAIN_REFERRAL)) {
      console.log(
        `repair-referral-migration-history: marking ${MAIN_REFERRAL} applied (tables already exist)`,
      );
      await prisma.$disconnect();
      runPrisma(['migrate', 'resolve', '--applied', MAIN_REFERRAL, '--schema=./prisma/schema.prisma']);
      return;
    }

    console.log('repair-referral-migration-history: history aligned for migrate deploy');
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error('repair-referral-migration-history failed:', err);
  process.exit(1);
});
