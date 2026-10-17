import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ResumeContent } from '@careerbridge/shared';
import { GeminiProvider, normalizeVector } from './providers/gemini.provider';
import { VectorStoreService, filterOwnedHits, type StoredChunkHit } from './vector-store.service';
import { DEFAULT_RAG_MIN_SCORE, DEFAULT_RAG_SECTION_MIN_SCORE, RagRetrievalService } from './rag-retrieval.service';
import { DocumentIndexService } from './document-index.service';
import { buildInterviewQuestionUserPrompt } from './ai-gateway.service';
import { chunkResumeContent } from './chunking/resume-chunking';
import { InterviewAiService, coverageFocusForQuestion, type InterviewProfile } from '../interviews/interview-ai.service';
import { buildRetrievalPlan, pickNextSkill, selectDiverseChunks } from '../interviews/interview-retrieval';
import { ResumeProcessorService } from '../resumes/resume-processor.service';

const CAND_A = 'cand-a';
const CAND_B = 'cand-b';
const RESUME_A = 'resume-a';
const RESUME_A_OLD = 'resume-a-old';
const RESUME_B = 'resume-b';
const RESUME_ONLY_FACT = 'Implemented a custom LedgerLoom delta-sync conflict resolver that reduced sync failures by 37%.';

function config(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] } as never;
}

function geminiWithFakeClient(values: Record<string, string | undefined>, dims: number, failFirst = 0) {
  const provider = new GeminiProvider(config({ GEMINI_API_KEY: 'test-key', ...values }));
  const calls: Array<Record<string, unknown>> = [];
  let failures = failFirst;
  (provider as unknown as { client: unknown }).client = {
    models: {
      embedContent: async (req: Record<string, unknown>) => {
        calls.push(req);
        if (failures > 0) {
          failures -= 1;
          throw Object.assign(new Error('429 RESOURCE_EXHAUSTED'), { status: 429 });
        }
        const count = Array.isArray(req.contents) ? req.contents.length : 1;
        return {
          embeddings: Array.from({ length: count }, () => ({
            values: Array.from({ length: dims }, (_, i) => (i % 7) + 1),
          })),
        };
      },
    },
  };
  return { provider, calls };
}

function hit(partial: Partial<StoredChunkHit>): StoredChunkHit {
  return {
    id: 'chunk',
    section: 'Experience',
    subsection: null,
    content: 'text',
    chunkIndex: 0,
    score: 0.8,
    metadata: {},
    candidateId: CAND_A,
    resumeId: RESUME_A,
    ...partial,
  };
}

function row(partial: Record<string, unknown>) {
  return {
    id: 'r',
    section: 'Projects',
    subsection: null,
    content: 'x',
    chunk_index: 0,
    score: 0.9,
    metadata: {},
    candidate_id: CAND_A,
    resume_id: RESUME_A,
    ...partial,
  };
}

function fakePrisma() {
  const raw: Array<{ sql: string; params: unknown[] }> = [];
  const exec: Array<{ sql: string; params: unknown[] }> = [];
  let rows: unknown[] = [];
  const tx = {
    $executeRawUnsafe: async (sql: string, ...params: unknown[]) => {
      exec.push({ sql, params });
      return 1;
    },
  };
  return {
    raw,
    exec,
    setRows(next: unknown[]) {
      rows = next;
    },
    prisma: {
      $queryRawUnsafe: async (sql: string, ...params: unknown[]) => {
        raw.push({ sql, params });
        return rows;
      },
      $transaction: async (fn: (t: typeof tx) => Promise<void>) => fn(tx),
      ...tx,
    } as never,
  };
}

const resumeContent = {
  fullName: 'Test Person',
  summary: 'Mobile developer focused on offline-first apps for field teams and small businesses.',
  skills: ['React', 'Swift', 'Android'],
  education: [{ qualification: 'MCA', institution: 'Test University', yearCompleted: 2012 }],
  experiences: [
    {
      company: 'Acme Labs',
      jobTitle: 'iOS Engineer',
      description: 'Built and shipped iPad inventory apps used by warehouse staff across three regions.',
      isInternship: false,
    },
  ],
  projects: [
    {
      name: 'FieldAudit (iPad)',
      description: 'Inspection app for auditors with photo capture, offline forms and PDF export for managers.',
    },
  ],
  certifications: [],
  achievements: [{ title: 'LedgerLoom sync reliability', description: RESUME_ONLY_FACT }],
} as unknown as ResumeContent;

