import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminController } from './admin.controller';
import { AdminAccountDeletionService } from './admin-account-deletion.service';

type Row = Record<string, any>;

const SECRET_MARKERS = ['passwordHash', 'password_hash', 'loginPassword', 'tokenHash', 'refreshToken', 'Bearer ', 'eyJ'];
const CAND_A = '11111111-1111-4111-8111-111111111111';
const CAND_B = '22222222-2222-4222-8222-222222222222';
const EMP_A = '33333333-3333-4333-8333-333333333333';

/* ---------- in-memory store with the schema's cascades ---------- */

function seed() {
  return {
    users: [
      { id: 'u-sa', userType: 'SUPER_ADMIN', status: 'ACTIVE', passwordHash: 'v2:secret' },
      { id: 'u-sa2', userType: 'SUPER_ADMIN', status: 'SUSPENDED', passwordHash: 'v2:secret' },
      { id: 'u-ops', userType: 'PLATFORM_OPERATOR', status: 'SUSPENDED', passwordHash: 'v2:secret' },
      { id: 'u-pa', userType: 'PLATFORM_ADMIN', status: 'ACTIVE', passwordHash: 'v2:secret' },
      { id: 'u-pa-mixed', userType: 'PLATFORM_ADMIN', status: 'ACTIVE', passwordHash: 'v2:secret' },
      { id: 'u-ca', userType: 'CANDIDATE', status: 'SUSPENDED', passwordHash: 'v2:secret' },
      { id: 'u-cb', userType: 'CANDIDATE', status: 'ACTIVE', passwordHash: 'v2:secret' },
      { id: 'u-ea', userType: 'EMPLOYER_ADMIN', status: 'INACTIVE', passwordHash: 'v2:secret' },
      { id: 'u-eb', userType: 'EMPLOYER_ADMIN', status: 'SUSPENDED', passwordHash: 'v2:secret' },
      { id: 'u-ec', userType: 'EMPLOYER_ADMIN', status: 'ACTIVE', passwordHash: 'v2:secret' },
    ] as Row[],
    admins: [
      { id: 'a-sa', userId: 'u-sa', email: 'sa@x.in', fullName: 'Root', status: 'ACTIVE', loginPassword: 'plain-1' },
      { id: 'a-sa2', userId: 'u-sa2', email: 'sa2@x.in', fullName: 'Root 2', status: 'SUSPENDED', loginPassword: 'plain-2' },
      { id: 'a-ops', userId: 'u-ops', email: 'ops@x.in', fullName: 'Ops', status: 'SUSPENDED', loginPassword: 'plain-3' },
      { id: 'a-pa', userId: 'u-pa', email: 'pa@x.in', fullName: 'Admin', status: 'ACTIVE', loginPassword: 'plain-4' },
      { id: 'a-mixed', userId: 'u-pa-mixed', email: 'mx@x.in', fullName: null, status: 'SUSPENDED', loginPassword: null },
    ] as Row[],
    candidates: [
      { id: CAND_A, userId: 'u-ca', firstName: 'Asha', lastName: 'R' },
      { id: CAND_B, userId: 'u-cb', firstName: 'Bala', lastName: 'K' },
    ] as Row[],
    employers: [
      { id: EMP_A, userId: 'u-ea', companyName: 'Acme' },
      { id: 'e-b', userId: 'u-eb', companyName: 'Paid Co' },
      { id: 'e-c', userId: 'u-ec', companyName: 'Live Co' },
    ] as Row[],
    jobs: [
      { id: 'j-a1', employerId: EMP_A },
      { id: 'j-a2', employerId: EMP_A },
      { id: 'j-b1', employerId: 'e-b' },
      { id: 'j-c1', employerId: 'e-c' },
    ] as Row[],
    resumes: [
      { id: 'r-a1', candidateId: CAND_A, pdfStoragePath: 'resumes/a1.pdf', sourceStoragePath: 'uploads/a1.docx' },
      { id: 'r-b1', candidateId: CAND_B, pdfStoragePath: 'resumes/b1.pdf', sourceStoragePath: null },
    ] as Row[],
    applications: [
      { id: 'ap-1', candidateId: CAND_A, jobId: 'j-a1', status: 'HIRED' },
      { id: 'ap-2', candidateId: CAND_A, jobId: 'j-c1', status: 'INTERVIEW' },
      { id: 'ap-3', candidateId: CAND_B, jobId: 'j-a1', status: 'SHORTLISTED' },
      { id: 'ap-4', candidateId: CAND_B, jobId: 'j-c1', status: 'APPLIED' },
    ] as Row[],
    interviews: [
      { id: 'iv-1', candidateId: CAND_A, employerId: EMP_A, jobId: 'j-a1', applicationId: 'ap-1' },
      { id: 'iv-2', candidateId: CAND_A, employerId: 'e-c', jobId: 'j-c1', applicationId: 'ap-2' },
      { id: 'iv-3', candidateId: CAND_B, employerId: EMP_A, jobId: 'j-a1', applicationId: 'ap-3' },
    ] as Row[],
    hiringOutcomes: [{ id: 'ho-1', employerId: EMP_A, applicationId: 'ap-1' }] as Row[],
    payments: [
      { id: 'p-a', employerId: EMP_A, jobId: 'j-a1', amountPaise: 0, status: 'PAID', hiringOutcomeId: 'ho-1' },
      { id: 'p-b', employerId: 'e-b', jobId: 'j-b1', amountPaise: 99900, status: 'PAID', hiringOutcomeId: null },
      { id: 'p-c', employerId: 'e-c', jobId: 'j-c1', amountPaise: 499900, status: 'PAID', hiringOutcomeId: null },
    ] as Row[],
    mockInterviews: [{ id: 'mi-1', candidateId: CAND_A }] as Row[],
    matches: [
      { id: 'm-1', candidateId: CAND_A, jobId: 'j-c1' },
      { id: 'm-2', candidateId: CAND_B, jobId: 'j-c1' },
      { id: 'm-3', candidateId: CAND_B, jobId: 'j-a1' },
    ] as Row[],
    chunks: [
      { id: 'ch-1', candidateId: CAND_A, resumeId: 'r-a1', jobId: null },
      { id: 'ch-2', candidateId: CAND_B, resumeId: 'r-b1', jobId: null },
      { id: 'ch-3', candidateId: null, resumeId: null, jobId: 'j-a1' },
      { id: 'ch-4', candidateId: null, resumeId: null, jobId: 'j-c1' },
    ] as Row[],
    profileEmbeddings: [
      { id: 'pe-1', entityType: 'CANDIDATE', entityId: CAND_A },
      { id: 'pe-2', entityType: 'CANDIDATE', entityId: CAND_B },
      { id: 'pe-3', entityType: 'JOB', entityId: 'j-a2' },
      { id: 'pe-4', entityType: 'JOB', entityId: 'j-c1' },
    ] as Row[],
    legacyEmbeddings: [{ id: 'le-1', entityId: 'r-a1' }, { id: 'le-2', entityId: 'j-c1' }] as Row[],
    audits: [] as Row[],
  };
}

