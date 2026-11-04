-- Refer & Earn: campaigns, codes, referrals, rewards, points ledger, payout requests.
-- Additive only. Rollback: drop tables/enums listed at bottom of this file (app code first).

CREATE TYPE "ReferralStatus" AS ENUM (
  'REGISTERED',
  'PENDING_VERIFICATION',
  'PROFILE_INCOMPLETE',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'ON_HOLD'
);

CREATE TYPE "ReferralRewardStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'PAYMENT_PENDING',
  'PAID',
  'CANCELLED'
);

CREATE TYPE "ReferralPointTxnType" AS ENUM (
  'CREDIT',
  'REDEEM',
  'ADJUSTMENT',
  'REVERSAL'
);

CREATE TYPE "ReferralPayoutStatus" AS ENUM (
  'PENDING',
  'PAID',
  'REJECTED'
);

CREATE TYPE "ReferralCampaignStatus" AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'ENDED'
);

CREATE TABLE "referral_campaigns" (
  "id" TEXT NOT NULL,
  "campaign_name" TEXT NOT NULL,
  "reward_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "currency" CHAR(3) NOT NULL DEFAULT 'INR',
  "fresher_batch_size" INTEGER NOT NULL DEFAULT 3,
  "experienced_batch_size" INTEGER NOT NULL DEFAULT 1,
  "points_per_batch" INTEGER NOT NULL DEFAULT 10,
  "points_to_payout_eligible" INTEGER NOT NULL DEFAULT 100,
  "start_date" TIMESTAMP(3),
  "end_date" TIMESTAMP(3),
  "minimum_profile_completion" INTEGER NOT NULL DEFAULT 0,
  "mobile_verification_required" BOOLEAN NOT NULL DEFAULT true,
  "email_verification_required" BOOLEAN NOT NULL DEFAULT false,
  "resume_required" BOOLEAN NOT NULL DEFAULT false,
  "max_rewards_per_referrer" INTEGER,
  "attribution_retention_days" INTEGER NOT NULL DEFAULT 30,
  "campaign_status" "ReferralCampaignStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "referral_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "candidate_referral_codes" (
  "id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "referral_code" VARCHAR(30) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "candidate_referral_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "candidate_referral_codes_candidate_id_key" ON "candidate_referral_codes"("candidate_id");
CREATE UNIQUE INDEX "candidate_referral_codes_referral_code_key" ON "candidate_referral_codes"("referral_code");
CREATE INDEX "candidate_referral_codes_referral_code_idx" ON "candidate_referral_codes"("referral_code");

ALTER TABLE "candidate_referral_codes"
  ADD CONSTRAINT "candidate_referral_codes_candidate_id_fkey"
  FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "candidate_referrals" (
  "id" TEXT NOT NULL,
  "referrer_candidate_id" TEXT NOT NULL,
  "referred_candidate_id" TEXT NOT NULL,
  "referral_code" VARCHAR(30) NOT NULL,
  "campaign_id" TEXT,
  "referral_source" VARCHAR(40),
  "status" "ReferralStatus" NOT NULL DEFAULT 'REGISTERED',
  "duplicate_flag" BOOLEAN NOT NULL DEFAULT false,
  "fraud_flag" BOOLEAN NOT NULL DEFAULT false,
  "rejection_reason" TEXT,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verified_at" TIMESTAMP(3),
  "approved_at" TIMESTAMP(3),
  "reviewed_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "candidate_referrals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "candidate_referrals_referred_candidate_id_key" ON "candidate_referrals"("referred_candidate_id");
CREATE INDEX "candidate_referrals_referrer_candidate_id_status_idx" ON "candidate_referrals"("referrer_candidate_id", "status");
CREATE INDEX "candidate_referrals_status_idx" ON "candidate_referrals"("status");
CREATE INDEX "candidate_referrals_referral_code_idx" ON "candidate_referrals"("referral_code");

ALTER TABLE "candidate_referrals"
  ADD CONSTRAINT "candidate_referrals_referrer_candidate_id_fkey"
  FOREIGN KEY ("referrer_candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "candidate_referrals"
  ADD CONSTRAINT "candidate_referrals_referred_candidate_id_fkey"
  FOREIGN KEY ("referred_candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "candidate_referrals"
  ADD CONSTRAINT "candidate_referrals_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "referral_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "referral_rewards" (
  "id" TEXT NOT NULL,
  "referral_id" TEXT NOT NULL,
  "referrer_candidate_id" TEXT NOT NULL,
  "reward_amount" DECIMAL(10,2) NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'INR',
  "reward_status" "ReferralRewardStatus" NOT NULL DEFAULT 'PENDING',
  "approved_at" TIMESTAMP(3),
  "paid_at" TIMESTAMP(3),
  "payment_reference" VARCHAR(150),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "referral_rewards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referral_rewards_referral_id_key" ON "referral_rewards"("referral_id");
CREATE INDEX "referral_rewards_referrer_candidate_id_reward_status_idx" ON "referral_rewards"("referrer_candidate_id", "reward_status");
CREATE INDEX "referral_rewards_reward_status_idx" ON "referral_rewards"("reward_status");

ALTER TABLE "referral_rewards"
  ADD CONSTRAINT "referral_rewards_referral_id_fkey"
  FOREIGN KEY ("referral_id") REFERENCES "candidate_referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "referral_point_ledger" (
  "id" TEXT NOT NULL,
  "referrer_candidate_id" TEXT NOT NULL,
  "transaction_type" "ReferralPointTxnType" NOT NULL,
  "points" INTEGER NOT NULL,
  "reference" VARCHAR(120),
  "notes" TEXT,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "referral_point_ledger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referral_point_ledger_referrer_candidate_id_reference_key"
  ON "referral_point_ledger"("referrer_candidate_id", "reference");
CREATE INDEX "referral_point_ledger_referrer_candidate_id_created_at_idx"
  ON "referral_point_ledger"("referrer_candidate_id", "created_at");

ALTER TABLE "referral_point_ledger"
  ADD CONSTRAINT "referral_point_ledger_referrer_candidate_id_fkey"
  FOREIGN KEY ("referrer_candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "referral_payout_requests" (
  "id" TEXT NOT NULL,
  "referrer_candidate_id" TEXT NOT NULL,
  "upi_id" VARCHAR(120) NOT NULL,
  "points_at_request" INTEGER NOT NULL,
  "status" "ReferralPayoutStatus" NOT NULL DEFAULT 'PENDING',
  "payment_reference" VARCHAR(150),
  "admin_note" TEXT,
  "reviewed_by" TEXT,
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "referral_payout_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "referral_payout_requests_status_created_at_idx" ON "referral_payout_requests"("status", "created_at");
CREATE INDEX "referral_payout_requests_referrer_candidate_id_status_idx"
  ON "referral_payout_requests"("referrer_candidate_id", "status");

ALTER TABLE "referral_payout_requests"
  ADD CONSTRAINT "referral_payout_requests_referrer_candidate_id_fkey"
  FOREIGN KEY ("referrer_candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "referral_reward_transactions" (
  "id" TEXT NOT NULL,
  "referrer_candidate_id" TEXT NOT NULL,
  "referral_reward_id" TEXT,
  "transaction_type" VARCHAR(30) NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "reference" VARCHAR(150),
  "notes" TEXT,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "referral_reward_transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "referral_reward_transactions_referrer_candidate_id_created_at_idx"
  ON "referral_reward_transactions"("referrer_candidate_id", "created_at");

-- Default live campaign (points rules: fresher 3→10, experienced 1→10, UPI at 100).
INSERT INTO "referral_campaigns" (
  "id",
  "campaign_name",
  "reward_amount",
  "currency",
  "fresher_batch_size",
  "experienced_batch_size",
  "points_per_batch",
  "points_to_payout_eligible",
  "start_date",
  "attribution_retention_days",
  "campaign_status",
  "created_at",
  "updated_at"
) VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Refer & Earn',
  0,
  'INR',
  3,
  1,
  10,
  100,
  CURRENT_TIMESTAMP,
  30,
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
