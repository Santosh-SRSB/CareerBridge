/**
 * Apply / withdraw / reapply ownership rules for candidate applications.
 * Run: node -r ts-node/register/transpile-only --test src/applications/applications-withdraw.unit.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ApplicationsService } from './applications.service';

type Row = Record<string, any>;

const CANDIDATE = {
  id: 'cand-1',
  userId: 'user-1',
  firstName: 'Asha',
  lastName: 'Patel',
};
const OTHER = { id: 'cand-2', userId: 'user-2', firstName: 'Other', lastName: 'User' };
const JOB = {
  id: 'job-1',
  title: 'Backend Developer',
  status: 'PUBLISHED',
  city: 'Pune',
  salaryMin: 500000,
  salaryMax: 800000,
  jobType: 'FULL_TIME',
  category: 'Engineering',
  requiredSkills: '[]',
  preferredSkills: '[]',
  employer: { userId: 'emp-user', companyName: 'Acme Pvt Ltd' },
};

function withJob(row: Row) {
  return { ...row, job: JOB };
}

function httpStatus(err: unknown) {
  return (err as { getStatus?: () => number }).getStatus?.() ?? (err as { status?: number }).status;
}

function harness(seed: { applications?: Row[]; resumes?: Row[] } = {}) {
  const applications = [...(seed.applications || [])];
  const resumes = seed.resumes || [
    { id: 'resume-1', candidateId: CANDIDATE.id, version: 1, archivedAt: null, processingStatus: null },
  ];
  const notifications: Row[] = [];
  let idSeq = 1;

  const prisma: any = {
    candidate: {
      findUnique: async ({ where }: Row) =>
        [CANDIDATE, OTHER].find((c) => c.userId === where.userId) ?? null,
    },
    job: {
      findUnique: async ({ where }: Row) => (where.id === JOB.id ? JOB : null),
    },
    application: {
      findUnique: async ({ where }: Row) => {
        if (where.candidateId_jobId) {
          const { candidateId, jobId } = where.candidateId_jobId;
          const row = applications.find((a) => a.candidateId === candidateId && a.jobId === jobId) ?? null;
          return row ? withJob(row) : null;
        }
        const row = applications.find((a) => a.id === where.id) ?? null;
        return row ? withJob(row) : null;
      },
      findFirst: async ({ where }: Row) => {
        const row =
          applications.find((a) => {
            if (where.id && a.id !== where.id) return false;
            if (where.candidateId && a.candidateId !== where.candidateId) return false;
            if (where.jobId && a.jobId !== where.jobId) return false;
            if (where.status?.not && a.status === where.status.not) return false;
            return true;
          }) ?? null;
        return row ? withJob(row) : null;
      },
      findMany: async ({ where }: Row) =>
        applications
          .filter((a) => {
            if (where.candidateId && a.candidateId !== where.candidateId) return false;
            if (where.status?.not && a.status === where.status.not) return false;
            return true;
          })
          .map(withJob),
      create: async ({ data }: Row) => {
        const row = {
          id: `app-${idSeq++}`,
          status: 'APPLIED',
          createdAt: new Date('2026-10-01T10:00:00Z'),
          updatedAt: new Date('2026-10-01T10:00:00Z'),
          resumeId: data.resumeId ?? null,
          resumeVersion: data.resumeVersion ?? null,
          ...data,
        };
        applications.push(row);
        return withJob(row);
      },
      update: async ({ where, data }: Row) => {
        const row = applications.find((a) => a.id === where.id);
        if (!row) throw new Error('missing');
        Object.assign(row, data, { updatedAt: new Date() });
        return withJob(row);
      },
      updateMany: async ({ where, data }: Row) => {
        let count = 0;
        for (const row of applications) {
          if (where.id && row.id !== where.id) continue;
          if (where.candidateId && row.candidateId !== where.candidateId) continue;
          if (where.status?.not && row.status === where.status.not) continue;
          Object.assign(row, data, { updatedAt: new Date() });
          count += 1;
        }
        return { count };
      },
      count: async ({ where }: Row) =>
        applications.filter((a) => {
          if (where.candidateId && a.candidateId !== where.candidateId) return false;
          if (where.status?.not && a.status === where.status.not) return false;
          return true;
        }).length,
    },
    resume: {
      findFirst: async ({ where }: Row) => {
        return (
          resumes.find((r) => {
            if (where.id && r.id !== where.id) return false;
            if (where.candidateId && r.candidateId !== where.candidateId) return false;
            if (where.archivedAt !== undefined && r.archivedAt != null) return false;
            return true;
          }) ?? null
        );
      },
    },
  };

  const matching = { recomputeMatchesForJob: async () => undefined };
  const notificationsSvc = {
    create: async (payload: Row) => {
      notifications.push(payload);
    },
  };
  const testimonials = { markEligible: async () => undefined };
  const config = { get: (_key: string, fallback?: unknown) => fallback };

  const svc = new ApplicationsService(
    prisma,
    matching as any,
    notificationsSvc as any,
    {} as any,
    {} as any,
    config as any,
    testimonials as any,
    {} as any,
  );

  return { svc, applications, notifications };
}

describe('ApplicationsService apply / withdraw / reapply', () => {
  it('creates an application on first apply', async () => {
    const { svc, applications } = harness();
    const result = await svc.apply(CANDIDATE.userId, JOB.id);
    assert.equal(result.status, 'APPLIED');
    assert.equal(applications.length, 1);
    assert.equal(applications[0]!.status, 'APPLIED');
  });

  it('rejects a second active application for the same job', async () => {
    const { svc } = harness({
      applications: [
        {
          id: 'app-1',
          candidateId: CANDIDATE.id,
          jobId: JOB.id,
          status: 'APPLIED',
          resumeId: 'resume-1',
          resumeVersion: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    await assert.rejects(
      () => svc.apply(CANDIDATE.userId, JOB.id),
      (err) => httpStatus(err) === 409 && err instanceof ConflictException,
    );
  });

  it('withdraws an owned application and keeps the record as WITHDRAWN', async () => {
    const { svc, applications } = harness({
      applications: [
        {
          id: 'app-1',
          candidateId: CANDIDATE.id,
          jobId: JOB.id,
          status: 'UNDER_REVIEW',
          resumeId: 'resume-1',
          resumeVersion: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    const result = await svc.withdraw(CANDIDATE.userId, 'app-1');
    assert.equal(result.status, 'WITHDRAWN');
    assert.equal(applications[0]!.status, 'WITHDRAWN');
    assert.equal(applications.length, 1, 'history preserved');
  });

  it('refuses withdrawing another candidate application', async () => {
    const { svc } = harness({
      applications: [
        {
          id: 'app-other',
          candidateId: OTHER.id,
          jobId: JOB.id,
          status: 'APPLIED',
          resumeId: null,
          resumeVersion: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    await assert.rejects(
      () => svc.withdraw(CANDIDATE.userId, 'app-other'),
      (err) => httpStatus(err) === 404 && err instanceof NotFoundException,
    );
  });

  it('refuses withdrawing an already withdrawn application', async () => {
    const { svc } = harness({
      applications: [
        {
          id: 'app-1',
          candidateId: CANDIDATE.id,
          jobId: JOB.id,
          status: 'WITHDRAWN',
          resumeId: 'resume-1',
          resumeVersion: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    await assert.rejects(
      () => svc.withdraw(CANDIDATE.userId, 'app-1'),
      (err) => httpStatus(err) === 409 && err instanceof ConflictException,
    );
  });

  it('allows reapply after withdrawal by reactivating the same row', async () => {
    const { svc, applications } = harness({
      applications: [
        {
          id: 'app-1',
          candidateId: CANDIDATE.id,
          jobId: JOB.id,
          status: 'WITHDRAWN',
          resumeId: 'resume-1',
          resumeVersion: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    const result = await svc.apply(CANDIDATE.userId, JOB.id);
    assert.equal(result.status, 'APPLIED');
    assert.equal(applications.length, 1);
    assert.equal(applications[0]!.id, 'app-1');
    assert.equal(applications[0]!.status, 'APPLIED');
  });
});