type Store = ReturnType<typeof seed>;

function matchValue(value: unknown, cond: any): boolean {
  if (cond && typeof cond === 'object') {
    if ('in' in cond) return cond.in.includes(value);
    if ('gt' in cond) return (value as number) > cond.gt;
  }
  return value === cond;
}

function matchWhere(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, cond]) =>
    key === 'OR' ? (cond as Row[]).some((w) => matchWhere(row, w)) : matchValue(row[key], cond),
  );
}

function removeWhere(list: Row[], pred: (r: Row) => boolean): number {
  let n = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    if (pred(list[i]!)) {
      list.splice(i, 1);
      n++;
    }
  }
  return n;
}

/** Applies ON DELETE CASCADE / SET NULL exactly as schema.prisma declares them. */
function cascadeUser(s: Store, userId: string) {
  removeWhere(s.admins, (a) => a.userId === userId);
  const candIds = s.candidates.filter((c) => c.userId === userId).map((c) => c.id);
  const empIds = s.employers.filter((e) => e.userId === userId).map((e) => e.id);
  removeWhere(s.candidates, (c) => candIds.includes(c.id));
  removeWhere(s.employers, (e) => empIds.includes(e.id));
  const jobIds = s.jobs.filter((j) => empIds.includes(j.employerId)).map((j) => j.id);
  removeWhere(s.jobs, (j) => jobIds.includes(j.id));
  removeWhere(s.resumes, (r) => candIds.includes(r.candidateId));
  removeWhere(s.mockInterviews, (m) => candIds.includes(m.candidateId));
  const appIds = s.applications
    .filter((a) => candIds.includes(a.candidateId) || jobIds.includes(a.jobId))
    .map((a) => a.id);
  removeWhere(s.applications, (a) => appIds.includes(a.id));
  removeWhere(
    s.interviews,
    (i) => appIds.includes(i.applicationId) || candIds.includes(i.candidateId) || empIds.includes(i.employerId),
  );
  const outcomeIds = s.hiringOutcomes
    .filter((h) => appIds.includes(h.applicationId) || empIds.includes(h.employerId))
    .map((h) => h.id);
  removeWhere(s.hiringOutcomes, (h) => outcomeIds.includes(h.id));
  removeWhere(s.payments, (p) => empIds.includes(p.employerId));
  for (const p of s.payments) {
    if (outcomeIds.includes(p.hiringOutcomeId)) p.hiringOutcomeId = null;
    if (jobIds.includes(p.jobId)) p.jobId = null;
  }
  removeWhere(s.matches, (m) => jobIds.includes(m.jobId));
}

