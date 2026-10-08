import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { adminStatusAuditAction } from './admin-status';

type Row = Record<string, any>;

const CREDENTIAL_KEYS = ['passwordHash', 'password', 'loginPassword', 'externalAuthId', 'refreshToken', 'tokenHash', 'otpHash'];
const CREDENTIAL_VALUES = ['$argon2id$v=19$m=65536$stored-user-hash', '$argon2id$v=19$m=65536$stored-admin-hash', 'Plain-Login-9!', 'firebase-uid-123'];
const T0 = new Date('2026-10-01T10:00:00.000Z');

function store() {
  const users: Row[] = [
    { id: 'u-cand', externalAuthId: 'firebase-uid-123', email: 'cand@example.test', phone: '+919000000001', passwordHash: CREDENTIAL_VALUES[0], userType: 'CANDIDATE', status: 'ACTIVE', lastLoginAt: T0, createdAt: T0, updatedAt: T0 },
    { id: 'u-emp', externalAuthId: 'employer_x', email: 'emp@example.test', phone: '+919000000002', passwordHash: CREDENTIAL_VALUES[0], userType: 'EMPLOYER_ADMIN', status: 'ACTIVE', lastLoginAt: null, createdAt: T0, updatedAt: T0 },
    { id: 'u-sa', externalAuthId: 'admin_portal_sa', email: 'sa@example.test', phone: '+919000000003', passwordHash: CREDENTIAL_VALUES[1], userType: 'SUPER_ADMIN', status: 'ACTIVE', lastLoginAt: T0, createdAt: T0, updatedAt: T0 },
    { id: 'u-op', externalAuthId: 'admin_portal_op', email: 'op@example.test', phone: '+919000000004', passwordHash: CREDENTIAL_VALUES[1], userType: 'PLATFORM_OPERATOR', status: 'ACTIVE', lastLoginAt: T0, createdAt: T0, updatedAt: T0 },
  ];
  const admins: Row[] = [
    { id: 'a-sa', email: 'sa@example.test', passwordHash: CREDENTIAL_VALUES[1], loginPassword: CREDENTIAL_VALUES[2], fullName: 'Super', status: 'ACTIVE', userId: 'u-sa', lastLoginAt: T0, createdAt: T0, updatedAt: T0 },
    { id: 'a-op', email: 'op@example.test', passwordHash: CREDENTIAL_VALUES[1], loginPassword: CREDENTIAL_VALUES[2], fullName: 'Operator', status: 'ACTIVE', userId: 'u-op', lastLoginAt: T0, createdAt: T0, updatedAt: T0 },
  ];
  const candidates: Row[] = [{ id: 'c1', userId: 'u-cand' }];
  const employers: Row[] = [{ id: 'e1', userId: 'u-emp' }];
  const audit: Row[] = [];
  const byId = (rows: Row[], id: string) => rows.find((r) => r.id === id) ?? null;
  const update = (rows: Row[]) => async ({ where, data }: { where: { id: string }; data: Row }) => {
    const row = byId(rows, where.id);
    if (!row) throw new Error('not found');
    Object.assign(row, data, { updatedAt: new Date('2026-10-02T10:00:00.000Z') });
    return { ...row };
  };
  const prisma = {
    user: {
      findUnique: async ({ where }: any) => {
        const u = byId(users, where.id);
        return u ? { ...u } : null;
      },
      update: update(users),
    },
    admin: {
      findUnique: async ({ where }: any) => {
        const a = byId(admins, where.id);
        return a ? { ...a, user: { ...byId(users, a.userId)! } } : null;
      },
      update: update(admins),
    },
    candidate: { findUnique: async ({ where }: any) => byId(candidates, where.id) },
    employer: { findUnique: async ({ where }: any) => byId(employers, where.id) },
    auditLog: { create: async ({ data }: any) => (audit.push(data), data) },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  const service = new AdminService(prisma as never, {} as never, {} as never);
  return { service, users, admins, audit };
}

function assertNoCredentials(result: unknown) {
  const json = JSON.stringify(result);
  for (const key of CREDENTIAL_KEYS) assert.equal((result as Row)[key], undefined, `response has ${key}`);
  for (const key of CREDENTIAL_KEYS) assert.ok(!json.includes(`"${key}"`), `serialized response has ${key}`);
  for (const value of CREDENTIAL_VALUES) assert.ok(!json.includes(value), 'serialized response contains a stored credential');
}

describe('setUserStatus — safe response', () => {
  for (const status of ['SUSPENDED', 'INACTIVE', 'ACTIVE'] as const) {
    it(`${status}: response has no passwordHash or other credential`, async () => {
      const { service } = store();
      const res = await service.setUserStatus('u-sa', 'u-cand', status);
      assert.equal((res as Row).passwordHash, undefined);
      assertNoCredentials(res);
    });
  }

  it('returns only the account fields the caller needs', async () => {
    const { service } = store();
    const res = await service.setUserStatus('u-sa', 'u-cand', 'SUSPENDED');
    assert.deepEqual(Object.keys(res).sort(), ['createdAt', 'email', 'id', 'lastLoginAt', 'phone', 'status', 'updatedAt', 'userType']);
    assert.equal(res.id, 'u-cand');
    assert.equal(res.status, 'SUSPENDED');
    assert.equal(res.userType, 'CANDIDATE');
  });

  it('still changes the status, keeps the stored hash, and audits the transition', async () => {
    const { service, users, audit } = store();
    await service.setUserStatus('u-sa', 'u-cand', 'INACTIVE');
    const user = users.find((u) => u.id === 'u-cand')!;
    assert.equal(user.status, 'INACTIVE');
    assert.equal(user.passwordHash, CREDENTIAL_VALUES[0], 'the hash stays in the database for sign-in');
    assert.deepEqual(audit, [
      { userId: 'u-sa', action: 'DEACTIVATE_USER', resourceType: 'USER', resourceId: 'u-cand', oldValue: '{"status":"ACTIVE"}', newValue: '{"status":"INACTIVE"}' },
    ]);
  });

  it('candidate and employer status routes return the same safe shape', async () => {
    const { service } = store();
    assertNoCredentials(await service.setCandidateStatus('u-sa', 'c1', 'SUSPENDED'));
    assertNoCredentials(await service.setEmployerStatus('u-sa', 'e1', 'INACTIVE'));
  });

  it('existing rules: a Super Admin cannot be suspended; unknown users are 404; errors carry no credentials', async () => {
    const { service, users } = store();
    const forbidden = await service.setUserStatus('u-op', 'u-sa', 'SUSPENDED').catch((e) => e);
    assert.ok(forbidden instanceof ForbiddenException);
    assertNoCredentials(forbidden.getResponse());
    assert.equal(users.find((u) => u.id === 'u-sa')!.status, 'ACTIVE');
    await assert.rejects(service.setUserStatus('u-sa', 'missing', 'ACTIVE'), NotFoundException);
    await assert.rejects(service.setCandidateStatus('u-sa', 'missing', 'ACTIVE'), NotFoundException);
  });
});

describe('setAdminStatus — audit action and safe response', () => {
  it('ACTIVE → INACTIVE records DEACTIVATE_ADMIN with the acting user and target admin', async () => {
    const { service, audit } = store();
    await service.setAdminStatus('u-sa', 'a-op', 'INACTIVE');
    assert.deepEqual(audit, [
      { userId: 'u-sa', action: 'DEACTIVATE_ADMIN', resourceType: 'ADMIN', resourceId: 'a-op', oldValue: '{"status":"ACTIVE"}', newValue: '{"status":"INACTIVE"}' },
    ]);
  });

  it('INACTIVE → ACTIVE records ACTIVATE_ADMIN', async () => {
    const { service, admins, users, audit } = store();
    admins.find((a) => a.id === 'a-op')!.status = 'INACTIVE';
    users.find((u) => u.id === 'u-op')!.status = 'INACTIVE';
    await service.setAdminStatus('u-sa', 'a-op', 'ACTIVE');
    assert.deepEqual(audit, [
      { userId: 'u-sa', action: 'ACTIVATE_ADMIN', resourceType: 'ADMIN', resourceId: 'a-op', oldValue: '{"status":"INACTIVE"}', newValue: '{"status":"ACTIVE"}' },
    ]);
  });

  it('suspension is still SUSPEND_ADMIN, and reactivating a suspended admin is ACTIVATE_ADMIN', async () => {
    const { service, audit } = store();
    await service.setAdminStatus('u-sa', 'a-op', 'SUSPENDED');
    await service.setAdminStatus('u-sa', 'a-op', 'ACTIVE');
    assert.deepEqual(audit.map((a) => [a.action, a.oldValue, a.newValue]), [
      ['SUSPEND_ADMIN', '{"status":"ACTIVE"}', '{"status":"SUSPENDED"}'],
      ['ACTIVATE_ADMIN', '{"status":"SUSPENDED"}', '{"status":"ACTIVE"}'],
    ]);
  });

  it('the action follows the status written, not the route', () => {
    assert.equal(adminStatusAuditAction('INACTIVE'), 'DEACTIVATE_ADMIN');
    assert.equal(adminStatusAuditAction('ACTIVE'), 'ACTIVATE_ADMIN');
    assert.equal(adminStatusAuditAction('SUSPENDED'), 'SUSPEND_ADMIN');
  });

  it('keeps both the staff profile and the login in sync, and keeps the stored hash', async () => {
    const { service, admins, users } = store();
    await service.setAdminStatus('u-sa', 'a-op', 'INACTIVE');
    assert.equal(admins.find((a) => a.id === 'a-op')!.status, 'INACTIVE');
    assert.equal(users.find((u) => u.id === 'u-op')!.status, 'INACTIVE');
    assert.equal(admins.find((a) => a.id === 'a-op')!.passwordHash, CREDENTIAL_VALUES[1]);
  });

  it('response has no passwordHash, stored login password or other credential', async () => {
    const { service } = store();
    const res = await service.setAdminStatus('u-sa', 'a-op', 'SUSPENDED');
    assert.equal((res as Row).passwordHash, undefined);
    assert.equal((res as Row).loginPassword, undefined);
    assertNoCredentials(res);
    assert.deepEqual(Object.keys(res).sort(), ['createdAt', 'email', 'fullName', 'id', 'lastLoginAt', 'status', 'updatedAt', 'userId']);
    assert.equal(res.status, 'SUSPENDED');
  });

  it('existing rules: a Super Admin cannot be deactivated (no audit row); unknown admin is 404', async () => {
    const { service, audit, admins } = store();
    await assert.rejects(service.setAdminStatus('u-sa', 'a-sa', 'INACTIVE'), ForbiddenException);
    assert.equal(admins.find((a) => a.id === 'a-sa')!.status, 'ACTIVE');
    assert.equal(audit.length, 0);
    await assert.rejects(service.setAdminStatus('u-sa', 'missing', 'ACTIVE'), NotFoundException);
  });
});

describe('status routes — authorization unchanged', () => {
  const guard = new RolesGuard(new Reflector());
  const ctx = (handler: unknown, role?: string) =>
    ({
      getHandler: () => handler,
      getClass: () => AdminController,
      switchToHttp: () => ({ getRequest: () => ({ user: role ? { id: 'u', role } : undefined }) }),
    }) as never;
  const proto = AdminController.prototype as any;

  for (const name of ['setUserStatus', 'setCandidateStatus', 'setEmployerStatus']) {
    it(`${name}: staff roles allowed; candidates, employers and anonymous refused`, () => {
      assert.equal(Reflect.getMetadata(ROLES_KEY, proto[name]), undefined, 'no route-level override');
      assert.deepEqual(Reflect.getMetadata(ROLES_KEY, AdminController), ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'PLATFORM_OPERATOR']);
      for (const role of ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'PLATFORM_OPERATOR']) assert.equal(guard.canActivate(ctx(proto[name], role)), true, role);
      for (const role of ['CANDIDATE', 'EMPLOYER_ADMIN', 'EMPLOYER_RECRUITER']) assert.equal(guard.canActivate(ctx(proto[name], role)), false, role);
      assert.equal(guard.canActivate(ctx(proto[name])), false);
      assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, proto[name]), undefined);
    });
  }

  for (const name of ['setAdminStatus', 'suspendAdmin']) {
    it(`${name}: Super Admin only`, () => {
      assert.deepEqual(Reflect.getMetadata(ROLES_KEY, proto[name]), ['SUPER_ADMIN']);
      assert.equal(guard.canActivate(ctx(proto[name], 'SUPER_ADMIN')), true);
      for (const role of ['PLATFORM_ADMIN', 'PLATFORM_OPERATOR', 'CANDIDATE', 'EMPLOYER_ADMIN']) assert.equal(guard.canActivate(ctx(proto[name], role)), false, role);
      assert.equal(guard.canActivate(ctx(proto[name])), false);
      assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, proto[name]), undefined);
    });
  }

  it('routes pass the signed-in actor and the explicit target id', async () => {
    const calls: unknown[][] = [];
    const record = (n: string) => async (...args: unknown[]) => (calls.push([n, ...args]), {});
    const controller = new AdminController(
      { setUserStatus: record('user'), setCandidateStatus: record('candidate'), setEmployerStatus: record('employer'), setAdminStatus: record('admin') } as never,
      {} as never,
    );
    await controller.setUserStatus({ id: 'u-actor' }, 'u1', { status: 'SUSPENDED' } as never);
    await controller.setCandidateStatus({ id: 'u-actor' }, 'c1', { status: 'INACTIVE' } as never);
    await controller.setEmployerStatus({ id: 'u-actor' }, 'e1', { status: 'ACTIVE' } as never);
    await controller.setAdminStatus({ id: 'u-actor' }, 'a1', { status: 'INACTIVE' } as never);
    await controller.suspendAdmin({ id: 'u-actor' }, 'a2');
    assert.deepEqual(calls, [
      ['user', 'u-actor', 'u1', 'SUSPENDED'],
      ['candidate', 'u-actor', 'c1', 'INACTIVE'],
      ['employer', 'u-actor', 'e1', 'ACTIVE'],
      ['admin', 'u-actor', 'a1', 'INACTIVE'],
      ['admin', 'u-actor', 'a2', 'SUSPENDED'],
    ]);
  });
});
