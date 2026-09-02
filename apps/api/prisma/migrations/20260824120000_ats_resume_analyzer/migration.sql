-- ATS analyzer: resume versions, reports, facts, issues, optimizations

DO $$ BEGIN
  CREATE TYPE "ResumeKind" AS ENUM ('ORIGINAL', 'OPTIMIZED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "OptimizationStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "resumes"
  ADD COLUMN IF NOT EXISTS "raw_text" TEXT,
  ADD COLUMN IF NOT EXISTS "kind" "ResumeKind" NOT NULL DEFAULT 'ORIGINAL',
  ADD COLUMN IF NOT EXISTS "parent_resume_id" TEXT;

CREATE INDEX IF NOT EXISTS "resumes_parent_resume_id_idx" ON "resumes"("parent_resume_id");

ALTER TABLE "resumes"
  DROP CONSTRAINT IF EXISTS "resumes_parent_resume_id_fkey";

ALTER TABLE "resumes"
  ADD CONSTRAINT "resumes_parent_resume_id_fkey"
  FOREIGN KEY ("parent_resume_id") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "resume_ats_reports" (
  "id" TEXT NOT NULL,
  "resume_id" TEXT NOT NULL,
  "score_type" TEXT NOT NULL DEFAULT 'ATS_READINESS',
  "overall_score" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "section_json" TEXT NOT NULL,
  "issues_json" TEXT NOT NULL,
  "high_priority" INTEGER NOT NULL DEFAULT 0,
  "medium_priority" INTEGER NOT NULL DEFAULT 0,
  "good_sections" INTEGER NOT NULL DEFAULT 0,
  "recommended_plan_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "resume_ats_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "resume_ats_reports_resume_id_key" ON "resume_ats_reports"("resume_id");

ALTER TABLE "resume_ats_reports"
  DROP CONSTRAINT IF EXISTS "resume_ats_reports_resume_id_fkey";
ALTER TABLE "resume_ats_reports"
  ADD CONSTRAINT "resume_ats_reports_resume_id_fkey"
  FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "resume_issues" (
  "id" TEXT NOT NULL,
  "resume_id" TEXT NOT NULL,
  "section" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "problem" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "why" TEXT NOT NULL,
  "recommendation" TEXT NOT NULL,
  "original_example" TEXT,
  "suggested_example" TEXT,
  CONSTRAINT "resume_issues_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "resume_issues_resume_id_idx" ON "resume_issues"("resume_id");
ALTER TABLE "resume_issues"
  DROP CONSTRAINT IF EXISTS "resume_issues_resume_id_fkey";
ALTER TABLE "resume_issues"
  ADD CONSTRAINT "resume_issues_resume_id_fkey"
  FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "resume_facts" (
  "id" TEXT NOT NULL,
  "resume_id" TEXT NOT NULL,
  "fact_type" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "section" TEXT NOT NULL,
  CONSTRAINT "resume_facts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "resume_facts_resume_id_idx" ON "resume_facts"("resume_id");
ALTER TABLE "resume_facts"
  DROP CONSTRAINT IF EXISTS "resume_facts_resume_id_fkey";
ALTER TABLE "resume_facts"
  ADD CONSTRAINT "resume_facts_resume_id_fkey"
  FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "resume_optimizations" (
  "id" TEXT NOT NULL,
  "source_resume_id" TEXT NOT NULL,
  "result_resume_id" TEXT,
  "plan_id" TEXT NOT NULL,
  "target_min" INTEGER NOT NULL,
  "target_max" INTEGER NOT NULL,
  "status" "OptimizationStatus" NOT NULL DEFAULT 'PENDING',
  "before_score" INTEGER NOT NULL,
  "after_score" INTEGER,
  "fact_preservation" INTEGER,
  "improvements_json" TEXT NOT NULL DEFAULT '[]',
  "changes_json" TEXT NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "resume_optimizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "resume_optimizations_result_resume_id_key" ON "resume_optimizations"("result_resume_id");
CREATE INDEX IF NOT EXISTS "resume_optimizations_source_resume_id_idx" ON "resume_optimizations"("source_resume_id");

ALTER TABLE "resume_optimizations"
  DROP CONSTRAINT IF EXISTS "resume_optimizations_source_resume_id_fkey";
ALTER TABLE "resume_optimizations"
  ADD CONSTRAINT "resume_optimizations_source_resume_id_fkey"
  FOREIGN KEY ("source_resume_id") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "resume_optimizations"
  DROP CONSTRAINT IF EXISTS "resume_optimizations_result_resume_id_fkey";
ALTER TABLE "resume_optimizations"
  ADD CONSTRAINT "resume_optimizations_result_resume_id_fkey"
  FOREIGN KEY ("result_resume_id") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
