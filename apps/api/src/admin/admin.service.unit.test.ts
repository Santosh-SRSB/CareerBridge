import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { AdminController } from './admin.controller';
import {
  AdminService,
  conversionRate,
  parseDateFilter,
  replaceSkillName,
  whatsappFailureReason,
} from './admin.service';

function rolesFor(method: keyof AdminController): string[] {
  return Reflect.getMetadata(ROLES_KEY, AdminController.prototype[method]) as string[];
}

describe('admin RBAC (handbook: Operations cannot open Skills or Reports)', () => {
  it('restricts skills, reports and revenue to Admin and Super Admin', () => {
    for (const method of ['skills', 'addSkill', 'mergeSkill', 'reports', 'revenue'] as const) {
      const roles = rolesFor(method);
      assert.ok(roles.includes('SUPER_ADMIN') && roles.includes('PLATFORM_ADMIN'), method);
      assert.ok(!roles.includes('PLATFORM_OPERATOR'), `${method} must not allow PLATFORM_OPERATOR`);
    }
  });

  it('keeps operations areas open to the operator role', () => {
    const classRoles = Reflect.getMetadata(ROLES_KEY, AdminController) as string[];
    assert.ok(classRoles.includes('PLATFORM_OPERATOR'));
    for (const method of ['candidates', 'employerDetails', 'applications', 'applicationPipeline', 'interviews'] as const) {
      assert.equal(Reflect.getMetadata(ROLES_KEY, AdminController.prototype[method]), undefined, method);
    }
  });
});

describe('admin helpers', () => {
  it('parses date filters as IST day boundaries and rejects bad dates', () => {
    assert.equal(parseDateFilter('2026-09-01', 'start')?.toISOString(), '2026-08-31T18:30:00.000Z');
    assert.equal(parseDateFilter('2026-09-01', 'end')?.toISOString(), '2026-09-01T18:29:59.999Z');
    assert.equal(parseDateFilter('', 'start'), null);
    assert.throws(() => parseDateFilter('2026-02-30', 'start'), /YYYY-MM-DD/);
    assert.throws(() => parseDateFilter('01/09/2026', 'start'), /YYYY-MM-DD/);
  });

  it('computes conversion rates with one decimal and no rate without a base', () => {
    assert.equal(conversionRate(1, 3), 33.3);
    assert.equal(conversionRate(0, 10), 0);
    assert.equal(conversionRate(5, 0), null);
  });

  it('replaces a skill name case-insensitively without duplicating the target', () => {
    assert.deepEqual(replaceSkillName(['ms excel', 'Tally'], 'MS Excel', 'Microsoft Excel'), {
      list: ['Microsoft Excel', 'Tally'],
      changed: true,
    });
    assert.deepEqual(replaceSkillName(['MS Excel', 'Microsoft Excel'], 'MS Excel', 'Microsoft Excel').list, [
      'Microsoft Excel',
    ]);
    assert.equal(replaceSkillName(['Tally'], 'MS Excel', 'Microsoft Excel').changed, false);
  });

  it('summarises WhatsApp failures without dumping the raw payload', () => {
    assert.equal(
      whatsappFailureReason(JSON.stringify({ error: { message: 'Recipient not in allowed list', code: 131030, fbtrace_id: 'x' } })),
      'Recipient not in allowed list (code 131030)',
    );
    assert.equal(whatsappFailureReason(JSON.stringify({ errors: [{ code: 131047, title: 'Re-engagement message' }] })), 'Re-engagement message (code 131047)');
    assert.equal(whatsappFailureReason('not json'), 'Delivery failed');
    assert.equal(whatsappFailureReason(null), 'Unknown error');
  });
});

