/**
 * Idempotent Prisma history + referral schema repair for DEV↔main sync.
 *
 * 1) Deletes orphan `_prisma_migrations` rows not present in this image
 * 2) Marks `20261103180000_referral_earn` applied when referral tables already exist
 * 3) Ensures `experienced_points_per_batch` exists (IF NOT EXISTS) and marks
 *    `20261104120000_referral_experienced_points` applied when needed
 *
 * Never drops tables. Safe no-op when already aligned (including PROD).
 */
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('../generated/prisma');

const MAIN_REFERRAL = '20261103180000_referral_earn';
const EXPERIENCED_POINTS = '20261104120000_referral_experienced_points';
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

async function appliedNames(prisma) {
  const rows = await prisma.$queryRaw`
    SELECT migration_name
    FROM "_prisma_migrations"
    WHERE rolled_back_at IS NULL
  `;
  return new Set(rows.map((r) => r.migration_name));
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('repair: DATABASE_URL missing; skip');
    return;
  }

  const local = new Set(localMigrationNames());
  console.log(`repair: local=${[...local].sort().join(',')}`);

  const prisma = new PrismaClient();
  try {
    let names = await appliedNames(prisma);
    console.log(`repair: applied=${[...names].join(',') || '(none)'}`);

    for (const orphan of [...names].filter((n) => !local.has(n))) {
      console.log(`repair: delete orphan history ${orphan}`);
      await prisma.$executeRaw`
        DELETE FROM "_prisma_migrations"
        WHERE migration_name = ${orphan}
      `;
    }
    names = await appliedNames(prisma);

    const tables = await prisma.$queryRaw`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('referral_campaigns', 'candidate_referral_codes')
    `;
    const hasReferralTables = tables.length > 0;

    // Ensure experienced points column before app boot (idempotent).
    if (hasReferralTables) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "referral_campaigns"
        ADD COLUMN IF NOT EXISTS "experienced_points_per_batch" INTEGER NOT NULL DEFAULT 5
      `);
      await prisma.$executeRawUnsafe(`
        UPDATE "referral_campaigns"
        SET "experienced_points_per_batch" = 5,
            "experienced_batch_size" = 1,
            "fresher_batch_size" = 3,
            "points_per_batch" = 10
        WHERE "campaign_status" = 'ACTIVE'
      `);
      console.log('repair: ensured experienced_points_per_batch column');
    }

    const needResolve = [];
    if (hasReferralTables && local.has(MAIN_REFERRAL) && !names.has(MAIN_REFERRAL)) {
      needResolve.push(MAIN_REFERRAL);
    }
    if (hasReferralTables && local.has(EXPERIENCED_POINTS) && !names.has(EXPERIENCED_POINTS)) {
      needResolve.push(EXPERIENCED_POINTS);
    }

    if (needResolve.length === 0) {
      console.log('repair: history already aligned');
      return;
    }

    await prisma.$disconnect();
    for (const migration of needResolve) {
      console.log(`repair: migrate resolve --applied ${migration}`);
      runPrisma(['migrate', 'resolve', '--applied', migration, '--schema=./prisma/schema.prisma']);
    }
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error('repair failed:', err);
  process.exit(1);
});
