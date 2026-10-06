-- Additive only: nullable/defaulted columns and a new table. No data is rewritten or removed.

-- Candidate-facing interview notes, kept separate from the employer's private notes.
ALTER TABLE "employer_interviews" ADD COLUMN IF NOT EXISTS "candidate_notes" TEXT;

-- Private hiring-team note on an application (never shown to the candidate).
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "employer_note" TEXT;

-- Job-detail view counter for employer per-job performance.
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "view_count" INTEGER NOT NULL DEFAULT 0;

-- Employer's private per-job shortlist of matched candidates who have not applied.
CREATE TABLE IF NOT EXISTS "employer_talent_shortlists" (
    "id" TEXT NOT NULL,
    "employer_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employer_talent_shortlists_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "employer_talent_shortlists_employer_id_candidate_id_job_id_key"
    ON "employer_talent_shortlists"("employer_id", "candidate_id", "job_id");
CREATE INDEX IF NOT EXISTS "employer_talent_shortlists_employer_id_job_id_idx"
    ON "employer_talent_shortlists"("employer_id", "job_id");

DO $$ BEGIN
    ALTER TABLE "employer_talent_shortlists" ADD CONSTRAINT "employer_talent_shortlists_employer_id_fkey"
        FOREIGN KEY ("employer_id") REFERENCES "employers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "employer_talent_shortlists" ADD CONSTRAINT "employer_talent_shortlists_candidate_id_fkey"
        FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "employer_talent_shortlists" ADD CONSTRAINT "employer_talent_shortlists_job_id_fkey"
        FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