describe('ST-23: admin approve/reject stays available for historical PENDING_REVIEW jobs', () => {
  function harness(status: string) {
    const job: Record<string, unknown> = { id: 'j1', status, publishedAt: null };
    const audits: Array<{ data: { action: string } }> = [];
    const calls = { approvals: 0, rejections: 0 };
    const prisma = {
      job: {
        findUnique: async () => ({ ...job }),
        update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(job, data),
      },
      auditLog: { create: async (row: { data: { action: string } }) => audits.push(row) },
    };
    const employers = {
      completeJobApproval: async () => {
        calls.approvals += 1;
        return { matching: { status: 'COMPUTED' } };
      },
      notifyJobRejected: async () => {
        calls.rejections += 1;
      },
    };
    return { service: new AdminService(prisma as never, {} as never, employers as never), job, audits, calls };
  }

  it('approving a historical PENDING_REVIEW job publishes it, audits it and runs the go-live follow-ups', async () => {
    const h = harness('PENDING_REVIEW');
    const res = (await h.service.approveJob('admin-1', 'j1')) as Record<string, unknown>;
    assert.equal(res.status, 'PUBLISHED');
    assert.ok(h.job.publishedAt instanceof Date);
    assert.deepEqual(h.audits.map((a) => a.data.action), ['JOB_PUBLISHED']);
    assert.equal(h.calls.approvals, 1);
  });

  it('rejecting a historical PENDING_REVIEW job returns it to Draft and notifies the employer', async () => {
    const h = harness('PENDING_REVIEW');
    await h.service.rejectJob('admin-1', 'j1');
    assert.equal(h.job.status, 'DRAFT');
    assert.equal(h.calls.rejections, 1);
  });

  it('approve/reject endpoints remain restricted to admin roles', () => {
    const classRoles = Reflect.getMetadata(ROLES_KEY, AdminController) as string[];
    for (const method of ['approveJob', 'rejectJob'] as const) {
      const roles = (Reflect.getMetadata(ROLES_KEY, AdminController.prototype[method]) as string[] | undefined) ?? classRoles;
      assert.ok(roles.length > 0 && roles.every((r) => /ADMIN|OPERATOR/.test(r)), method);
    }
  });
});

describe('Job closedAt on admin status changes (Employer Report "Closed Date")', () => {
  function harness(initial: Record<string, unknown>) {
    const job: Record<string, unknown> = { id: 'j1', publishedAt: new Date('2026-09-28T04:30:00.000Z'), closedAt: null, ...initial };
    const updates: Array<Record<string, unknown>> = [];
    const prisma = {
      job: {
        findUnique: async () => ({ ...job }),
        update: async ({ data }: { data: Record<string, unknown> }) => {
          updates.push(data);
          // Prisma leaves a field unchanged when its value is undefined.
          Object.assign(job, Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)));
          return { ...job };
        },
      },
      auditLog: { create: async () => undefined },
    };
    const employers = { completeJobApproval: async () => null, notifyJobRejected: async () => undefined };
    return { service: new AdminService(prisma as never, {} as never, employers as never), job, updates };
  }
  const original = new Date('2026-10-02T05:00:00.000Z');

  it('I. admin closing a live, paused or pending job records closedAt and keeps the posted date', async () => {
    for (const status of ['PUBLISHED', 'PAUSED', 'PENDING_REVIEW', 'DRAFT']) {
      const h = harness({ status });
      const before = Date.now();
      await h.service.setJobStatus('admin-1', 'j1', 'CLOSED');
      assert.equal(h.job.status, 'CLOSED', status);
      assert.ok(h.job.closedAt instanceof Date && (h.job.closedAt as Date).getTime() >= before, status);
      assert.equal((h.job.publishedAt as Date).toISOString(), '2026-09-28T04:30:00.000Z', status);
    }
  });

  it('I. admin reject of a live job closes it and records closedAt; reject of a pending job does not', async () => {
    const live = harness({ status: 'PUBLISHED' });
    await live.service.rejectJob('admin-1', 'j1');
    assert.equal(live.job.status, 'CLOSED');
    assert.ok(live.job.closedAt instanceof Date);
    const pending = harness({ status: 'PENDING_REVIEW' });
    await pending.service.rejectJob('admin-1', 'j1');
    assert.equal(pending.job.status, 'DRAFT');
    assert.equal(pending.job.closedAt, null);
  });

  it('H. admin setting CLOSED on an already CLOSED job (or rejecting it) leaves closedAt unchanged', async () => {
    const h = harness({ status: 'CLOSED', closedAt: original });
    await h.service.setJobStatus('admin-1', 'j1', 'CLOSED');
    await h.service.rejectJob('admin-1', 'j1');
    assert.equal(h.job.closedAt, original);
    assert.ok(h.updates.every((u) => u.closedAt === undefined));
  });

  it('J. admin reopening a CLOSED job clears closedAt; closing again records the new close', async () => {
    const h = harness({ status: 'CLOSED', closedAt: original });
    await h.service.setJobStatus('admin-1', 'j1', 'PUBLISHED');
    assert.equal(h.job.closedAt, null);
    const before = Date.now();
    const reclosed = (await h.service.setJobStatus('admin-1', 'j1', 'CLOSED')) as { closedAt: unknown };
    assert.ok(reclosed.closedAt instanceof Date && reclosed.closedAt.getTime() >= before);
  });
});

