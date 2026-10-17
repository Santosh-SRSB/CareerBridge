-- Track candidate job-search keywords for match alerts when employers publish jobs.
CREATE TABLE IF NOT EXISTS "candidate_job_search_interests" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "last_searched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "candidate_job_search_interests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "candidate_job_search_interests_candidate_id_query_key"
  ON "candidate_job_search_interests"("candidate_id", "query");

CREATE INDEX IF NOT EXISTS "candidate_job_search_interests_query_idx"
  ON "candidate_job_search_interests"("query");

CREATE INDEX IF NOT EXISTS "candidate_job_search_interests_last_searched_at_idx"
  ON "candidate_job_search_interests"("last_searched_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'candidate_job_search_interests_candidate_id_fkey'
  ) THEN
    ALTER TABLE "candidate_job_search_interests"
      ADD CONSTRAINT "candidate_job_search_interests_candidate_id_fkey"
      FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