function fakePrisma(s: Store, hooks: { beforeUserDelete?: () => void } = {}) {
  const delegates = {
    candidate: {
      findUnique: async ({ where }: Row) => {
        const c = s.candidates.find((x) => x.id === where.id);
        if (!c) return null;
        const u = s.users.find((x) => x.id === c.userId)!;
        return {
          ...c,
          user: { email: `${c.firstName.toLowerCase()}@mail.in`, status: u.status, userType: u.userType },
          resumes: s.resumes
            .filter((r) => r.candidateId === c.id)
            .map((r) => ({ id: r.id, pdfStoragePath: r.pdfStoragePath, sourceStoragePath: r.sourceStoragePath })),
          _count: {
            applications: s.applications.filter((a) => a.candidateId === c.id).length,
            resumes: s.resumes.filter((r) => r.candidateId === c.id).length,
            employerInterviews: s.interviews.filter((i) => i.candidateId === c.id).length,
            interviews: s.mockInterviews.filter((m) => m.candidateId === c.id).length,
            humanMockInterviews: 0,
            skillAssessments: 0,
            savedJobs: 0,
          },
        };
      },
    },
    employer: {
      findUnique: async ({ where }: Row) => {
        const e = s.employers.find((x) => x.id === where.id);
        if (!e) return null;
        const u = s.users.find((x) => x.id === e.userId)!;
        return {
          ...e,
          user: { email: `${e.id}@co.in`, status: u.status, userType: u.userType },
          jobs: s.jobs.filter((j) => j.employerId === e.id).map((j) => ({ id: j.id })),
          _count: {
            jobs: s.jobs.filter((j) => j.employerId === e.id).length,
            interviews: s.interviews.filter((i) => i.employerId === e.id).length,
            hiringOutcomes: s.hiringOutcomes.filter((h) => h.employerId === e.id).length,
            payments: s.payments.filter((p) => p.employerId === e.id).length,
          },
        };
      },
    },
    admin: {
      findUnique: async ({ where }: Row) => {
        const a = s.admins.find((x) => x.id === where.id);
        if (!a) return null;
        const u = s.users.find((x) => x.id === a.userId)!;
        return { ...a, user: { status: u.status, userType: u.userType } };
      },
    },
    application: {
      count: async ({ where }: Row) =>
        s.applications.filter((a) => s.jobs.find((j) => j.id === a.jobId)?.employerId === where.job.employerId).length,
    },
    employerPayment: {
      count: async ({ where }: Row) => s.payments.filter((p) => matchWhere(p, where)).length,
    },
    user: {
      deleteMany: async ({ where }: Row) => {
        hooks.beforeUserDelete?.();
        const targets = s.users.filter((u) => matchWhere(u, where));
        for (const u of targets) {
          removeWhere(s.users, (x) => x.id === u.id);
          cascadeUser(s, u.id);
        }
        return { count: targets.length };
      },
    },
    candidateMatch: { deleteMany: async ({ where }: Row) => ({ count: removeWhere(s.matches, (r) => matchWhere(r, where)) }) },
    embeddingChunk: { deleteMany: async ({ where }: Row) => ({ count: removeWhere(s.chunks, (r) => matchWhere(r, where)) }) },
    profileEmbedding: {
      deleteMany: async ({ where }: Row) => ({ count: removeWhere(s.profileEmbeddings, (r) => matchWhere(r, where)) }),
    },
    embedding: {
      deleteMany: async ({ where }: Row) => ({ count: removeWhere(s.legacyEmbeddings, (r) => matchWhere(r, where)) }),
    },
    auditLog: { create: async ({ data }: Row) => (s.audits.push(data), data) },
  };
  return {
    ...delegates,
    /** Interactive transaction: any throw restores the snapshot (rollback). */
    $transaction: async (fn: (tx: typeof delegates) => Promise<unknown>) => {
      const snapshot = JSON.parse(JSON.stringify(s));
      try {
        return await fn(delegates);
      } catch (err) {
        for (const key of Object.keys(s) as Array<keyof Store>) (s as Row)[key] = snapshot[key];
        throw err;
      }
    },
  };
}

