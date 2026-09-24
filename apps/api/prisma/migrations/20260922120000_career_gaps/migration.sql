-- Career gaps between employment/internship activities (idempotent sync from timeline analysis).
CREATE TYPE "CareerGapStatus" AS ENUM ('UNEXPLAINED', 'EXPLAINED');
CREATE TYPE "CareerGapReason" AS ENUM (
  'JOB_SEARCH',
  'HIGHER_EDUCATION',
  'CERTIFICATION_TRAINING',
  'FREELANCING',
  'BUSINESS',
  'RELOCATION',
  'PERSONAL_FAMILY',
  'HEALTH_BREAK',
  'OTHER'
);

CREATE TABLE "career_gaps" (
  "id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "previous_activity_id" TEXT,
  "next_activity_id" TEXT,
  "gap_start_date" DATE NOT NULL,
  "gap_end_date" DATE NOT NULL,
  "gap_days" INTEGER NOT NULL,
  "reason" "CareerGapReason",
  "reason_details" TEXT,
  "status" "CareerGapStatus" NOT NULL DEFAULT 'UNEXPLAINED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "career_gaps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "career_gaps_candidate_id_gap_start_date_gap_end_date_key"
  ON "career_gaps"("candidate_id", "gap_start_date", "gap_end_date");
CREATE INDEX "career_gaps_candidate_id_status_idx" ON "career_gaps"("candidate_id", "status");

ALTER TABLE "career_gaps"
  ADD CONSTRAINT "career_gaps_candidate_id_fkey"
  FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
