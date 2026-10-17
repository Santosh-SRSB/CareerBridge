-- Soft-archive resumes linked to applications instead of hard-deleting them.
ALTER TABLE "resumes" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "resumes_archived_at_idx" ON "resumes"("archived_at");
