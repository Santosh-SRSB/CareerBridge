-- Feedback prompt cadence. Additive only; no existing row or value is rewritten.
--
-- 1. TestimonialSource gains EMPLOYER_DASHBOARD_SOFT_PROMPT, the employer counterpart of DASHBOARD_SOFT_PROMPT.
-- 2. testimonial_prompt_schedules holds one row per user with the time a dashboard feedback prompt was last shown.
--    The API shows at most one prompt per 360 hours per user, whatever the prompt source.
-- 3. Backfill: the previous system never recorded when a prompt was shown. A user's latest dismissal or
--    submission is the only evidence that they saw one, so it seeds last_shown_at. Users with neither get no row
--    and are prompted on their next dashboard visit; users who saw a prompt but ignored it cannot be identified.
--
-- Rollback:
--   DROP TABLE IF EXISTS "testimonial_prompt_schedules";
--   Postgres cannot drop an enum value; EMPLOYER_DASHBOARD_SOFT_PROMPT stays unused. Rows already written with it
--   (testimonial_prompts / testimonials) must be deleted or remapped before rolling the application code back.

ALTER TYPE "TestimonialSource" ADD VALUE IF NOT EXISTS 'EMPLOYER_DASHBOARD_SOFT_PROMPT';

CREATE TABLE IF NOT EXISTS "testimonial_prompt_schedules" (
  "user_id" TEXT NOT NULL,
  "last_shown_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "testimonial_prompt_schedules_pkey" PRIMARY KEY ("user_id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'testimonial_prompt_schedules_user_id_fkey'
  ) THEN
    ALTER TABLE "testimonial_prompt_schedules"
      ADD CONSTRAINT "testimonial_prompt_schedules_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "testimonial_prompt_schedules" ("user_id", "last_shown_at", "updated_at")
SELECT "user_id", MAX(GREATEST("dismissed_at", "submitted_at")), CURRENT_TIMESTAMP
FROM "testimonial_prompts"
WHERE "dismissed_at" IS NOT NULL OR "submitted_at" IS NOT NULL
GROUP BY "user_id"
ON CONFLICT ("user_id") DO NOTHING;
