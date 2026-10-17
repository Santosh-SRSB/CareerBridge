-- Additive only: new enum values, nullable columns and a new table. No data is rewritten or removed.
ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW' AFTER 'DRAFT';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'ON_HOLD' AFTER 'INTERVIEW';

ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "company_size" TEXT;
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "about" TEXT;
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "linkedin_url" TEXT;

CREATE TABLE IF NOT EXISTS "employer_candidate_views" (
    "id" TEXT NOT NULL,
    "employer_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "job_id" TEXT,
    "period" TEXT NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employer_candidate_views_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "employer_candidate_views_employer_id_candidate_id_period_key"
    ON "employer_candidate_views"("employer_id", "candidate_id", "period");
CREATE INDEX IF NOT EXISTS "employer_candidate_views_employer_id_period_idx"
    ON "employer_candidate_views"("employer_id", "period");

DO $$ BEGIN
    ALTER TABLE "employer_candidate_views" ADD CONSTRAINT "employer_candidate_views_employer_id_fkey"
        FOREIGN KEY ("employer_id") REFERENCES "employers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "employer_candidate_views" ADD CONSTRAINT "employer_candidate_views_candidate_id_fkey"
        FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