function setup(hooks?: { beforeUserDelete?: () => void }, storageFails = false) {
  const store = seed();
  const deleted: string[] = [];
  const storage = {
    isConfigured: () => true,
    deleteFile: async (p: string) => {
      if (storageFails) throw new Error('gcs down');
      deleted.push(p);
      return true;
    },
  };
  const service = new AdminAccountDeletionService(fakePrisma(store, hooks) as never, storage as never);
  return { store, service, deleted };
}

function noSecrets(value: unknown) {
  const text = JSON.stringify(value);
  for (const marker of SECRET_MARKERS) assert.equal(text.includes(marker), false, `leaked ${marker}`);
  assert.equal(text.includes('v2:secret'), false);
  assert.equal(/plain-\d/.test(text), false);
}

/* ---------- candidates ---------- */

describe('Super Admin deletion — candidates', () => {
  it('deletes a suspended candidate with dependants, vectors, matches and files; other candidates untouched', async () => {
    const { store, service, deleted } = setup();
    const result = await service.deleteCandidate('u-sa', CAND_A);
    assert.deepEqual(result, { deleted: true, kind: 'CANDIDATE', id: CAND_A, displayName: 'Asha R' });
    assert.equal(store.users.some((u) => u.id === 'u-ca'), false);
    assert.equal(store.candidates.some((c) => c.id === CAND_A), false);
    assert.deepEqual(store.applications.map((a) => a.id).sort(), ['ap-3', 'ap-4']);
    assert.deepEqual(store.interviews.map((i) => i.id), ['iv-3']);
    assert.deepEqual(store.matches.map((m) => m.id).sort(), ['m-2', 'm-3']);
    assert.deepEqual(store.chunks.map((c) => c.id).sort(), ['ch-2', 'ch-3', 'ch-4']);
    assert.deepEqual(store.profileEmbeddings.map((p) => p.id).sort(), ['pe-2', 'pe-3', 'pe-4']);
    assert.deepEqual(store.legacyEmbeddings.map((p) => p.id), ['le-2']);
    assert.equal(store.mockInterviews.length, 0);
    assert.ok(store.candidates.some((c) => c.id === CAND_B), 'other candidate kept');
    assert.ok(deleted.includes('resumes/a1.pdf') && deleted.includes('uploads/a1.docx'));
    assert.ok(deleted.some((p) => p.includes(`profile-photo-${CAND_A}`)));
    assert.equal(deleted.includes('resumes/b1.pdf'), false);
  });

  it('keeps the employer payment for a hired candidate (hiring fee history is the employer’s)', async () => {
    const { store, service } = setup();
    await service.deleteCandidate('u-sa', CAND_A);
    const payment = store.payments.find((p) => p.id === 'p-a')!;
    assert.ok(payment, 'payment retained');
    assert.equal(payment.hiringOutcomeId, null);
    assert.equal(store.hiringOutcomes.length, 0);
  });

  it('writes one DELETE_CANDIDATE audit row with no passwords, hashes or tokens', async () => {
    const { store, service } = setup();
    await service.deleteCandidate('u-sa', CAND_A);
    assert.equal(store.audits.length, 1);
    const audit = store.audits[0]!;
    assert.equal(audit.action, 'DELETE_CANDIDATE');
    assert.equal(audit.resourceType, 'CANDIDATE');
    assert.equal(audit.resourceId, CAND_A);
    assert.equal(audit.userId, 'u-sa');
    const old = JSON.parse(audit.oldValue);
    assert.equal(old.status, 'SUSPENDED');
    assert.equal(old.userId, 'u-ca');
    assert.equal(JSON.parse(audit.newValue).removed['Job applications'], 2);
    noSecrets(audit);
  });

  it('deletes an inactive account too', async () => {
    const { store, service } = setup();
    store.users.find((u) => u.id === 'u-ca')!.status = 'INACTIVE';
    await service.deleteCandidate('u-sa', CAND_A);
    assert.equal(store.candidates.some((c) => c.id === CAND_A), false);
  });

  it('refuses an active candidate with 409 and changes nothing', async () => {
    const { store, service, deleted } = setup();
    const before = JSON.stringify(store);
    await assert.rejects(service.deleteCandidate('u-sa', CAND_B), (err: unknown) => {
      assert.ok(err instanceof ConflictException);
      assert.match(String((err.getResponse() as Row).message), /suspended or inactive/);
      return true;
    });
    assert.equal(JSON.stringify(store), before);
    assert.equal(deleted.length, 0);
  });

  it('rolls back if the account is re-activated between the check and the delete', async () => {
    const { store, service } = setup({
      beforeUserDelete: () => {
        store.users.find((u) => u.id === 'u-ca')!.status = 'ACTIVE';
      },
    });
    await assert.rejects(service.deleteCandidate('u-sa', CAND_A), ConflictException);
    assert.ok(store.candidates.some((c) => c.id === CAND_A));
    assert.equal(store.matches.length, 3);
    assert.equal(store.audits.length, 0);
  });

  it('404 for an unknown candidate', async () => {
    const { service } = setup();
    await assert.rejects(service.deleteCandidate('u-sa', 'missing'), NotFoundException);
    await assert.rejects(service.candidatePreview('missing'), NotFoundException);
  });

  it('preview lists status, blockers and related counts without secrets', async () => {
    const { service } = setup();
    const ok = await service.candidatePreview(CAND_A);
    assert.equal(ok.deletable, true);
    assert.equal(ok.accountStatus, 'SUSPENDED');
    assert.deepEqual(ok.related.slice(0, 3), [
      { label: 'Job applications', count: 2 },
      { label: 'Employer interviews', count: 2 },
      { label: 'Resumes', count: 1 },
    ]);
    const blocked = await service.candidatePreview(CAND_B);
    assert.equal(blocked.deletable, false);
    assert.equal(blocked.blockers.length, 1);
    noSecrets([ok, blocked]);
  });

  it('a storage failure after commit does not undo the deletion', async () => {
    const { store, service } = setup(undefined, true);
    await service.deleteCandidate('u-sa', CAND_A);
    assert.equal(store.candidates.some((c) => c.id === CAND_A), false);
    assert.equal(store.audits.length, 1);
  });
});

