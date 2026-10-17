-- Employer interview scheduling (friend employer portal)
DO $$ BEGIN
  CREATE TYPE "EmployerInterviewStatus" AS ENUM (
    'PROPOSED',
    'SCHEDULED',
    'CONFIRMED',
    'RESCHEDULE_REQUESTED',
    'COMPLETED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "employer_interviews" (
  "id" TEXT NOT NULL,
  "employer_id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "job_id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "scheduled_at" TIMESTAMP(3) NOT NULL,
  "duration_min" INTEGER NOT NULL DEFAULT 30,
  "mode" TEXT NOT NULL DEFAULT 'VIDEO',
  "location" TEXT,
  "status" "EmployerInterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
  "notes" TEXT,
  "confirmed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "employer_interviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "employer_interviews_employer_id_scheduled_at_idx"
  ON "employer_interviews"("employer_id", "scheduled_at");
CREATE INDEX IF NOT EXISTS "employer_interviews_application_id_idx"
  ON "employer_interviews"("application_id");
CREATE INDEX IF NOT EXISTS "employer_interviews_job_id_idx"
  ON "employer_interviews"("job_id");

ALTER TABLE "employer_interviews" DROP CONSTRAINT IF EXISTS "employer_interviews_employer_id_fkey";
ALTER TABLE "employer_interviews"
  ADD CONSTRAINT "employer_interviews_employer_id_fkey"
  FOREIGN KEY ("employer_id") REFERENCES "employers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employer_interviews" DROP CONSTRAINT IF EXISTS "employer_interviews_application_id_fkey";
ALTER TABLE "employer_interviews"
  ADD CONSTRAINT "employer_interviews_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employer_interviews" DROP CONSTRAINT IF EXISTS "employer_interviews_job_id_fkey";
ALTER TABLE "employer_interviews"
  ADD CONSTRAINT "employer_interviews_job_id_fkey"
  FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "candidates"
  ADD COLUMN IF NOT EXISTS "state" TEXT,
  ADD COLUMN IF NOT EXISTS "preferred_work_city" TEXT;
