-- Kaizentrix internship/training opportunity fields + status history + admin commission records.

DO $$ BEGIN
  CREATE TYPE "OpportunityType" AS ENUM ('JOB', 'INTERNSHIP_TRAINING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ProgrammeFeeType" AS ENUM ('FIXED', 'RANGE', 'FREE', 'DISCUSSED_WITH_EMPLOYER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CommissionInvoiceStatus" AS ENUM ('NOT_READY', 'READY_TO_INVOICE', 'INVOICED', 'PAID', 'DISPUTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "jobs"
  ADD COLUMN IF NOT EXISTS "opportunity_type" "OpportunityType" NOT NULL DEFAULT 'JOB',
  ADD COLUMN IF NOT EXISTS "programme_duration" TEXT,
  ADD COLUMN IF NOT EXISTS "eligibility_criteria" TEXT,
  ADD COLUMN IF NOT EXISTS "application_deadline" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "learning_outcomes" TEXT,
  ADD COLUMN IF NOT EXISTS "selection_process" TEXT,
  ADD COLUMN IF NOT EXISTS "fee_type" "ProgrammeFeeType",
  ADD COLUMN IF NOT EXISTS "fee_amount" INTEGER,
  ADD COLUMN IF NOT EXISTS "fee_min" INTEGER,
  ADD COLUMN IF NOT EXISTS "fee_max" INTEGER,
  ADD COLUMN IF NOT EXISTS "fee_disclosure_text" TEXT;

CREATE INDEX IF NOT EXISTS "jobs_opportunity_type_status_idx" ON "jobs"("opportunity_type", "status");

CREATE TABLE IF NOT EXISTS "application_status_history" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "from_status" "ApplicationStatus",
  "to_status" "ApplicationStatus" NOT NULL,
  "changed_by_user_id" TEXT,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "application_status_history_application_id_created_at_idx"
  ON "application_status_history"("application_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "application_status_history"
    ADD CONSTRAINT "application_status_history_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "commission_records" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "employer_id" TEXT NOT NULL,
  "job_id" TEXT NOT NULL,
  "applied_at" TIMESTAMP(3) NOT NULL,
  "selected_at" TIMESTAMP(3) NOT NULL,
  "commission_percent" DOUBLE PRECISION NOT NULL,
  "commission_amount_paise" INTEGER,
  "invoice_status" "CommissionInvoiceStatus" NOT NULL DEFAULT 'READY_TO_INVOICE',
  "invoice_number" TEXT,
  "invoice_date" TIMESTAMP(3),
  "notes" TEXT,
  "created_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "commission_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "commission_records_application_id_key" ON "commission_records"("application_id");
CREATE INDEX IF NOT EXISTS "commission_records_employer_id_selected_at_idx" ON "commission_records"("employer_id", "selected_at");
CREATE INDEX IF NOT EXISTS "commission_records_job_id_selected_at_idx" ON "commission_records"("job_id", "selected_at");
CREATE INDEX IF NOT EXISTS "commission_records_invoice_status_idx" ON "commission_records"("invoice_status");

DO $$ BEGIN
  ALTER TABLE "commission_records"
    ADD CONSTRAINT "commission_records_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "commission_records"
    ADD CONSTRAINT "commission_records_job_id_fkey"
    FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
