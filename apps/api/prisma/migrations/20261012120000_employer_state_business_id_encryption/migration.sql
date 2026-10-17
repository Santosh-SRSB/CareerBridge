-- Additive only. No existing row or value is rewritten here.
--
-- 1. employers.state: business location state captured at employer registration (employers.city already exists).
-- 2. companies.gstin_hash / gst_verification_audits.gstin_hash: HMAC blind indexes so GSTINs can be looked up
--    once the gstin columns hold ciphertext. Encrypting existing plaintext values needs the application keys, so it
--    is done by apps/api/scripts/backfill-business-id-encryption.ts (dry run by default), not by SQL.
--
-- Rollback (only before any encrypted row exists, i.e. before the backfill or new KYC saves):
--   DROP INDEX IF EXISTS "gst_verification_audits_gstin_hash_idx";
--   DROP INDEX IF EXISTS "companies_gstin_hash_key";
--   ALTER TABLE "gst_verification_audits" DROP COLUMN IF EXISTS "gstin_hash";
--   ALTER TABLE "companies" DROP COLUMN IF EXISTS "gstin_hash";
--   ALTER TABLE "employers" DROP COLUMN IF EXISTS "state";
-- After encrypted rows exist, roll back the application code only; these columns are then required to find companies.

ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "state" TEXT;

ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "gstin_hash" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "companies_gstin_hash_key" ON "companies"("gstin_hash");

ALTER TABLE "gst_verification_audits" ADD COLUMN IF NOT EXISTS "gstin_hash" TEXT;
CREATE INDEX IF NOT EXISTS "gst_verification_audits_gstin_hash_idx" ON "gst_verification_audits"("gstin_hash");
