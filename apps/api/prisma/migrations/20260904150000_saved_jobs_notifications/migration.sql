-- Saved jobs + in-app notifications for candidate MVP

CREATE TABLE IF NOT EXISTS "saved_jobs" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "saved_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "saved_jobs_candidate_id_job_id_key" ON "saved_jobs"("candidate_id", "job_id");
CREATE INDEX IF NOT EXISTS "saved_jobs_candidate_id_created_at_idx" ON "saved_jobs"("candidate_id", "created_at");

ALTER TABLE "saved_jobs"
  DROP CONSTRAINT IF EXISTS "saved_jobs_candidate_id_fkey",
  ADD CONSTRAINT "saved_jobs_candidate_id_fkey"
  FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "saved_jobs"
  DROP CONSTRAINT IF EXISTS "saved_jobs_job_id_fkey",
  ADD CONSTRAINT "saved_jobs_job_id_fkey"
  FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SYSTEM',
    "link" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

ALTER TABLE "notifications"
  DROP CONSTRAINT IF EXISTS "notifications_user_id_fkey",
  ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
