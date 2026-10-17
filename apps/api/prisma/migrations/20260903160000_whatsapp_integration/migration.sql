-- WhatsApp opt-in on candidates
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "whatsapp_opt_in" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "whatsapp_opt_in_at" TIMESTAMP(3);
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "whatsapp_opt_in_source" TEXT;
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "whatsapp_number" TEXT;
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "whatsapp_verified" BOOLEAN NOT NULL DEFAULT false;

-- Employer interview WhatsApp / scheduling fields
ALTER TABLE "employer_interviews" ADD COLUMN IF NOT EXISTS "scheduled_end" TIMESTAMP(3);
ALTER TABLE "employer_interviews" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';
ALTER TABLE "employer_interviews" ADD COLUMN IF NOT EXISTS "meeting_url" TEXT;
ALTER TABLE "employer_interviews" ADD COLUMN IF NOT EXISTS "whatsapp_status" TEXT;

CREATE INDEX IF NOT EXISTS "employer_interviews_candidate_id_scheduled_at_idx"
  ON "employer_interviews"("candidate_id", "scheduled_at");

DO $$ BEGIN
  CREATE TYPE "WhatsAppMessageDirection" AS ENUM ('OUTBOUND', 'INBOUND');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "WhatsAppDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'RECEIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "whatsapp_messages" (
  "id" TEXT NOT NULL,
  "candidate_id" TEXT,
  "interview_id" TEXT,
  "to_phone" TEXT NOT NULL,
  "from_phone" TEXT,
  "message_type" TEXT NOT NULL,
  "template_name" TEXT,
  "whatsapp_message_id" TEXT,
  "direction" "WhatsAppMessageDirection" NOT NULL,
  "status" "WhatsAppDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
  "payload_json" TEXT,
  "error_json" TEXT,
  "sent_at" TIMESTAMP(3),
  "delivered_at" TIMESTAMP(3),
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_messages_whatsapp_message_id_key"
  ON "whatsapp_messages"("whatsapp_message_id");
CREATE INDEX IF NOT EXISTS "whatsapp_messages_candidate_id_created_at_idx"
  ON "whatsapp_messages"("candidate_id", "created_at");
CREATE INDEX IF NOT EXISTS "whatsapp_messages_interview_id_created_at_idx"
  ON "whatsapp_messages"("interview_id", "created_at");
CREATE INDEX IF NOT EXISTS "whatsapp_messages_to_phone_created_at_idx"
  ON "whatsapp_messages"("to_phone", "created_at");
CREATE INDEX IF NOT EXISTS "whatsapp_messages_status_idx"
  ON "whatsapp_messages"("status");

DO $$ BEGIN
  ALTER TABLE "whatsapp_messages"
    ADD CONSTRAINT "whatsapp_messages_candidate_id_fkey"
    FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "whatsapp_messages"
    ADD CONSTRAINT "whatsapp_messages_interview_id_fkey"
    FOREIGN KEY ("interview_id") REFERENCES "employer_interviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "employer_interviews"
    ADD CONSTRAINT "employer_interviews_candidate_id_fkey"
    FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
