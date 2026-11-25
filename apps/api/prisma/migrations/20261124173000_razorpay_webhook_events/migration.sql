-- Idempotent Razorpay webhook event ledger (guide §8.2 / §8.4).

CREATE TABLE IF NOT EXISTS "razorpay_webhook_events" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "payment_id" TEXT,
  "order_id" TEXT,
  "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "razorpay_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "razorpay_webhook_events_event_id_key"
  ON "razorpay_webhook_events"("event_id");
CREATE INDEX IF NOT EXISTS "razorpay_webhook_events_order_id_idx"
  ON "razorpay_webhook_events"("order_id");
