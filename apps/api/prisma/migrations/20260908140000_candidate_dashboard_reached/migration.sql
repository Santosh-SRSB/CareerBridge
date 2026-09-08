-- Track whether a candidate has opened the dashboard at least once.
-- Existing completed candidates are treated as already having reached it
-- so re-login keeps sending them to the dashboard.
ALTER TABLE "Candidate" ADD COLUMN "dashboard_reached" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Candidate"
SET "dashboard_reached" = true
WHERE "onboarding_completed" = true;
