/**
 * SEC-CFG-003 worker shared-secret helper.
 * Run from apps/api:
 * node -r ts-node/register/transpile-only --test src/common/tasks/assert-task-secret.unit.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { assertTaskSecret, isTaskSecretRequired } from './assert-task-secret';
import { ResumesService } from '../../resumes/resumes.service';
import { WhatsAppController } from '../../whatsapp/whatsapp.controller';

const SECRET = 'test-task-secret';
const MSG = 'Invalid task secret.';

describe('isTaskSecretRequired', () => {
  it('is false in development-only mode', () => {
    assert.equal(isTaskSecretRequired({ NODE_ENV: 'development' }), false);
    assert.equal(isTaskSecretRequired({ NODE_ENV: 'test' }), false);
    assert.equal(isTaskSecretRequired({}), false);
  });

  it('is true when NODE_ENV is production', () => {
    assert.equal(isTaskSecretRequired({ NODE_ENV: 'production' }), true);
  });

  it('is true when GCP_PROJECT_ID is set', () => {
    assert.equal(isTaskSecretRequired({ NODE_ENV: 'development', GCP_PROJECT_ID: 'proj' }), true);
  });
});

describe('assertTaskSecret', () => {
  it('accepts the correct secret when configured', () => {
    assert.doesNotThrow(() =>
      assertTaskSecret(SECRET, SECRET, { requireConfigured: false, invalidMessage: MSG }),
    );
    assert.doesNotThrow(() =>
      assertTaskSecret(SECRET, SECRET, { requireConfigured: true, invalidMessage: MSG }),
    );
  });

  it('rejects a missing request credential when configured', () => {
    assert.throws(
      () => assertTaskSecret(SECRET, undefined, { requireConfigured: false, invalidMessage: MSG }),
      ForbiddenException,
    );
    assert.throws(
      () => assertTaskSecret(SECRET, '', { requireConfigured: true, invalidMessage: MSG }),
      ForbiddenException,
    );
  });

  it('rejects an incorrect request credential when configured', () => {
    assert.throws(
      () => assertTaskSecret(SECRET, 'wrong-secret', { requireConfigured: true, invalidMessage: MSG }),
      ForbiddenException,
    );
  });

  it('rejects unequal-length secrets without throwing from timingSafeEqual', () => {
    assert.throws(
      () => assertTaskSecret(SECRET, SECRET.slice(0, -1), { requireConfigured: true, invalidMessage: MSG }),
      ForbiddenException,
    );
    assert.throws(
      () => assertTaskSecret(SECRET, `${SECRET}!`, { requireConfigured: true, invalidMessage: MSG }),
      ForbiddenException,
    );
  });

  it('rejects non-string provided credentials safely', () => {
    assert.throws(
      () => assertTaskSecret(SECRET, 12345 as unknown as string, { requireConfigured: true, invalidMessage: MSG }),
      ForbiddenException,
    );
    assert.throws(
      () => assertTaskSecret(SECRET, null as unknown as string, { requireConfigured: true, invalidMessage: MSG }),
      ForbiddenException,
    );
  });

  it('compares multibyte UTF-8 secrets by exact byte equality', () => {
    const unicode = 'secrét-🔑-value';
    assert.doesNotThrow(() =>
      assertTaskSecret(unicode, unicode, { requireConfigured: true, invalidMessage: MSG }),
    );
    assert.throws(
      () => assertTaskSecret(unicode, 'secret-🔑-value', { requireConfigured: true, invalidMessage: MSG }),
      ForbiddenException,
    );
  });

  it('rejects an unconfigured secret when requireConfigured is true', () => {
    assert.throws(
      () => assertTaskSecret('', undefined, { requireConfigured: true, invalidMessage: MSG }),
      ForbiddenException,
    );
    assert.throws(
      () => assertTaskSecret('   ', undefined, { requireConfigured: true, invalidMessage: MSG }),
      ForbiddenException,
    );
    assert.throws(
      () => assertTaskSecret(undefined, undefined, { requireConfigured: true, invalidMessage: MSG }),
      ForbiddenException,
    );
  });

  it('allows an unconfigured secret only in development-only mode', () => {
    assert.doesNotThrow(() =>
      assertTaskSecret('', undefined, { requireConfigured: false, invalidMessage: MSG }),
    );
    assert.doesNotThrow(() =>
      assertTaskSecret(undefined, undefined, { requireConfigured: false, invalidMessage: MSG }),
    );
  });

  it('trims configured secrets before comparing (provided must match trimmed expected exactly)', () => {
    assert.doesNotThrow(() =>
      assertTaskSecret(`  ${SECRET}  `, SECRET, { requireConfigured: true, invalidMessage: MSG }),
    );
    assert.throws(
      () => assertTaskSecret(SECRET, `  ${SECRET}  `, { requireConfigured: true, invalidMessage: MSG }),
      ForbiddenException,
    );
  });
});

/* ---- Call-site wiring (in-memory only; proves both endpoints use the helper) ---- */

