-- Resume upload pipeline metadata + processing status
ALTER TABLE "resumes"
  ADD COLUMN IF NOT EXISTS "source_kind" TEXT DEFAULT 'BUILDER',
  ADD COLUMN IF NOT EXISTS "source_file_name" TEXT,
  ADD COLUMN IF NOT EXISTS "source_mime_type" TEXT,
  ADD COLUMN IF NOT EXISTS "source_file_size" INTEGER,
  ADD COLUMN IF NOT EXISTS "source_storage_path" TEXT,
  ADD COLUMN IF NOT EXISTS "source_storage_uri" TEXT,
  ADD COLUMN IF NOT EXISTS "processing_status" TEXT DEFAULT 'READY',
  ADD COLUMN IF NOT EXISTS "processing_error" TEXT,
  ADD COLUMN IF NOT EXISTS "extraction_meta_json" TEXT;
