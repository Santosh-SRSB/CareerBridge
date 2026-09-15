-- Nearby jobs: store coordinates on jobs and candidate search location
ALTER TABLE "candidates"
  ADD COLUMN IF NOT EXISTS "search_latitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "search_longitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "search_location_name" TEXT,
  ADD COLUMN IF NOT EXISTS "search_location_source" TEXT,
  ADD COLUMN IF NOT EXISTS "search_location_updated_at" TIMESTAMP(3);

ALTER TABLE "jobs"
  ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "jobs_latitude_longitude_idx" ON "jobs"("latitude", "longitude");

-- Backfill common city centroids (case-insensitive match on jobs.city)
UPDATE "jobs" SET "latitude" = 19.076, "longitude" = 72.8777 WHERE "latitude" IS NULL AND lower("city") LIKE '%mumbai%';
UPDATE "jobs" SET "latitude" = 28.6139, "longitude" = 77.209 WHERE "latitude" IS NULL AND (lower("city") LIKE '%delhi%' OR lower("city") LIKE '%new delhi%');
UPDATE "jobs" SET "latitude" = 12.9716, "longitude" = 77.5946 WHERE "latitude" IS NULL AND (lower("city") LIKE '%bengaluru%' OR lower("city") LIKE '%bangalore%');
UPDATE "jobs" SET "latitude" = 17.385, "longitude" = 78.4867 WHERE "latitude" IS NULL AND lower("city") LIKE '%hyderabad%';
UPDATE "jobs" SET "latitude" = 13.0827, "longitude" = 80.2707 WHERE "latitude" IS NULL AND lower("city") LIKE '%chennai%';
UPDATE "jobs" SET "latitude" = 18.5204, "longitude" = 73.8567 WHERE "latitude" IS NULL AND lower("city") LIKE '%pune%';
UPDATE "jobs" SET "latitude" = 22.5726, "longitude" = 88.3639 WHERE "latitude" IS NULL AND lower("city") LIKE '%kolkata%';
UPDATE "jobs" SET "latitude" = 23.0225, "longitude" = 72.5714 WHERE "latitude" IS NULL AND lower("city") LIKE '%ahmedabad%';
UPDATE "jobs" SET "latitude" = 26.9124, "longitude" = 75.7873 WHERE "latitude" IS NULL AND lower("city") LIKE '%jaipur%';
UPDATE "jobs" SET "latitude" = 19.8762, "longitude" = 75.3433 WHERE "latitude" IS NULL AND lower("city") LIKE '%aurangabad%';
UPDATE "jobs" SET "latitude" = 28.4595, "longitude" = 77.0266 WHERE "latitude" IS NULL AND (lower("city") LIKE '%gurgaon%' OR lower("city") LIKE '%gurugram%');
UPDATE "jobs" SET "latitude" = 28.5355, "longitude" = 77.391 WHERE "latitude" IS NULL AND lower("city") LIKE '%noida%';
UPDATE "jobs" SET "latitude" = 17.6868, "longitude" = 83.2185 WHERE "latitude" IS NULL AND lower("city") LIKE '%visakhapatnam%';
UPDATE "jobs" SET "latitude" = 26.8467, "longitude" = 80.9462 WHERE "latitude" IS NULL AND lower("city") LIKE '%lucknow%';
UPDATE "jobs" SET "latitude" = 21.1458, "longitude" = 79.0882 WHERE "latitude" IS NULL AND lower("city") LIKE '%nagpur%';
UPDATE "jobs" SET "latitude" = 22.7196, "longitude" = 75.8577 WHERE "latitude" IS NULL AND lower("city") LIKE '%indore%';
UPDATE "jobs" SET "latitude" = 23.2599, "longitude" = 77.4126 WHERE "latitude" IS NULL AND lower("city") LIKE '%bhopal%';
UPDATE "jobs" SET "latitude" = 30.7333, "longitude" = 76.7794 WHERE "latitude" IS NULL AND lower("city") LIKE '%chandigarh%';
UPDATE "jobs" SET "latitude" = 9.9312, "longitude" = 76.2673 WHERE "latitude" IS NULL AND lower("city") LIKE '%kochi%';
UPDATE "jobs" SET "latitude" = 12.2958, "longitude" = 76.6394 WHERE "latitude" IS NULL AND (lower("city") LIKE '%mysore%' OR lower("city") LIKE '%mysuru%');
UPDATE "jobs" SET "latitude" = 11.0168, "longitude" = 76.9558 WHERE "latitude" IS NULL AND lower("city") LIKE '%coimbatore%';
UPDATE "jobs" SET "latitude" = 26.1445, "longitude" = 91.7362 WHERE "latitude" IS NULL AND lower("city") LIKE '%guwahati%';
UPDATE "jobs" SET "latitude" = 25.5941, "longitude" = 85.1376 WHERE "latitude" IS NULL AND lower("city") LIKE '%patna%';
UPDATE "jobs" SET "latitude" = 20.2961, "longitude" = 85.8245 WHERE "latitude" IS NULL AND lower("city") LIKE '%bhubaneswar%';
UPDATE "jobs" SET "latitude" = 30.3165, "longitude" = 78.0322 WHERE "latitude" IS NULL AND lower("city") LIKE '%dehradun%';