/* ---------- employers ---------- */

describe('Super Admin deletion — employers', () => {
  it('deletes an inactive employer with its jobs, interviews, job vectors and ₹0 payment records', async () => {
    const { store, service, deleted } = setup();
    await service.deleteEmployer('u-sa', EMP_A);
    assert.equal(store.employers.some((e) => e.id === EMP_A), false);
    assert.equal(store.users.some((u) => u.id === 'u-ea'), false);
    assert.deepEqual(store.jobs.map((j) => j.id).sort(), ['j-b1', 'j-c1']);
    assert.deepEqual(store.applications.map((a) => a.id).sort(), ['ap-2', 'ap-4']);
    assert.deepEqual(store.interviews.map((i) => i.id), ['iv-2']);
    assert.deepEqual(store.chunks.map((c) => c.id).sort(), ['ch-1', 'ch-2', 'ch-4']);
    assert.deepEqual(store.profileEmbeddings.map((p) => p.id).sort(), ['pe-1', 'pe-2', 'pe-4']);
    assert.equal(store.payments.some((p) => p.id === 'p-a'), false);
    assert.ok(store.payments.some((p) => p.id === 'p-b') && store.payments.some((p) => p.id === 'p-c'));
    assert.equal(store.candidates.length, 2, 'candidate accounts are kept');
    assert.ok(deleted.some((p) => p.includes(EMP_A)), 'company logo removed');
    const audit = store.audits[0]!;
    assert.equal(audit.action, 'DELETE_EMPLOYER');
    assert.equal(JSON.parse(audit.newValue).removed['Candidate applications to these jobs'], 2);
    noSecrets(audit);
  });

  it('refuses a suspended employer that has charged payments (revenue history)', async () => {
    const { store, service } = setup();
    const before = JSON.stringify(store);
    const preview = await service.employerPreview('e-b');
    assert.equal(preview.deletable, false);
    assert.match(preview.blockers.join(' '), /revenue history/);
    await assert.rejects(service.deleteEmployer('u-sa', 'e-b'), ConflictException);
    assert.equal(JSON.stringify(store), before);
  });

  it('refuses an active employer', async () => {
    const { store, service } = setup();
    await assert.rejects(service.deleteEmployer('u-sa', 'e-c'), ConflictException);
    assert.ok(store.employers.some((e) => e.id === 'e-c'));
    assert.equal(store.audits.length, 0);
  });

  it('404 for an unknown employer', async () => {
    const { service } = setup();
    await assert.rejects(service.deleteEmployer('u-sa', 'nope'), NotFoundException);
  });
});