const baseVectors = (impl: Partial<VectorStoreService>) =>
  ({
    isUnavailable: (err: unknown) => /42P01/.test(String((err as Error)?.message || err)),
    logUnavailable: () => undefined,
    ...impl,
  }) as unknown as VectorStoreService;

describe('1. similarity threshold', () => {
  it('defaults to the DEV-evaluated thresholds (0.58 open, 0.50 section-scoped)', () => {
    const rag = new RagRetrievalService({} as never, {} as never);
    assert.equal(DEFAULT_RAG_MIN_SCORE, 0.58);
    assert.equal(DEFAULT_RAG_SECTION_MIN_SCORE, 0.5);
    assert.equal(rag.minScore(), 0.58);
    assert.equal(rag.minScore(true), 0.5);
  });

  it('can be tuned through RAG_MIN_SCORE / RAG_SECTION_MIN_SCORE and ignores invalid values', () => {
    const tuned = new RagRetrievalService({} as never, {} as never, config({ RAG_MIN_SCORE: '0.6', RAG_SECTION_MIN_SCORE: '0.52' }));
    assert.equal(tuned.minScore(), 0.6);
    assert.equal(tuned.minScore(true), 0.52);
    const broken = new RagRetrievalService({} as never, {} as never, config({ RAG_MIN_SCORE: 'abc', RAG_SECTION_MIN_SCORE: '7' }));
    assert.equal(broken.minScore(), 0.58);
    assert.equal(broken.minScore(true), 0.5);
  });

  it('applies the section floor only when sections are requested', async () => {
    const seen: Array<Record<string, unknown>> = [];
    const gemini = { isConfigured: () => true, embed: async () => ({ values: [1, 0], model: 'm' }) } as unknown as GeminiProvider;
    const rag = new RagRetrievalService(gemini, baseVectors({ searchChunks: async (i: Record<string, unknown>) => { seen.push(i); return []; } } as never));
    await rag.retrieve({ query: 'q', candidateId: CAND_A });
    await rag.retrieve({ query: 'q', candidateId: CAND_A, sections: ['Education'] });
    assert.equal(seen[0].minScore, 0.58);
    assert.equal(seen[1].minScore, 0.5);
    assert.deepEqual(seen[1].sections, ['Education']);
  });
});

describe('2. relevant vs unrelated retrieval (scores observed on DEV)', () => {
  it('keeps relevant chunks and rejects the highest-scoring unrelated chunks at 0.58', () => {
    const observed = [
      hit({ id: 'mall-android', score: 0.774 }),
      hit({ id: 'education', score: 0.725, section: 'Education' }),
      hit({ id: 'react-skills', score: 0.588, section: 'Skills' }),
      hit({ id: 'unity-query-top', score: 0.574 }),
      hit({ id: 'google-sre-query-top', score: 0.574 }),
      hit({ id: 'salesforce-query-top', score: 0.545 }),
      hit({ id: 'pasta-query-top', score: 0.444 }),
    ];
    const kept = filterOwnedHits(observed, { candidateId: CAND_A, minScore: DEFAULT_RAG_MIN_SCORE });
    assert.deepEqual(kept.map((h) => h.id), ['mall-android', 'education', 'react-skills']);
  });
});

