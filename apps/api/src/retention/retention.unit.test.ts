/**
 * node -r ts-node/register/transpile-only --test src/retention/retention.unit.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RETENTION_DEFAULTS, RETENTION_SETTING_KEYS } from './retention.constants';
import { RetentionService } from './retention.service';

describe('RetentionService', () => {
  it('uses platform settings when present and defaults otherwise', async () => {
    const prisma = {
      platformSetting: {
        findMany: async () => [
          { key: RETENTION_SETTING_KEYS.resumeDays, value: '400' },
          { key: RETENTION_SETTING_KEYS.whatsappDays, value: 'not-a-number' },
        ],
      },
      resume: { findMany: async () => [], deleteMany: async () => ({ count: 0 }), updateMany: async () => ({ count: 0 }) },
      embeddingChunk: { deleteMany: async () => ({ count: 0 }) },
      profileEmbedding: { deleteMany: async () => ({ count: 0 }) },
      embedding: { deleteMany: async () => ({ count: 0 }) },
      resumeOptimization: { updateMany: async () => ({ count: 0 }) },
      whatsAppMessage: { findMany: async () => [], deleteMany: async () => ({ count: 0 }) },
      aiInteraction: { findMany: async () => [], deleteMany: async () => ({ count: 0 }) },
      auditLog: { findMany: async () => [], deleteMany: async () => ({ count: 0 }) },
    };
    const svc = new RetentionService(prisma as never);
    const windows = await svc.resolveWindows(new Date('2026-10-17T00:00:00.000Z'));
    assert.equal(windows.resumeDays, 400);
    assert.equal(windows.whatsappDays, RETENTION_DEFAULTS.whatsappDays);
    assert.equal(windows.aiInteractionDays, RETENTION_DEFAULTS.aiInteractionDays);
    assert.equal(windows.auditLogDays, RETENTION_DEFAULTS.auditLogDays);
  });

  it('purges expired resumes, whatsapp, AI interactions, and audit logs', async () => {
    const deletedResumeIds: string[] = [];
    const deletedWa: string[] = [];
    const deletedAi: string[] = [];
    const deletedAudit: string[] = [];
    const files: string[] = [];

    const prisma = {
      platformSetting: { findMany: async () => [] },
      resume: {
        findMany: async () => {
          if (deletedResumeIds.length) return [];
          return [
            { id: 'r1', pdfStoragePath: 'pdf/r1.pdf', sourceStoragePath: 'src/r1.docx' },
            { id: 'r2', pdfStoragePath: null, sourceStoragePath: null },
          ];
        },
        updateMany: async () => ({ count: 0 }),
        deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
          deletedResumeIds.push(...where.id.in);
          return { count: where.id.in.length };
        },
      },
      embeddingChunk: { deleteMany: async () => ({ count: 0 }) },
      profileEmbedding: { deleteMany: async () => ({ count: 0 }) },
      embedding: { deleteMany: async () => ({ count: 0 }) },
      resumeOptimization: { updateMany: async () => ({ count: 0 }) },
      whatsAppMessage: {
        findMany: async () => {
          if (deletedWa.length) return [];
          return [{ id: 'w1' }, { id: 'w2' }];
        },
        deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
          deletedWa.push(...where.id.in);
          return { count: where.id.in.length };
        },
      },
      aiInteraction: {
        findMany: async () => {
          if (deletedAi.length) return [];
          return [{ id: 'a1' }];
        },
        deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
          deletedAi.push(...where.id.in);
          return { count: where.id.in.length };
        },
      },
      auditLog: {
        findMany: async () => {
          if (deletedAudit.length) return [];
          return [{ id: 'l1' }, { id: 'l2' }, { id: 'l3' }];
        },
        deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
          deletedAudit.push(...where.id.in);
          return { count: where.id.in.length };
        },
      },
    };

    const storage = {
      isConfigured: () => true,
      deleteFile: async (path: string) => {
        files.push(path);
        return true;
      },
    };

    const svc = new RetentionService(prisma as never, storage as never);
    const result = await svc.runAll();
    assert.equal(result.resumesDeleted, 2);
    assert.equal(result.resumeFilesRemoved, 2);
    assert.equal(result.whatsappDeleted, 2);
    assert.equal(result.aiInteractionsDeleted, 1);
    assert.equal(result.auditLogsDeleted, 3);
    assert.equal(result.windows.resumeDays, 365);
    assert.equal(result.windows.whatsappDays, 90);
    assert.deepEqual(deletedResumeIds, ['r1', 'r2']);
    assert.deepEqual(files, ['pdf/r1.pdf', 'src/r1.docx']);
  });
});
