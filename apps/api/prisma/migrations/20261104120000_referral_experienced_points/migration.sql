-- Experienced track: 1 successful referral → 5 points (fresher stays 3 → 10 via points_per_batch).
ALTER TABLE "referral_campaigns"
  ADD COLUMN "experienced_points_per_batch" INTEGER NOT NULL DEFAULT 5;

UPDATE "referral_campaigns"
SET "experienced_points_per_batch" = 5,
    "experienced_batch_size" = 1,
    "fresher_batch_size" = 3,
    "points_per_batch" = 10
WHERE "campaign_status" = 'ACTIVE';