describe('3. tiny / low-value chunk prevention', () => {
  const debris = {
    ...resumeContent,
    achievements: [],
    projects: [
      { name: 'KGP MALL (Android) - Nesting Probe Private Limited', description: 'Shopping mall app with product catalogue, cart and order tracking for Android users.' },
      { name: 'Persona IDetails:', description: null },
      { name: ':', description: null },
      { name: 'Ravi Kumar', description: null },
      { name: 'Male', description: null },
    ],
  } as unknown as ResumeContent;

  it('drops parser debris (labels, bare names, single tokens) that has no body', () => {
    const chunks = chunkResumeContent(debris);
    const joined = chunks.map((c) => c.content).join('\n');
    assert.ok(!/Persona IDetails|Ravi Kumar|\bMale\b/.test(joined));
    const projects = chunks.filter((c) => c.section === 'Projects');
    assert.equal(projects.length, 1);
    assert.ok(projects.every((c) => c.content.trim().length >= 80), 'no fragment project chunks');
    assert.ok(chunks.some((c) => c.section === 'Projects' && /KGP MALL/.test(c.content)));
  });

  it('keeps a body-less but meaningful project title, folded into a neighbour instead of its own vector', () => {
    const content = {
      ...debris,
      projects: [
        { name: 'KGP MALL (Android)', description: 'Shopping mall app with product catalogue, cart and order tracking for Android users.' },
        { name: 'Hospital Management System', description: null },
      ],
    } as unknown as ResumeContent;
    const projects = chunkResumeContent(content).filter((c) => c.section === 'Projects');
    assert.equal(projects.length, 1);
    assert.match(projects[0].content, /Hospital Management System/);
  });

  it('includes responsibilities and technologies that v1 dropped, without duplicating the description', () => {
    const content = {
      ...resumeContent,
      achievements: [],
      experiences: [
        {
          company: 'Acme Labs',
          jobTitle: 'iOS Engineer',
          description: 'Built iPad inventory apps.',
          responsibilities: ['Built iPad inventory apps.', 'Led code reviews for the mobile team'],
          technologies: ['Swift', 'Core Data', 'Swift'],
          isInternship: false,
        },
      ],
    } as unknown as ResumeContent;
    const exp = chunkResumeContent(content).find((c) => c.section === 'Experience');
    assert.ok(exp);
    assert.match(exp.content, /Led code reviews/);
    assert.match(exp.content, /Technologies: Swift, Core Data$/m);
    assert.equal(exp.content.match(/Built iPad inventory apps\./g)?.length, 1);
  });

  it('gives each substantial role its own chunk so one role can be retrieved on its own', () => {
    const role = (company: string) => ({
      company,
      jobTitle: 'iOS Developer',
      description: `At ${company} I designed, built and released several iPhone and iPad apps for retail clients, owned the App Store release process, fixed production crashes reported through Crashlytics, and mentored interns on Swift, UIKit and automated UI testing practices.`,
      isInternship: false,
    });
    const content = { ...resumeContent, achievements: [], experiences: [role('Alpha'), role('Beta'), role('Gamma')] } as unknown as ResumeContent;
    const roles = chunkResumeContent(content).filter((c) => c.section === 'Experience');
    assert.equal(roles.length, 3);
    assert.deepEqual(roles.map((r) => r.metadata.companyName), ['Alpha', 'Beta', 'Gamma']);
  });

  it('tags every chunk with source=resume', () => {
    assert.ok(chunkResumeContent(resumeContent).every((c) => c.metadata.source === 'resume'));
  });
});

describe('4. section-aware retrieval', () => {
  const profile = { skills: ['React JS', 'Android', 'C'], focusStacks: [], jobRole: 'Software Developer' };

  it('maps each interview focus to the matching resume section', () => {
    assert.deepEqual(buildRetrievalPlan({ focusKind: 'EDUCATION', profile, asked: [] }).sections, ['Education']);
    assert.deepEqual(buildRetrievalPlan({ focusKind: 'PROJECT', profile, asked: [] }).sections, ['Projects']);
    assert.deepEqual(buildRetrievalPlan({ focusKind: 'EXPERIENCE', profile, asked: [] }).sections, ['Experience']);
    assert.equal(buildRetrievalPlan({ focusKind: 'SKILL', profile, asked: [] }).sections, null);
  });

  it('technology questions name one concrete skill and move on to the next un-asked skill', () => {
    const first = buildRetrievalPlan({ focusKind: 'SKILL', profile, asked: [] });
    assert.equal(first.focusSkill, 'React JS');
    assert.match(first.query, /React JS/);
    const second = buildRetrievalPlan({ focusKind: 'SKILL', profile, asked: ['How have you used React in production?'] });
    assert.equal(second.focusSkill, 'Android');
    assert.equal(pickNextSkill(['C', 'React JS'], []), 'React JS', 'single-letter skills are skipped');
  });

  it('only open-ended focuses use the last answer', () => {
    const answer = 'I fixed offline sync conflicts in a field inventory app.';
    assert.match(buildRetrievalPlan({ focusKind: 'GENERAL', profile, asked: [], lastAnswer: answer }).query, /offline sync/);
    assert.doesNotMatch(buildRetrievalPlan({ focusKind: 'EDUCATION', profile, asked: [], lastAnswer: answer }).query, /offline sync/);
    assert.doesNotMatch(buildRetrievalPlan({ focusKind: 'GENERAL', profile, asked: [], lastAnswer: 'Audio answer submitted.' }).query, /Audio/);
  });

  it('passes the section filter into SQL and drops rows from other sections', async () => {
    const db = fakePrisma();
    db.setRows([row({ id: 'edu', section: 'Education' }), row({ id: 'proj', section: 'Projects' })]);
    const store = new VectorStoreService(db.prisma);
    const hits = await store.searchChunks({ vector: [1], candidateId: CAND_A, resumeId: RESUME_A, sections: ['Education'], limit: 8, minScore: 0 });
    assert.match(db.raw[0].sql, /section = ANY\(\$6::text\[\]\)/);
    assert.deepEqual(db.raw[0].params[5], ['Education']);
    assert.deepEqual(hits.map((h) => h.id), ['edu']);
  });

  it('rotation no longer repeats education for interview types without a fixed intro', () => {
    const p = { experiences: ['Project: FieldAudit', 'iOS Engineer — Acme'], jobRole: 'Dev' };
    const resumeKinds = [1, 2, 3, 4].map((n) => coverageFocusForQuestion(n, 'RESUME', p).kind);
    assert.deepEqual(resumeKinds, ['EDUCATION', 'PROJECT', 'EXPERIENCE', 'SKILL']);
    const mixedKinds = [2, 3, 4, 5].map((n) => coverageFocusForQuestion(n, 'MIXED', p).kind);
    assert.deepEqual(mixedKinds, ['EDUCATION', 'PROJECT', 'EXPERIENCE', 'SKILL']);
  });
});

