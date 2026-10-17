-- Additive only: candidate reschedule intent status + structured availability window.

ALTER TYPE "EmployerInterviewStatus" ADD VALUE IF NOT EXISTS 'RESCHEDULE_NEEDED';

ALTER TABLE "employer_interviews" ADD COLUMN IF NOT EXISTS "candidate_proposed_date" DATE;
ALTER TABLE "employer_interviews" ADD COLUMN IF NOT EXISTS "candidate_available_from" TIMESTAMP(3);
ALTER TABLE "employer_interviews" ADD COLUMN IF NOT EXISTS "candidate_available_until" TIMESTAMP(3);
ALTER TABLE "employer_interviews" ADD COLUMN IF NOT EXISTS "candidate_timezone" TEXT;
ALTER TABLE "employer_interviews" ADD COLUMN IF NOT EXISTS "candidate_reschedule_requested_at" TIMESTAMP(3);