/* ---------- staff ---------- */

describe('Super Admin deletion — admins', () => {
  it('deletes a suspended operator and audits it without the stored login password', async () => {
    const { store, service } = setup();
    await service.deleteAdmin('u-sa', 'a-ops');
    assert.equal(store.admins.some((a) => a.id === 'a-ops'), false);
    assert.equal(store.users.some((u) => u.id === 'u-ops'), false);
    const audit = store.audits[0]!;
    assert.equal(audit.action, 'DELETE_ADMIN');
    assert.equal(JSON.parse(audit.oldValue).email, 'ops@x.in');
    noSecrets(audit);
  });

  it('never deletes a Super Admin, even a suspended one', async () => {
    const { store, service } = setup();
    const preview = await service.adminPreview('u-sa', 'a-sa2');
    assert.equal(preview.deletable, false);
    assert.match(preview.blockers.join(' '), /Super Admin accounts cannot be deleted/);
    await assert.rejects(service.deleteAdmin('u-sa', 'a-sa2'), ConflictException);
    assert.ok(store.admins.some((a) => a.id === 'a-sa2'));
  });

  it('refuses self-deletion', async () => {
    const { service } = setup();
    const preview = await service.adminPreview('u-ops', 'a-ops');
    assert.match(preview.blockers.join(' '), /your own account/);
    await assert.rejects(service.deleteAdmin('u-ops', 'a-ops'), ConflictException);
  });

  it('refuses an active admin, and one whose login is still active', async () => {
    const { store, service } = setup();
    await assert.rejects(service.deleteAdmin('u-sa', 'a-pa'), ConflictException);
    await assert.rejects(service.deleteAdmin('u-sa', 'a-mixed'), ConflictException);
    assert.equal(store.admins.length, 5);
    assert.equal(store.audits.length, 0);
  });

  it('preview never includes the stored login password', async () => {
    const { service } = setup();
    noSecrets(await service.adminPreview('u-sa', 'a-ops'));
  });
});

