-- Starter plan: unlimited active jobs (0). Candidate view credits unchanged.
-- Upserts so prod rows that still say "5" become unlimited on migrate.

INSERT INTO "platform_settings" ("key", "value", "updated_at")
VALUES ('billing.starterActiveJobLimit', '0', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE
SET "value" = '0', "updated_at" = CURRENT_TIMESTAMP;
