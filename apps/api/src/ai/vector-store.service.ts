import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CHUNKING_POLICY } from './chunking/chunking-policy';
import type { SemanticChunk } from './chunking/resume-chunking';

export type StoredChunkHit = {
  id: string;
  section: string;
  subsection: string | null;
  content: string;
  chunkIndex: number;
  score: number;
  metadata: Record<string, unknown>;
  candidateId: string | null;
  resumeId: string | null;
};

@Injectable()
export class VectorStoreService {
  private readonly logger = new Logger(VectorStoreService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getProfileMeta(
    entityType: string,
    entityId: string,
  ): Promise<{ contentHash: string; dimensions: number } | null> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ content_hash: string; dimensions: number }>>(
      `SELECT content_hash, dimensions
       FROM profile_embeddings
       WHERE entity_type = $1 AND entity_id = $2
       LIMIT 1`,
      entityType,
      entityId,
    );
    if (!rows[0]) return null;
    return { contentHash: rows[0].content_hash, dimensions: rows[0].dimensions };
  }

  async getProfileVector(entityType: string, entityId: string): Promise<number[] | null> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ embedding: string }>>(
      `SELECT embedding::text AS embedding
       FROM profile_embeddings
       WHERE entity_type = $1 AND entity_id = $2
       LIMIT 1`,
      entityType,
      entityId,
    );
    if (!rows[0]?.embedding) return null;
    return parseVectorText(rows[0].embedding);
  }

  async upsertProfile(input: {
    entityType: string;
    entityId: string;
    text: string;
    values: number[];
    model: string;
  }): Promise<void> {
    const literal = toVectorLiteral(input.values);
    const hash = createHash('sha256').update(input.text).digest('hex').slice(0, 40);
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO profile_embeddings
        (id, entity_type, entity_id, content_hash, embedding, model, dimensions, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::vector, $6, $7, NOW(), NOW())
       ON CONFLICT (entity_type, entity_id)
       DO UPDATE SET
         content_hash = EXCLUDED.content_hash,
         embedding = EXCLUDED.embedding,
         model = EXCLUDED.model,
         dimensions = EXCLUDED.dimensions,
         updated_at = NOW()`,
      randomUUID(),
      input.entityType,
      input.entityId,
      hash,
      literal,
      input.model,
      input.values.length,
    );
  }

  /** Active chunks of a resume with their content hash, so unchanged content is not re-embedded. */
  async getActiveResumeChunks(
    resumeId: string,
    withVectors = false,
  ): Promise<Array<{ contentHash: string | null; model: string; chunkingVersion: string; values: number[] | null }>> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ hash: string | null; embedding_model: string; chunking_version: string; embedding: string | null }>
    >(
      `SELECT metadata->>'contentHash' AS hash, embedding_model, chunking_version,
              ${withVectors ? 'embedding::text' : 'NULL'} AS embedding
       FROM embedding_chunks
       WHERE resume_id = $1 AND entity_type = 'RESUME' AND active = true
       ORDER BY chunk_index ASC`,
      resumeId,
    );
    return rows.map((row) => ({
      contentHash: row.hash,
      model: row.embedding_model,
      chunkingVersion: row.chunking_version,
      values: row.embedding ? parseVectorText(row.embedding) : null,
    }));
  }

  /**
   * Replace the active chunks of this resume. The previous generation is kept inactive (one generation of
   * history); older inactive rows of the same resume are pruned. Chunks of the candidate's other resumes are
   * deactivated so retrieval only sees the current resume.
   */
  async replaceResumeChunks(input: {
    resumeId: string;
    candidateId: string;
    model: string;
    chunks: Array<SemanticChunk & { values: number[] }>;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `DELETE FROM embedding_chunks WHERE resume_id = $1 AND entity_type = 'RESUME' AND active = false`,
        input.resumeId,
      );
      await tx.$executeRawUnsafe(
        `UPDATE embedding_chunks SET active = false, updated_at = NOW()
         WHERE resume_id = $1 AND entity_type = 'RESUME' AND active = true`,
        input.resumeId,
      );
      for (const chunk of input.chunks) {
        await tx.$executeRawUnsafe(
          `INSERT INTO embedding_chunks
            (id, entity_type, parent_id, candidate_id, resume_id, section, subsection, chunk_index,
             content, token_count, embedding, metadata, chunking_version, embedding_model, active, created_at, updated_at)
           VALUES ($1,'RESUME',$2,$2,$3,$4,$5,$6,$7,$8,$9::vector,$10::jsonb,$11,$12,true,NOW(),NOW())`,
          randomUUID(),
          input.candidateId,
          input.resumeId,
          chunk.section,
          chunk.subsection,
          chunk.chunkIndex,
          chunk.content,
          chunk.tokenCount,
          toVectorLiteral(chunk.values),
          JSON.stringify(chunk.metadata || {}),
          CHUNKING_POLICY.version,
          input.model,
        );
      }
      await tx.$executeRawUnsafe(
        `UPDATE embedding_chunks SET active = false, updated_at = NOW()
         WHERE entity_type = 'RESUME' AND candidate_id = $1 AND resume_id <> $2 AND active = true`,
        input.candidateId,
        input.resumeId,
      );
    });
  }

  async replaceJobChunks(input: {
    jobId: string;
    model: string;
    chunks: Array<SemanticChunk & { values: number[] }>;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `DELETE FROM embedding_chunks WHERE job_id = $1 AND entity_type = 'JOB'`,
        input.jobId,
      );
      for (const chunk of input.chunks) {
        await tx.$executeRawUnsafe(
          `INSERT INTO embedding_chunks
            (id, entity_type, parent_id, job_id, section, subsection, chunk_index,
             content, token_count, embedding, metadata, chunking_version, embedding_model, active, created_at, updated_at)
           VALUES ($1,'JOB',$2,$2,$3,$4,$5,$6,$7,$8::vector,$9::jsonb,$10,$11,true,NOW(),NOW())`,
          randomUUID(),
          input.jobId,
          chunk.section,
          chunk.subsection,
          chunk.chunkIndex,
          chunk.content,
          chunk.tokenCount,
          toVectorLiteral(chunk.values),
          JSON.stringify(chunk.metadata || {}),
          CHUNKING_POLICY.version,
          input.model,
        );
      }
    });
  }

  async storedJobSourceHash(jobId: string): Promise<string | null> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ hash: string | null }>>(
      `SELECT metadata->>'sourceHash' AS hash
       FROM embedding_chunks
       WHERE job_id = $1 AND entity_type = 'JOB' AND active = true
       ORDER BY chunk_index ASC
       LIMIT 1`,
      jobId,
    );
    return rows[0]?.hash || null;
  }

  async scoreCandidates(jobVector: number[], candidateIds: string[]): Promise<Map<string, number>> {
    const scores = new Map<string, number>();
    if (!jobVector.length || !candidateIds.length) return scores;
    const rows = await this.prisma.$queryRawUnsafe<Array<{ entity_id: string; score: number }>>(
      `SELECT entity_id, 1 - (embedding <=> $1::vector) AS score
       FROM profile_embeddings
       WHERE entity_type = 'CANDIDATE' AND entity_id = ANY($2::text[])`,
      toVectorLiteral(jobVector),
      candidateIds,
    );
    for (const row of rows) {
      const score = Number(row.score);
      if (Number.isFinite(score)) scores.set(row.entity_id, score);
    }
    return scores;
  }

  async searchProfiles(input: {
    vector: number[];
    entityTypes?: string[];
    limit: number;
    minScore: number;
  }): Promise<Array<{ entityType: string; entityId: string; score: number }>> {
    const types = input.entityTypes?.length ? input.entityTypes : null;
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ entity_type: string; entity_id: string; score: number }>
    >(
      `SELECT entity_type, entity_id, 1 - (embedding <=> $1::vector) AS score
       FROM profile_embeddings
       WHERE ($2::text[] IS NULL OR entity_type = ANY($2::text[]))
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      toVectorLiteral(input.vector),
      types,
      input.limit,
    );
    return rows
      .map((row) => ({
        entityType: row.entity_type,
        entityId: row.entity_id,
        score: Number(row.score),
      }))
      .filter((row) => row.score >= input.minScore);
  }

  async searchChunks(input: {
    vector: number[];
    candidateId?: string;
    resumeId?: string;
    jobId?: string;
    sections?: string[] | null;
    limit: number;
    minScore: number;
  }): Promise<StoredChunkHit[]> {
    if (!input.candidateId && !input.jobId) return [];
    // A resume filter is only meaningful together with its owning candidate.
    if (input.resumeId && !input.candidateId) return [];
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        section: string;
        subsection: string | null;
        content: string;
        chunk_index: number;
        score: number;
        metadata: Record<string, unknown> | null;
        candidate_id: string | null;
        resume_id: string | null;
      }>
    >(
      `SELECT id, section, subsection, content, chunk_index,
              1 - (embedding <=> $1::vector) AS score,
              metadata, candidate_id, resume_id
       FROM embedding_chunks
       WHERE active = true
         AND ($2::text IS NULL OR candidate_id = $2)
         AND ($3::text IS NULL OR job_id = $3)
         AND ($5::text IS NULL OR resume_id = $5)
         AND ($6::text[] IS NULL OR section = ANY($6::text[]))
       ORDER BY embedding <=> $1::vector
       LIMIT $4`,
      toVectorLiteral(input.vector),
      input.candidateId || null,
      input.jobId || null,
      input.limit,
      input.resumeId || null,
      input.sections?.length ? input.sections : null,
    );
    return filterOwnedHits(
      rows.map((row) => ({
        id: row.id,
        section: row.section,
        subsection: row.subsection,
        content: row.content,
        chunkIndex: row.chunk_index,
        score: Number(row.score),
        metadata: row.metadata || {},
        candidateId: row.candidate_id,
        resumeId: row.resume_id,
      })),
      input,
    );
  }

  isUnavailable(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return /42P01|undefined_table|type "vector"|extension "vector"|does not exist/i.test(message);
  }

  logUnavailable(err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.warn(`pgvector store unavailable: ${message.slice(0, 240)}`);
  }
}

/** Defense in depth on top of the SQL filter: drop any hit not owned by the requested candidate/resume. */
export function filterOwnedHits(
  hits: StoredChunkHit[],
  owner: { candidateId?: string; resumeId?: string; sections?: string[] | null; minScore: number },
): StoredChunkHit[] {
  return hits.filter(
    (hit) =>
      hit.score >= owner.minScore &&
      (!owner.candidateId || hit.candidateId === owner.candidateId) &&
      (!owner.resumeId || hit.resumeId === owner.resumeId) &&
      (!owner.sections?.length || owner.sections.includes(hit.section)),
  );
}

function toVectorLiteral(values: number[]): string {
  if (!values.length || values.some((value) => !Number.isFinite(value))) {
    throw new Error('Embedding vector is empty or invalid');
  }
  return `[${values.join(',')}]`;
}

function parseVectorText(raw: string): number[] {
  const trimmed = raw.trim().replace(/^\[/, '').replace(/\]$/, '');
  if (!trimmed) return [];
  return trimmed
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n));
}
