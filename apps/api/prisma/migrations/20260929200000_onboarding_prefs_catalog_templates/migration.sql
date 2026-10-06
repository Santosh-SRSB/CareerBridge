-- Additive only: onboarding preferences, admin catalog, notification templates.

ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "employment_status" TEXT;
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "experience_range" TEXT;
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "expected_salary_min" INTEGER;
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "expected_salary_max" INTEGER;
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "preferred_job_types" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "onboarding_skipped_steps" TEXT NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS "platform_catalog_items" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "parent_value" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "platform_catalog_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_catalog_items_kind_value_key" ON "platform_catalog_items"("kind", "value");
CREATE INDEX IF NOT EXISTS "platform_catalog_items_kind_active_idx" ON "platform_catalog_items"("kind", "active");

CREATE TABLE IF NOT EXISTS "notification_templates" (
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("key")
);