const ENV_KEYS = ['NODE_ENV', 'GCP_PROJECT_ID', 'RESUME_TASK_SECRET', 'WHATSAPP_TASK_SECRET'] as const;

function withEnv(patch: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>, fn: () => Promise<void> | void) {
  const prior: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) {
    prior[key] = process.env[key];
    if (patch[key] === undefined) delete process.env[key];
    else if (key in patch) process.env[key] = patch[key] as string;
  }
  return Promise.resolve()
    .then(() => fn())
    .finally(() => {
      for (const key of ENV_KEYS) {
        if (prior[key] === undefined) delete process.env[key];
        else process.env[key] = prior[key];
      }
    });
}

function resumeService(configSecret: string | undefined) {
  const processorCalls: unknown[] = [];
  const svc = new ResumesService(
    {
      candidate: { findUnique: async () => ({ id: 'cand-1' }) },
      resume: { findFirst: async () => ({ id: 'resume-1' }) },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      processUploadedResume: async (...args: unknown[]) => {
        processorCalls.push(args);
        return { ok: true };
      },
    } as never,
    { get: (key: string) => (key === 'RESUME_TASK_SECRET' ? configSecret : undefined) } as never,
  );
  return { svc, processorCalls };
}

describe('ResumesService.processWorker uses assertTaskSecret', () => {
  it('accepts a correct secret and rejects missing/wrong credentials', async () => {
    await withEnv({ NODE_ENV: 'development', GCP_PROJECT_ID: undefined, RESUME_TASK_SECRET: undefined }, async () => {
      const { svc, processorCalls } = resumeService(SECRET);
      await svc.processWorker({ resumeId: 'resume-1', userId: 'user-1' }, SECRET);
      assert.equal(processorCalls.length, 1);
      await assert.rejects(svc.processWorker({ resumeId: 'resume-1', userId: 'user-1' }, undefined), ForbiddenException);
      await assert.rejects(svc.processWorker({ resumeId: 'resume-1', userId: 'user-1' }, 'wrong'), ForbiddenException);
    });
  });

  it('rejects an unconfigured secret when GCP_PROJECT_ID is set', async () => {
    await withEnv({ NODE_ENV: 'development', GCP_PROJECT_ID: 'proj', RESUME_TASK_SECRET: undefined }, async () => {
      const { svc, processorCalls } = resumeService(undefined);
      await assert.rejects(svc.processWorker({ resumeId: 'resume-1', userId: 'user-1' }, undefined), ForbiddenException);
      assert.equal(processorCalls.length, 0);
    });
  });

  it('allows an unconfigured secret in development-only mode', async () => {
    await withEnv({ NODE_ENV: 'development', GCP_PROJECT_ID: undefined, RESUME_TASK_SECRET: undefined }, async () => {
      const { svc, processorCalls } = resumeService(undefined);
      await svc.processWorker({ resumeId: 'resume-1', userId: 'user-1' }, undefined);
      assert.equal(processorCalls.length, 1);
    });
  });
});

describe('WhatsAppController.runTask uses assertTaskSecret', () => {
  const controller = () =>
    new WhatsAppController({} as never, {} as never, {} as never);

  it('accepts a correct secret and rejects missing/wrong credentials', async () => {
    await withEnv(
      { NODE_ENV: 'development', GCP_PROJECT_ID: undefined, WHATSAPP_TASK_SECRET: SECRET },
      async () => {
        const res = await controller().runTask(SECRET, { type: 'unknown_task' });
        assert.deepEqual(res, { ok: false, reason: 'unknown_task' });
        await assert.rejects(controller().runTask(undefined, { type: 'unknown_task' }), ForbiddenException);
        await assert.rejects(controller().runTask('wrong', { type: 'unknown_task' }), ForbiddenException);
      },
    );
  });

  it('rejects an unconfigured secret in production', async () => {
    await withEnv(
      { NODE_ENV: 'production', GCP_PROJECT_ID: undefined, WHATSAPP_TASK_SECRET: undefined },
      async () => {
        await assert.rejects(controller().runTask(undefined, { type: 'unknown_task' }), ForbiddenException);
      },
    );
  });

  it('allows an unconfigured secret in development-only mode', async () => {
    await withEnv(
      { NODE_ENV: 'development', GCP_PROJECT_ID: undefined, WHATSAPP_TASK_SECRET: undefined },
      async () => {
        const res = await controller().runTask(undefined, { type: 'unknown_task' });
        assert.deepEqual(res, { ok: false, reason: 'unknown_task' });
      },
    );
  });
});
