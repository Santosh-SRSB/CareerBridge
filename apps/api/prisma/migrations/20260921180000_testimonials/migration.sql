-- Testimonials + prompt eligibility for marketing quotes moderation.
CREATE TYPE "TestimonialAudience" AS ENUM ('CANDIDATE', 'EMPLOYER');
CREATE TYPE "TestimonialStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "TestimonialSource" AS ENUM (
  'AFTER_5_APPLICATIONS',
  'AFTER_FIRST_MOCK_INTERVIEW',
  'PROFILE_80_COMPLETE',
  'DASHBOARD_SOFT_PROMPT',
  'FIRST_JOB_PUBLISHED',
  'AFTER_SHORTLIST_OR_INTERVIEW',
  'AFTER_HIRE_OR_SELECT',
  'MANUAL'
);
CREATE TYPE "TestimonialPromptStatus" AS ENUM ('ELIGIBLE', 'DISMISSED', 'SUBMITTED');

CREATE TABLE "testimonials" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "audience" "TestimonialAudience" NOT NULL,
  "source" "TestimonialSource" NOT NULL,
  "rating" INTEGER NOT NULL,
  "quote" TEXT NOT NULL,
  "display_name" TEXT,
  "headline" TEXT,
  "status" "TestimonialStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by_user_id" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "reject_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "testimonial_prompts" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "source" "TestimonialSource" NOT NULL,
  "status" "TestimonialPromptStatus" NOT NULL DEFAULT 'ELIGIBLE',
  "eligible_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dismissed_at" TIMESTAMP(3),
  "submitted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "testimonial_prompts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "testimonials_status_audience_created_at_idx" ON "testimonials"("status", "audience", "created_at");
CREATE INDEX "testimonials_user_id_source_idx" ON "testimonials"("user_id", "source");
CREATE UNIQUE INDEX "testimonial_prompts_user_id_source_key" ON "testimonial_prompts"("user_id", "source");
CREATE INDEX "testimonial_prompts_user_id_status_idx" ON "testimonial_prompts"("user_id", "status");

ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "testimonial_prompts" ADD CONSTRAINT "testimonial_prompts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
