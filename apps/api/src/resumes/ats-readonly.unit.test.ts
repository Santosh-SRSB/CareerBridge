import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConflictException } from '@nestjs/common';
import { ResumesService } from './resumes.service';
import { EXTRACTION_FAILED_MESSAGE, publicProcessingError } from './resume-eligibility';

const CONTENT = {
  fullName: 'Test Candidate',
  city: 'Pune',
  phone: null,
  summary: 'Entry-level analyst with SQL and Excel experience.',
  skills: ['SQL', 'Excel', 'Python'],
  education: [{ qualification: 'B.Sc Computer Science', institution: 'Test College', yearCompleted: 2024 }],
  experiences: [{ company: 'Acme', jobTitle: 'Support Intern', description: 'Handled customer tickets.', isInternship: true }],
  languages: ['English'],
};

function harness(processingStatus: string | null) {
  const updatedAt = new Date('2026-01-01T00:00:00Z');
  const row: Record<string, unknown> = {
    id: 'res-1',
    candidateId: 'cand-a',
    title: 'My resume',
    targetJobTitle: 'Data Analyst',
    template: 'resume-template-01',
    summary: CONTENT.summary,
    contentJson: JSON.stringify(CONTENT),
    rawText: 'raw',
    score: 55,
    version: 1,
    kind: 'ORIGINAL',
    parentResumeId: null,
    pdfStoragePath: 'resumes/old.pdf',
    pdfStorageUri: null,
    pdfPublicUrl: null,
    pdfUploadedAt: null,
    archivedAt: null,
    processingStatus,
    processingError: null,
    updatedAt,
  };
  const calls = {
    resumeUpdate: 0,
    resumeUpdateMany: [] as Array<Record<string, unknown>>,
    upload: 0,
    reindex: 0,
    reportUpsert: 0,
    deleted: [] as string[],
  };
  const bumpIfWritten = (data: Record<string, unknown>) => {
    Object.assign(row, data, { updatedAt: new Date() });
  };
  const resume = {
    findFirst: async ({ where }: { where: { id: string; candidateId: string; archivedAt: null } }) =>
      where.id === row.id && where.candidateId === row.candidateId && row.archivedAt === null ? { ...row } : null,
    findUniqueOrThrow: async () => ({ ...row }),
    update: async ({ data }: { data: Record<string, unknown> }) => {
      calls.resumeUpdate += 1;
      bumpIfWritten(data);
      return { ...row };
    },
    updateMany: async ({ where, data }: { where: { score?: { not: number } }; data: Record<string, unknown> }) => {
      calls.resumeUpdateMany.push(data);
      if (where.score && row.score === where.score.not) return { count: 0 };
      bumpIfWritten(data);
      return { count: 1 };
    },
  };
  const model = (name: string) => ({
    deleteMany: async () => {
      calls.deleted.push(name);
      return { count: 0 };
    },
    createMany: async () => ({ count: 0 }),
    upsert: async () => {
      calls.reportUpsert += 1;
      return {};
    },
  });
  const tx = {
    $queryRaw: async () => [],
    resume,
    resumeIssue: model('issue'),
    resumeFact: model('fact'),
    resumeAtsReport: model('report'),
  };
  const prisma = {
    ...tx,
    candidate: { findUnique: async () => ({ id: 'cand-a', userId: 'user-a', photoUrl: null }) },
    $transaction: async (arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (client: typeof tx) => Promise<unknown>)(tx),
  };
  const storage = {
    isConfigured: () => true,
    getBucketName: () => 'srsbbucket',
    resumeObjectPath: () => 'resumes/new.pdf',
    uploadFile: async () => {
      calls.upload += 1;
      return { gcsUri: 'gs://srsbbucket/resumes/new.pdf', publicUrl: null };
    },
    deleteFile: async () => undefined,
  };
  const processor = {
    reindexIfStale: async () => {
      calls.reindex += 1;
    },
  };
  const service = new ResumesService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    storage as never,
    {} as never,
    processor as never,
    { get: () => undefined } as never,
  );
  return { service, row, calls, updatedAt };
}

test('ATS check on a parsed resume never rewrites content, PDF, version or index', async () => {
  const h = harness('COMPLETED');
  const before = { contentJson: h.row.contentJson, version: h.row.version, pdf: h.row.pdfStoragePath };
  const first = await h.service.analyze('user-a', 'res-1');
  assert.equal(first.atsStatus, 'READY');
  assert.ok(typeof first.score === 'number');
  assert.equal(h.row.contentJson, before.contentJson);
  assert.equal(h.row.version, before.version);
  assert.equal(h.row.pdfStoragePath, before.pdf);
  assert.equal(h.calls.resumeUpdate, 0, 'analyze must not call resume.update');
  assert.equal(h.calls.upload, 0, 'analyze must not regenerate the PDF');
  assert.equal(h.calls.reindex, 0, 'analyze must not touch the RAG index');
  assert.equal(h.calls.reportUpsert, 1);

  const stamp = (h.row.updatedAt as Date).getTime();
  const again = await h.service.analyze('user-a', 'res-1');
  assert.equal(again.score, first.score, 'ATS score is deterministic for unchanged content');
  assert.equal((h.row.updatedAt as Date).getTime(), stamp, 'an unchanged score must not bump updatedAt');
});