describe('5. retrieval diversity (relevance first)', () => {
  const pool = [hit({ id: 'a', score: 0.7 }), hit({ id: 'b', score: 0.65 }), hit({ id: 'c', score: 0.6 }), hit({ id: 'd', score: 0.59 }), hit({ id: 'e', score: 0.585 })];

  it('prefers relevant chunks not used earlier in the interview', () => {
    assert.deepEqual(selectDiverseChunks(pool, ['a', 'b'], 4).map((h) => h.id), ['c', 'd', 'e', 'a']);
  });

  it('never adds chunks that were not retrieved above the threshold', () => {
    assert.deepEqual(selectDiverseChunks(pool.slice(0, 2), ['a', 'b'], 4).map((h) => h.id), ['a', 'b']);
    assert.deepEqual(selectDiverseChunks([], ['a'], 4), []);
  });
});

describe('6-8. candidate isolation, resume isolation, inactive exclusion', () => {
  it('SQL filters by active, candidate and resume', async () => {
    const db = fakePrisma();
    db.setRows([row({ id: 'c1' })]);
    const store = new VectorStoreService(db.prisma);
    await store.searchChunks({ vector: [0.1, 0.2], candidateId: CAND_A, resumeId: RESUME_A, limit: 4, minScore: 0 });
    const { sql, params } = db.raw[0];
    assert.match(sql, /active = true/);
    assert.match(sql, /candidate_id = \$2/);
    assert.match(sql, /resume_id = \$5/);
    assert.equal(params[1], CAND_A);
    assert.equal(params[4], RESUME_A);
  });

  it('refuses to search without an owner, or with resumeId but no candidateId', async () => {
    const db = fakePrisma();
    const store = new VectorStoreService(db.prisma);
    assert.deepEqual(await store.searchChunks({ vector: [1], limit: 4, minScore: 0 }), []);
    assert.deepEqual(await store.searchChunks({ vector: [1], resumeId: RESUME_A, limit: 4, minScore: 0 }), []);
    assert.equal(db.raw.length, 0);
  });

  it('drops foreign-candidate and other-resume rows even if SQL returned them', async () => {
    const db = fakePrisma();
    db.setRows([
      row({ id: 'a1' }),
      row({ id: 'b1', candidate_id: CAND_B, resume_id: RESUME_B, score: 0.95 }),
      row({ id: 'a-old', resume_id: RESUME_A_OLD }),
    ]);
    const store = new VectorStoreService(db.prisma);
    const hitsA = await store.searchChunks({ vector: [1], candidateId: CAND_A, resumeId: RESUME_A, limit: 4, minScore: 0 });
    assert.deepEqual(hitsA.map((h) => h.id), ['a1']);
    const hitsB = await store.searchChunks({ vector: [1], candidateId: CAND_B, resumeId: RESUME_B, limit: 4, minScore: 0 });
    assert.deepEqual(hitsB.map((h) => h.id), ['b1']);
    const crossed = await store.searchChunks({ vector: [1], candidateId: CAND_B, resumeId: RESUME_A, limit: 4, minScore: 0 });
    assert.deepEqual(crossed, []);
  });
});

