-- Additive only: a company table keyed by GSTIN and a nullable link from each employer (staff) account.
-- employers.gst_number never had a database UNIQUE constraint; uniqueness was an application check that
-- rejected a second account with the same GSTIN. That check is replaced by linking to this table, whose
-- UNIQUE(gstin) keeps one company per GSTIN. No employer row or column is removed or rewritten.

CREATE TABLE IF NOT EXISTS "companies" (
    "id" TEXT NOT NULL,
    "gstin" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "companies_gstin_key" ON "companies"("gstin");

ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "company_id" TEXT;

CREATE INDEX IF NOT EXISTS "employers_company_id_idx" ON "employers"("company_id");

DO $$ BEGIN
    ALTER TABLE "employers" ADD CONSTRAINT "employers_company_id_fkey"
        FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill: one company per distinct GSTIN already saved on employers (stored upper-case by the KYC
-- endpoint; normalised again here). The earliest account's company name becomes the canonical name.
INSERT INTO "companies" ("id", "gstin", "name", "created_at", "updated_at")
SELECT gen_random_uuid()::text, g."gstin", g."name", g."created_at", CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT ON (upper(btrim("gst_number")))
        upper(btrim("gst_number")) AS "gstin",
        "company_name" AS "name",
        "created_at"
    FROM "employers"
    WHERE NULLIF(btrim("gst_number"), '') IS NOT NULL
    ORDER BY upper(btrim("gst_number")), "created_at" ASC, "id" ASC
) g
ON CONFLICT ("gstin") DO NOTHING;

UPDATE "employers" e
SET "company_id" = c."id"
FROM "companies" c
WHERE e."company_id" IS NULL
  AND NULLIF(btrim(e."gst_number"), '') IS NOT NULL
  AND c."gstin" = upper(btrim(e."gst_number"));
