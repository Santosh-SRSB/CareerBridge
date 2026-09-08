-- Hybrid matching semantic score + embeddings table (Volume 2A.21)
ALTER TABLE "candidate_matches" ADD COLUMN IF NOT EXISTS "semantic_score" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "embeddings" (
  "id" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "content_hash" TEXT NOT NULL,
  "embedding_json" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "dimensions" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "embeddings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "embeddings_entity_type_entity_id_key"
  ON "embeddings"("entity_type", "entity_id");

CREATE INDEX IF NOT EXISTS "embeddings_entity_type_idx" ON "embeddings"("entity_type");
CREATE INDEX IF NOT EXISTS "embeddings_content_hash_idx" ON "embeddings"("content_hash");