describe('AdminService.mergeSkill', () => {
  function harness() {
    const skills = new Map([
      ['s1', { id: 's1', name: 'MS Excel', category: 'Office', aliases: 'Excel', active: true }],
      ['s2', { id: 's2', name: 'Microsoft Excel', category: 'Office', aliases: 'Spreadsheets', active: true }],
    ]);
    let candidateSkills = [
      { id: 'c1', candidateId: 'A', name: 'MS Excel' },
      { id: 'c2', candidateId: 'B', name: 'ms excel' },
      { id: 'c3', candidateId: 'B', name: 'Microsoft Excel' },
    ];
    const jobs = [{ id: 'j1', requiredSkills: JSON.stringify(['MS Excel', 'Tally']), preferredSkills: '[]' }];
    const audits: unknown[] = [];
    const eqi = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
    const tx = {
      candidateSkill: {
        findMany: async ({ where }: { where: { name: { equals: string }; candidateId?: { in: string[] } } }) =>
          candidateSkills.filter(
            (r) => eqi(r.name, where.name.equals) && (!where.candidateId || where.candidateId.in.includes(r.candidateId)),
          ),
        deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
          candidateSkills = candidateSkills.filter((r) => !where.id.in.includes(r.id));
        },
        updateMany: async ({ where, data }: { where: { id: { in: string[] } }; data: { name: string } }) => {
          candidateSkills = candidateSkills.map((r) => (where.id.in.includes(r.id) ? { ...r, name: data.name } : r));
        },
      },
      job: {
        findMany: async () => jobs,
        update: async ({ where, data }: { where: { id: string }; data: Record<string, string> }) => {
          Object.assign(jobs.find((j) => j.id === where.id)!, data);
        },
      },
      jobSkillProfile: { findMany: async () => [], update: async () => undefined },
      skill: {
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const next = { ...skills.get(where.id)!, ...data };
          skills.set(where.id, next as never);
          return next;
        },
      },
    };
    const prisma = {
      skill: { findUnique: async ({ where }: { where: { id: string } }) => skills.get(where.id) ?? null },
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
      auditLog: { create: async (row: unknown) => audits.push(row) },
    };
    const service = new AdminService(prisma as never, {} as never, {} as never);
    return { service, skills, jobs, audits, get candidateSkills() { return candidateSkills; } };
  }

  it('moves candidates and jobs to the target skill and deactivates the duplicate', async () => {
    const h = harness();
    const result = await h.service.mergeSkill('admin-1', 's1', 's2');
    assert.equal(result.candidatesUpdated, 2);
    assert.equal(result.duplicatesRemoved, 1);
    assert.equal(result.jobsUpdated, 1);
    assert.deepEqual(
      h.candidateSkills.map((r) => `${r.candidateId}:${r.name}`).sort(),
      ['A:Microsoft Excel', 'B:Microsoft Excel'],
    );
    assert.deepEqual(JSON.parse(h.jobs[0].requiredSkills), ['Microsoft Excel', 'Tally']);
    assert.equal(h.skills.get('s1')!.active, false);
    assert.equal(h.skills.get('s2')!.aliases, 'Spreadsheets, MS Excel, Excel');
    assert.equal(h.audits.length, 1);
  });

  it('rejects merging a skill into itself or into a missing skill', async () => {
    const h = harness();
    await assert.rejects(() => h.service.mergeSkill('admin-1', 's1', 's1'), /different skill/);
    await assert.rejects(() => h.service.mergeSkill('admin-1', 's1', 'nope'), /not found/i);
  });
});