test('saving identical resume content is a no-op (no version, PDF or re-index)', async () => {
  const h = harness('COMPLETED');
  const edited = { ...CONTENT, summary: 'Analyst focused on SQL reporting.' };
  await h.service.update('user-a', 'res-1', { content: edited, template: 'resume-template-01' });
  assert.equal(h.calls.resumeUpdate >= 1, true);
  assert.equal(h.calls.reindex, 1, 'a real content change on a parsed resume re-indexes');
  const snapshot = { ...h.row };
  const counts = { update: h.calls.resumeUpdate, upload: h.calls.upload, reindex: h.calls.reindex };

  await h.service.update('user-a', 'res-1', { content: edited, template: 'resume-template-01' });
  assert.equal(h.calls.resumeUpdate, counts.update);
  assert.equal(h.calls.upload, counts.upload);
  assert.equal(h.calls.reindex, counts.reindex);
  assert.equal(h.row.contentJson, snapshot.contentJson);
  assert.equal(h.row.version, snapshot.version);
  assert.equal(h.row.updatedAt, snapshot.updatedAt);
});

for (const status of ['FAILED', 'PENDING', 'PROCESSING']) {
  test(`${status} resume gets no ATS score and stale artifacts are cleared`, async () => {
    const h = harness(status);
    const result = await h.service.analyze('user-a', 'res-1');
    assert.equal(result.atsStatus, 'UNAVAILABLE');
    assert.equal(result.score, 0);
    assert.ok(result.atsMessage && result.atsMessage.length > 10);
    assert.equal(h.calls.reportUpsert, 0);
    assert.deepEqual([...h.calls.deleted].sort(), ['fact', 'issue', 'report']);
    assert.equal(h.row.score, 0);
    assert.equal(h.row.contentJson, JSON.stringify(CONTENT));

    const issues = await h.service.issues('user-a', 'res-1');
    assert.equal(issues.atsStatus, 'UNAVAILABLE');
    assert.deepEqual(issues.issues, []);
  });
}

test('listing resumes never recomputes an ATS score for a failed resume', async () => {
  const h = harness('FAILED');
  (h.service as unknown as { prisma: { resume: Record<string, unknown> } }).prisma.resume.findMany = async () => [
    { ...h.row, score: 48, _count: { applications: 0 } },
  ];
  h.row.score = 48;
  const [record] = await h.service.list('user-a');
  assert.equal(record.score, 0);
  assert.equal(record.analysis, undefined);
  assert.equal(h.row.score, 0, 'stale stored score is cleared');
  assert.equal(h.calls.resumeUpdate, 0);
});

test('AI resume actions are refused for a failed resume', async () => {
  const h = harness('FAILED');
  await assert.rejects(h.service.startOptimization('user-a', 'res-1', 'band-70'), (err: unknown) => err instanceof ConflictException);
});

test('raw internal processing errors are never returned to the candidate', async () => {
  const raw =
    'Invalid `prisma.resume.update()` invocation: Unique constraint failed on the fields: (`candidate_id`,`version`) postgresql://user@10.0.0.5/db';
  const h = harness('FAILED');
  h.row.processingError = raw;

  const record = await h.service.get('user-a', 'res-1');
  assert.equal(record.processingError, 'We could not process this resume. Please retry or upload the file again.');
  const status = await h.service.processingStatus('user-a', 'res-1');
  assert.equal(status.processingError, record.processingError);
  assert.equal(status.message, record.processingError);
  for (const out of [JSON.stringify(record), JSON.stringify(status)]) {
    assert.ok(!/prisma|constraint|postgresql|candidate_id/i.test(out), 'no internal detail leaks');
  }
  assert.equal(h.row.processingError, raw, 'the stored diagnostic is kept for operators');
});

test('public processing error mapping keeps actionable messages only', () => {
  assert.equal(publicProcessingError(null), null);
  assert.equal(publicProcessingError(EXTRACTION_FAILED_MESSAGE), EXTRACTION_FAILED_MESSAGE);
  assert.equal(publicProcessingError('Text extraction failed (docai): timeout; empty_extract'), EXTRACTION_FAILED_MESSAGE);
  assert.equal(
    publicProcessingError('Upload to storage failed: 403 caller does not have storage.objects.create on srsbbucket'),
    'We could not store your resume file. Please upload it again.',
  );
  assert.equal(
    publicProcessingError('GoogleGenerativeAI Error: [429] quota exceeded for key AIza...'),
    'We could not process this resume. Please retry or upload the file again.',
  );
});

test('an archived resume is never used as an ATS source', async () => {
  const h = harness('COMPLETED');
  h.row.archivedAt = new Date();
  await assert.rejects(h.service.analyze('user-a', 'res-1'), /Resume was not found/);
  assert.equal(h.calls.reportUpsert, 0);
});
