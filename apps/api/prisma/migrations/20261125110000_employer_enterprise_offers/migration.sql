-- Guide §12 Enterprise offers + purchase snapshot columns (DEV).
CREATE TABLE IF NOT EXISTS "employer_enterprise_offers" (
  "id" TEXT NOT NULL,
  "employer_id" TEXT NOT NULL,
  "amount_paise" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "duration_days" INTEGER NOT NULL,
  "active_job_limit" INTEGER NOT NULL,
  "login_seats" INTEGER NOT NULL,
  "candidate_view_credits" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'APPROVED',
  "approved_by_user_id" TEXT,
  "approved_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employer_enterprise_offers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "employer_enterprise_offers_employer_id_status_idx"
  ON "employer_enterprise_offers"("employer_id", "status");

DO $$ BEGIN
  ALTER TABLE "employer_enterprise_offers"
    ADD CONSTRAINT "employer_enterprise_offers_employer_id_fkey"
    FOREIGN KEY ("employer_id") REFERENCES "employers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "employer_payments"
  ADD COLUMN IF NOT EXISTS "enterprise_offer_id" TEXT;

CREATE INDEX IF NOT EXISTS "employer_payments_enterprise_offer_id_idx"
  ON "employer_payments"("enterprise_offer_id");

ALTER TABLE "employer_subscriptions"
  ADD COLUMN IF NOT EXISTS "entitlements_json" TEXT;