describe('14. re-indexing', () => {
  it('keeps one inactive generation, activates the new one and deactivates other resumes (no deletes of other resumes)', async () => {
    const db = fakePrisma();
    const store = new VectorStoreService(db.prisma);
    await store.replaceResumeChunks({
      resumeId: RESUME_A,
      candidateId: CAND_A,
      model: 'gemini-embedding-001',
      chunks: [{ section: 'Summary', subsection: null, chunkIndex: 0, content: 'x', tokenCount: 1, metadata: {}, values: [0.5, 0.5] }],
    });
    assert.match(db.exec[0].sql, /DELETE FROM embedding_chunks WHERE resume_id = \$1 AND entity_type = 'RESUME' AND active = false/);
    assert.match(db.exec[1].sql, /SET active = false[\s\S]*resume_id = \$1[\s\S]*active = true/);
    assert.match(db.exec[2].sql, /INSERT INTO embedding_chunks/);
    const other = db.exec[3];
    assert.match(other.sql, /candidate_id = \$1 AND resume_id <> \$2/);
    assert.deepEqual(other.params, [CAND_A, RESUME_A]);
    assert.ok(!db.exec.some((e) => /DELETE[\s\S]*candidate_id/.test(e.sql)));
  });

  function indexer(stored: Array<{ contentHash: string | null; model: string; chunkingVersion: string; values: number[] | null }>) {
    const embedCalls: string[][] = [];
    const replaced: Array<Record<string, unknown>> = [];
    const gemini = {
      isConfigured: () => true,
      getEmbeddingModel: () => 'gemini-embedding-001',
      embedMany: async (texts: string[]) => {
        embedCalls.push(texts);
        return { vectors: texts.map(() => Array(768).fill(0.02)), model: 'gemini-embedding-001', requests: 1 };
      },
    } as unknown as GeminiProvider;
    const gateway = { upsertEmbedding: async () => ({ ok: true }), buildCandidateEmbedText: () => 'profile' } as never;
    const vectors = baseVectors({
      getActiveResumeChunks: async () => stored,
      replaceResumeChunks: async (input: Record<string, unknown>) => { replaced.push(input); },
    } as never);
    return { svc: new DocumentIndexService(gemini, gateway, vectors), embedCalls, replaced };
  }

  it('embeds all chunks in one batch request the first time', async () => {
    const { svc, embedCalls, replaced } = indexer([]);
    const result = await svc.indexResume({ resumeId: RESUME_A, candidateId: CAND_A, content: resumeContent });
    assert.equal(result.ok, true);
    assert.equal(embedCalls.length, 1);
    assert.equal(embedCalls[0].length, result.chunkCount);
    const chunks = replaced[0].chunks as Array<{ values: number[]; metadata: { contentHash: string } }>;
    assert.ok(chunks.every((c) => c.values.length === 768 && c.metadata.contentHash.length === 40));
    assert.equal(replaced[0].resumeId, RESUME_A);
    assert.equal(replaced[0].candidateId, CAND_A);
  });

  it('re-embeds only changed chunks on re-index', async () => {
    const first = indexer([]);
    await first.svc.indexResume({ resumeId: RESUME_A, candidateId: CAND_A, content: resumeContent });
    const previous = (first.replaced[0].chunks as Array<{ values: number[]; metadata: { contentHash: string } }>).map((c) => ({
      contentHash: c.metadata.contentHash,
      model: 'gemini-embedding-001',
      chunkingVersion: 'v2',
      values: c.values,
    }));
    const edited = { ...resumeContent, summary: `${resumeContent.summary} Now also mentoring juniors.` } as ResumeContent;
    const second = indexer(previous);
    const result = await second.svc.indexResume({ resumeId: RESUME_A, candidateId: CAND_A, content: edited });
    assert.equal(result.embedded, 1);
    assert.equal(result.reused, result.chunkCount - 1);
    assert.equal(second.embedCalls[0].length, 1);

    const unchanged = indexer(previous);
    const noop = await unchanged.svc.indexResume({ resumeId: RESUME_A, candidateId: CAND_A, content: resumeContent });
    assert.equal(noop.embedded, 0);
    assert.equal(unchanged.embedCalls.length, 0, 'no embedding request for unchanged content');
  });

  it('does not reuse vectors produced by a different embedding model', async () => {
    const first = indexer([]);
    await first.svc.indexResume({ resumeId: RESUME_A, candidateId: CAND_A, content: resumeContent });
    const old = (first.replaced[0].chunks as Array<{ values: number[]; metadata: { contentHash: string } }>).map((c) => ({
      contentHash: c.metadata.contentHash,
      model: 'text-embedding-004',
      chunkingVersion: 'v2',
      values: c.values,
    }));
    const second = indexer(old);
    const result = await second.svc.indexResume({ resumeId: RESUME_A, candidateId: CAND_A, content: resumeContent });
    assert.equal(result.embedded, result.chunkCount);
  });

  it('detects a stale index (missing, old chunking version, other model, edited content)', async () => {
    const first = indexer([]);
    await first.svc.indexResume({ resumeId: RESUME_A, candidateId: CAND_A, content: resumeContent });
    const current = (first.replaced[0].chunks as Array<{ metadata: { contentHash: string } }>).map((c) => ({
      contentHash: c.metadata.contentHash,
      model: 'gemini-embedding-001',
      chunkingVersion: 'v2',
      values: null,
    }));
    assert.equal(await indexer(current).svc.isResumeIndexCurrent(RESUME_A, resumeContent), true);
    assert.equal(await indexer([]).svc.isResumeIndexCurrent(RESUME_A, resumeContent), false);
    assert.equal(await indexer(current.map((c) => ({ ...c, chunkingVersion: 'v1' }))).svc.isResumeIndexCurrent(RESUME_A, resumeContent), false);
    assert.equal(await indexer(current.map((c) => ({ ...c, model: 'text-embedding-004' }))).svc.isResumeIndexCurrent(RESUME_A, resumeContent), false);
    const edited = { ...resumeContent, summary: 'Different summary text for the same resume.' } as ResumeContent;
    assert.equal(await indexer(current).svc.isResumeIndexCurrent(RESUME_A, edited), false);
  });

  it('processor re-indexes a COMPLETED resume only when its index is stale, without touching parse status', async () => {
    for (const current of [false, true]) {
      const indexCalls: unknown[] = [];
      const updates: unknown[] = [];
      const prisma = {
        resume: {
          findUnique: async () => ({ id: RESUME_A, candidateId: CAND_A, processingStatus: 'COMPLETED', contentJson: JSON.stringify(resumeContent), rawText: 'raw' }),
          update: async (arg: unknown) => { updates.push(arg); return arg; },
        },
      } as never;
      const documentIndex = {
        isResumeIndexCurrent: async () => current,
        indexResume: async (input: unknown) => { indexCalls.push(input); return { ok: true, chunkCount: 3 }; },
      } as never;
      const svc = new ResumeProcessorService(prisma, {} as never, {} as never, {} as never, {} as never, documentIndex);
      const res = await svc.processUploadedResume(RESUME_A, 'user-a');
      assert.equal(res.ok, true);
      assert.equal(indexCalls.length, current ? 0 : 1);
      assert.equal(updates.length, 0);
    }
  });
});

