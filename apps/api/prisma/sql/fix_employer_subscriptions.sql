-- Drop incomplete table if present, recreate with full columns
DROP TABLE IF EXISTS "employer_subscriptions";

CREATE TABLE "employer_subscriptions" (
  "id" TEXT NOT NULL,
  "employer_id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3) NOT NULL,
  "payment_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "employer_subscriptions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "employer_subscriptions"
  ADD CONSTRAINT "employer_subscriptions_employer_id_fkey"
  FOREIGN KEY ("employer_id") REFERENCES "employers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employer_subscriptions"
  ADD CONSTRAINT "employer_subscriptions_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "employer_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "employer_subscriptions_payment_id_key" ON "employer_subscriptions"("payment_id");
CREATE INDEX "employer_subscriptions_employer_id_status_ends_at_idx" ON "employer_subscriptions"("employer_id", "status", "ends_at");

ALTER TABLE "employer_payments" ADD COLUMN IF NOT EXISTS "plan_id" TEXT;
ALTER TABLE "employer_payments" ADD COLUMN IF NOT EXISTS "razorpay_order_id" TEXT;
ALTER TABLE "employer_payments" ADD COLUMN IF NOT EXISTS "razorpay_payment_id" TEXT;

CREATE INDEX IF NOT EXISTS "employer_payments_razorpay_order_id_idx" ON "employer_payments"("razorpay_order_id");
