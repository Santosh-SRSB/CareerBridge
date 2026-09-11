-- Track whether a candidate has opened the dashboard at least once.
-- Existing completed candidates are treated as already having reached it
-- so re-login keeps sending them to the dashboard.
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "dashboard_reached" BOOLEAN NOT NULL DEFAULT false;

UPDATE "candidates"
SET "dashboard_reached" = true
WHERE "onboarding_completed" = true;