describe('embeddings: gemini-embedding-001 at 768 dimensions', () => {
  it('defaults to gemini-embedding-001 and requests outputDimensionality=768', async () => {
    const { provider, calls } = geminiWithFakeClient({}, 768);
    const out = await provider.embed('React developer');
    assert.equal(out.model, 'gemini-embedding-001');
    assert.equal(out.values.length, 768);
    assert.deepEqual(calls[0].config, { outputDimensionality: 768 });
    const norm = Math.sqrt(out.values.reduce((s, v) => s + v * v, 0));
    assert.ok(Math.abs(norm - 1) < 1e-9);
    assert.deepEqual(normalizeVector([0, 0]), [0, 0]);
  });

  it('rejects a response whose length does not match vector(768)', async () => {
    const { provider } = geminiWithFakeClient({}, 3072);
    await assert.rejects(provider.embed('query'), /does not match EMBEDDING_DIMENSIONS=768/);
    await assert.rejects(provider.embedMany(['a']), /does not match EMBEDDING_DIMENSIONS=768/);
  });

  it('embedMany batches up to 100 texts per request and retries rate limits', async () => {
    const { provider, calls } = geminiWithFakeClient({}, 768, 1);
    const texts = Array.from({ length: 150 }, (_, i) => `chunk ${i}`);
    const out = await provider.embedMany(texts, { backoffMs: 1 });
    assert.equal(out.vectors.length, 150);
    assert.equal(out.requests, 3, 'one retry + two batches');
    assert.equal((calls[1].contents as string[]).length, 100);
    assert.equal((calls[2].contents as string[]).length, 50);
  });

  it('embedMany gives up after the retry budget', async () => {
    const { provider } = geminiWithFakeClient({}, 768, 10);
    await assert.rejects(provider.embedMany(['a'], { retries: 2, backoffMs: 1 }), /429/);
  });
});

