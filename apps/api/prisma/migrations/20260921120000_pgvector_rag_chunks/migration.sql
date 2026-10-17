-- Profile vectors and semantic chunks in pgvector.
-- Legacy "embeddings.embedding_json" stays until backfill is verified.
-- vector(768) matches text-embedding-004 default output. Runtime rejects other lengths.
-- EMBEDDING_DIMENSIONS must stay 768 unless this column type is migrated too.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "profile_embeddings" (
  "id" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "content_hash" TEXT NOT NULL,
  "embedding" vector(768) NOT NULL,
  "model" TEXT NOT NULL,
  "dimensions" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "profile_embeddings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "profile_embeddings_entity_type_entity_id_key"
  ON "profile_embeddings"("entity_type", "entity_id");

CREATE INDEX IF NOT EXISTS "profile_embeddings_entity_type_idx"
  ON "profile_embeddings"("entity_type");

CREATE TABLE IF NOT EXISTS "embedding_chunks" (
  "id" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "parent_id" TEXT NOT NULL,
  "candidate_id" TEXT,
  "job_id" TEXT,
  "resume_id" TEXT,
  "section" TEXT NOT NULL,
  "subsection" TEXT,
  "chunk_index" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "token_count" INTEGER NOT NULL,
  "embedding" vector(768) NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "chunking_version" TEXT NOT NULL,
  "embedding_model" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "embedding_chunks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "embedding_chunks_candidate_active_idx"
  ON "embedding_chunks"("candidate_id", "active");

CREATE INDEX IF NOT EXISTS "embedding_chunks_job_active_idx"
  ON "embedding_chunks"("job_id", "active");

CREATE INDEX IF NOT EXISTS "embedding_chunks_resume_idx"
  ON "embedding_chunks"("resume_id");

DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS "profile_embeddings_embedding_hnsw" ON "profile_embeddings" USING hnsw ("embedding" vector_cosine_ops)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'profile HNSW index skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS "embedding_chunks_embedding_hnsw" ON "embedding_chunks" USING hnsw ("embedding" vector_cosine_ops)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'chunk HNSW index skipped: %', SQLERRM;
END $$;
