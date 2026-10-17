-- Additive only: persisted close timestamp for the Employer Report "Closed Date".

ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMP(3);

-- Backfill only where the audit trail proves when the job was closed. Admin status changes are audited
-- (action JOB_<status>, old_value {"status": ...}); employer close/pause/publish are not. A closed job is
-- backfilled when its latest status audit is JOB_CLOSED and it was not re-published after that audit
-- (an employer re-publish resets published_at). The close moment is the latest JOB_CLOSED that actually
-- moved the job out of another status, so repeated CLOSED saves do not shift it. Everything else stays NULL.
WITH status_audits AS (
  SELECT "resource_id", "action", "old_value", "created_at", "id"
  FROM "audit_logs"
  WHERE "resource_type" = 'JOB'
    AND "action" IN ('JOB_DRAFT', 'JOB_PENDING_REVIEW', 'JOB_PUBLISHED', 'JOB_PAUSED', 'JOB_CLOSED')
),
latest_status AS (
  SELECT DISTINCT ON ("resource_id") "resource_id", "action"
  FROM status_audits
  ORDER BY "resource_id", "created_at" DESC, "id" DESC
),
close_event AS (
  SELECT "resource_id", MAX("created_at") AS "closed_at"
  FROM status_audits
  WHERE "action" = 'JOB_CLOSED'
    AND ("old_value" IS NULL OR "old_value" NOT LIKE '%"status":"CLOSED"%')
  GROUP BY "resource_id"
)
UPDATE "jobs" j
SET "closed_at" = c."closed_at"
FROM latest_status l
JOIN close_event c ON c."resource_id" = l."resource_id"
WHERE l."resource_id" = j."id"
  AND l."action" = 'JOB_CLOSED'
  AND j."status" = 'CLOSED'
  AND j."closed_at" IS NULL
  AND (j."published_at" IS NULL OR j."published_at" <= c."closed_at");
