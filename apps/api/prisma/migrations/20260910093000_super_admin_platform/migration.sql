-- AlterEnum: add SUPER_ADMIN for Super Admin portal role
ALTER TYPE "UserType" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

-- Skill master-data fields for Super Admin skills workflow
ALTER TABLE "skills" ADD COLUMN IF NOT EXISTS "aliases" TEXT;
ALTER TABLE "skills" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "skills" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "skills_active_idx" ON "skills"("active");

-- Platform settings key/value store
CREATE TABLE IF NOT EXISTS "platform_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);
