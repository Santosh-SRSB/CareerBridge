-- Career Passport fields on the live Nest/Postgres schema
ALTER TABLE "candidates"
  ADD COLUMN IF NOT EXISTS "still_in_college" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "education_start" TEXT,
  ADD COLUMN IF NOT EXISTS "education_end" TEXT,
  ADD COLUMN IF NOT EXISTS "experience_level" TEXT,
  ADD COLUMN IF NOT EXISTS "total_experience_years" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total_experience_months" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "gap_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "about" TEXT,
  ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'manual';

ALTER TABLE "candidate_education"
  ADD COLUMN IF NOT EXISTS "start_date" TEXT,
  ADD COLUMN IF NOT EXISTS "end_date" TEXT;

ALTER TABLE "candidate_experiences"
  ADD COLUMN IF NOT EXISTS "still_in_company" BOOLEAN NOT NULL DEFAULT false;