describe('11-12. retrieval and embedding failures', () => {
  it('returns [] (no throw, no leakage) when embedding fails, vector store fails, or tables are missing', async () => {
    const okGemini = { isConfigured: () => true, embed: async () => ({ values: [1], model: 'm' }) } as unknown as GeminiProvider;
    const badGemini = { isConfigured: () => true, embed: async () => { throw new Error('404 NOT_FOUND'); } } as unknown as GeminiProvider;
    const failing = baseVectors({ searchChunks: async () => { throw new Error('connection reset'); } } as never);
    const missing = baseVectors({ searchChunks: async () => { throw new Error('42P01 relation does not exist'); } } as never);
    const working = baseVectors({ searchChunks: async () => [hit({})] } as never);
    assert.deepEqual(await new RagRetrievalService(badGemini, working).retrieve({ query: 'q', candidateId: CAND_A }), []);
    assert.deepEqual(await new RagRetrievalService(okGemini, failing).retrieve({ query: 'q', candidateId: CAND_A }), []);
    assert.deepEqual(await new RagRetrievalService(okGemini, missing).retrieve({ query: 'q', candidateId: CAND_A }), []);
  });

  it('never searches without an owner or when Gemini is not configured', async () => {
    let called = 0;
    const vectors = baseVectors({ searchChunks: async () => { called += 1; return [hit({})]; } } as never);
    const gemini = { isConfigured: () => true, embed: async () => ({ values: [1], model: 'm' }) } as unknown as GeminiProvider;
    const off = { isConfigured: () => false } as unknown as GeminiProvider;
    assert.deepEqual(await new RagRetrievalService(gemini, vectors).retrieve({ query: 'q' }), []);
    assert.deepEqual(await new RagRetrievalService(gemini, vectors).retrieve({ query: 'q', resumeId: RESUME_A }), []);
    assert.deepEqual(await new RagRetrievalService(off, vectors).retrieve({ query: 'q', candidateId: CAND_A }), []);
    assert.equal(called, 0);
  });

  it('indexing reports failure and stores nothing when embedding fails', async () => {
    let stored = 0;
    const gemini = {
      isConfigured: () => true,
      getEmbeddingModel: () => 'gemini-embedding-001',
      embedMany: async () => { throw new Error('404 NOT_FOUND'); },
    } as unknown as GeminiProvider;
    const gateway = { upsertEmbedding: async () => ({ ok: true }), buildCandidateEmbedText: () => 'profile' } as never;
    const vectors = baseVectors({ getActiveResumeChunks: async () => [], replaceResumeChunks: async () => { stored += 1; } } as never);
    const result = await new DocumentIndexService(gemini, gateway, vectors).indexResume({ resumeId: RESUME_A, candidateId: CAND_A, content: resumeContent });
    assert.equal(result.ok, false);
    assert.equal(stored, 0);
  });
});