/* ---------- routes ---------- */

describe('Super Admin deletion — authorization', () => {
  const guard = new RolesGuard(new Reflector());
  const handlers = [
    'candidateDeletionPreview',
    'deleteCandidate',
    'employerDeletionPreview',
    'deleteEmployer',
    'adminDeletionPreview',
    'deleteAdmin',
  ] as const;
  for (const name of handlers) {
    const handler = (AdminController.prototype as any)[name];
    const ctx = (role?: string) =>
      ({
        getHandler: () => handler,
        getClass: () => AdminController,
        switchToHttp: () => ({ getRequest: () => ({ user: role ? { id: 'u', role } : undefined }) }),
      }) as never;

    it(`${name}: Super Admin only`, () => {
      assert.deepEqual(Reflect.getMetadata(ROLES_KEY, handler), ['SUPER_ADMIN']);
      assert.equal(guard.canActivate(ctx('SUPER_ADMIN')), true);
    });
    it(`${name}: Admin, Operator, Candidate and Employer get 403`, () => {
      for (const role of ['PLATFORM_ADMIN', 'PLATFORM_OPERATOR', 'CANDIDATE', 'EMPLOYER_ADMIN', 'EMPLOYER_RECRUITER']) {
        assert.equal(guard.canActivate(ctx(role)), false, role);
      }
    });
    it(`${name}: not public — unauthenticated requests get 401 from the global JWT guard`, () => {
      assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, handler), undefined);
      assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, AdminController), undefined);
      assert.equal(guard.canActivate(ctx(undefined)), false);
    });
  }

  it('routes pass the signed-in Super Admin as the actor and the explicit target id', async () => {
    const calls: unknown[][] = [];
    const record = (name: string) => async (...args: unknown[]) => (calls.push([name, ...args]), { deleted: true });
    const controller = new AdminController({} as never, {
      deleteCandidate: record('candidate'),
      deleteEmployer: record('employer'),
      deleteAdmin: record('admin'),
      adminPreview: record('adminPreview'),
    } as never);
    await controller.deleteCandidate({ id: 'u-sa' }, 'c1');
    await controller.deleteEmployer({ id: 'u-sa' }, 'e1');
    await controller.deleteAdmin({ id: 'u-sa' }, 'a1');
    await controller.adminDeletionPreview({ id: 'u-sa' }, 'a1');
    assert.deepEqual(calls, [
      ['candidate', 'u-sa', 'c1'],
      ['employer', 'u-sa', 'e1'],
      ['admin', 'u-sa', 'a1'],
      ['adminPreview', 'u-sa', 'a1'],
    ]);
  });
});