describe('9-10, 13. interview context: grounding, no-resume, chunks reaching Gemini', () => {
  const profile: InterviewProfile = {
    fullName: 'Test Person',
    skills: ['React', 'Android'],
    education: ['MCA · Test University'],
    experiences: ['iOS Engineer — Acme Labs', 'Project: FieldAudit (iPad)'],
    summary: resumeContent.summary,
    jobRole: 'Mobile Developer',
    focusStacks: [],
    experienceYears: 8,
    candidateId: CAND_A,
    resumeId: RESUME_A,
    interviewId: 'iv-1',
  };

  function interviewService(hits: StoredChunkHit[] | Error) {
    const retrieveCalls: Array<Record<string, unknown>> = [];
    const genCalls: Array<Record<string, unknown>> = [];
    const gateway = {
      isConfigured: () => true,
      generateInterviewQuestion: async (input: { retrievedChunks: string[] }) => {
        genCalls.push(input);
        const withFact = input.retrievedChunks.find((c) => c.includes('LedgerLoom'));
        return {
          question: withFact
            ? 'How did you design the LedgerLoom delta-sync conflict resolver that cut sync failures by 37%?'
            : 'Tell me about a sync problem you solved in one of your apps and how you approached it.',
          category: 'PROJECT',
        };
      },
    } as never;
    const rag = {
      minScore: (sectionScoped: boolean) => (sectionScoped ? 0.5 : 0.58),
      retrieve: async (input: Record<string, unknown>) => {
        retrieveCalls.push(input);
        if (hits instanceof Error) throw hits;
        return hits;
      },
    } as never;
    return { svc: new InterviewAiService(gateway, rag), retrieveCalls, genCalls };
  }

  const factChunk = hit({ id: 'fact', section: 'Achievements', content: `LedgerLoom sync reliability\n${RESUME_ONLY_FACT}`, score: 0.71 });
  const lastAnswer = { question: 'Q', answer: 'I spent a lot of time fixing offline sync conflicts for field inventory apps.' };
  const askedSoFar = ['q1', 'q2', 'q3', 'q4'];

  it('resume-only fact: it is absent from the profile, retrieved as a chunk, sent to Gemini and used', async () => {
    assert.ok(!JSON.stringify(profile).includes('LedgerLoom'), 'profile must not contain the fact');
    const { svc, retrieveCalls, genCalls } = interviewService([factChunk]);
    const q = await svc.nextQuestion(profile, 'RESUME', 'YEAR_4_PLUS', askedSoFar, lastAnswer);
    assert.equal(retrieveCalls[0].candidateId, CAND_A);
    assert.equal(retrieveCalls[0].resumeId, RESUME_A);
    assert.match(String(retrieveCalls[0].query), /offline sync conflicts/);
    const chunks = genCalls[0].retrievedChunks as string[];
    assert.equal(chunks.length, 1);
    assert.match(chunks[0], /^\[Achievements\] /);
    assert.match(chunks[0], /reduced sync failures by 37%/);
    assert.ok(!JSON.stringify(genCalls[0].profile).includes('LedgerLoom'));
    assert.match(q.text, /LedgerLoom/);
    assert.deepEqual(q.ragChunkIds, ['fact']);
  });

  it('negative control: without the chunk the request carries no fact and the question does not use it', async () => {
    const { svc, genCalls } = interviewService([]);
    const q = await svc.nextQuestion(profile, 'RESUME', 'YEAR_4_PLUS', askedSoFar, lastAnswer);
    assert.deepEqual(genCalls[0].retrievedChunks, []);
    assert.ok(!JSON.stringify(genCalls[0]).includes('LedgerLoom'));
    assert.doesNotMatch(q.text, /LedgerLoom|37%/);
    assert.deepEqual(q.ragChunkIds, []);
  });

  it('retrieval error behaves like no context (no throw, no fabricated chunk)', async () => {
    const { svc, genCalls } = interviewService(new Error('vector down'));
    const q = await svc.nextQuestion(profile, 'RESUME', 'YEAR_4_PLUS', askedSoFar, lastAnswer);
    assert.deepEqual(genCalls[0].retrievedChunks, []);
    assert.doesNotMatch(q.text, /LedgerLoom/);
  });

  it('no-resume candidate (no candidateId context) never queries retrieval', async () => {
    const { svc, retrieveCalls, genCalls } = interviewService([factChunk]);
    await svc.nextQuestion({ ...profile, candidateId: undefined, resumeId: undefined }, 'RESUME', 'FRESHER', askedSoFar, lastAnswer);
    assert.equal(retrieveCalls.length, 0);
    assert.deepEqual(genCalls[0].retrievedChunks, []);
  });

  it('uses section filters per focus and avoids chunks already used in the interview', async () => {
    const pool = [hit({ id: 'p1', section: 'Projects', score: 0.62 }), hit({ id: 'p2', section: 'Projects', score: 0.6 })];
    const { svc, retrieveCalls, genCalls } = interviewService(pool);
    const q = await svc.nextQuestion(profile, 'RESUME', 'YEAR_4_PLUS', ['q1'], undefined, ['p1']);
    assert.deepEqual(retrieveCalls[0].sections, ['Projects']);
    assert.equal(retrieveCalls[0].limit, 8);
    assert.equal(retrieveCalls[0].minScore, 0.5);
    assert.deepEqual(q.ragChunkIds, ['p2', 'p1']);
    assert.match((genCalls[0].retrievedChunks as string[])[0], /^\[Projects\]/);
  });

  it('keeps retrieved chunks inside the 12k prompt cap even with a huge profile', () => {
    const prompt = buildInterviewQuestionUserPrompt({
      interviewType: 'MIXED',
      questionNumber: 2,
      askedQuestions: [],
      profile: { experiences: Array(200).fill('x'.repeat(200)) },
      retrievedChunks: ['UNIQUE-CHUNK-MARKER'],
    });
    assert.ok(prompt.length <= 12000);
    assert.ok(prompt.includes('UNIQUE-CHUNK-MARKER'));
  });
});
