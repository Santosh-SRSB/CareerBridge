import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, ForbiddenException, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthService } from '../auth/auth.service';
import { hashPlatformPassword, verifyPassword } from '../auth/password.util';
import { SeedService } from '../platform/seed.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

const OLD_PASSWORD = 'OldPass#2026';
const NEW_PASSWORD = 'NewPass#2027';

type Row = Record<string, unknown>;

async function harness(opts: { userType?: string; adminStatus?: string; withAdminRow?: boolean } = {}) {
  const passwordHash = await hashPlatformPassword(OLD_PASSWORD);
  const user: Row = {
    id: 'u-staff',
    email: 'pw.staff@careerbridge.local',
    phone: '+919000000001',
    userType: opts.userType ?? 'PLATFORM_ADMIN',
    status: 'ACTIVE',
    passwordHash,
    candidate: null,
    employer: null,
  };
  const admin: Row = {
    id: 'adm-staff',
    userId: 'u-staff',
    email: 'pw.staff@careerbridge.local',
    passwordHash,
    loginPassword: 'handoff-copy',
    status: opts.adminStatus ?? 'ACTIVE',
  };
  const other: Row = { id: 'adm-other', userId: 'u-other', passwordHash: 'v2:untouched:hash' };
  const withAdminRow = opts.withAdminRow ?? true;
  const audits: Row[] = [];
  const adminLookups: Row[] = [];
  const adminUpdates: Row[] = [];

  const prisma = {
    admin: {
      findUnique: async ({ where }: { where: Row }) => {
        adminLookups.push(where);
        const hit =
          withAdminRow &&
          (where.userId === admin.userId || where.email === admin.email || where.id === admin.id);
        return hit ? { ...admin, user: { ...user } } : null;
      },
      update: async ({ where, data }: { where: Row; data: Row }) => {
        adminUpdates.push(where);
        const target = where.id === admin.id ? admin : where.id === other.id ? other : null;
        if (!target) throw new Error('admin not found');
        Object.assign(target, data);
        return { ...target };
      },
    },
    user: {
      update: async ({ where, data }: { where: Row; data: Row }) => {
        assert.equal(where.id, user.id);
        Object.assign(user, data);
        return { ...user };
      },
      findUnique: async ({ where }: { where: Row }) => (where.id === user.id ? { ...user } : null),
    },
    auditLog: {
      create: async ({ data }: { data: Row }) => {
        audits.push(data);
        return data;
      },
    },
    refreshToken: { create: async () => ({}) },
    $transaction: async (ops: Array<Promise<unknown>>) => Promise.all(ops),
  };

  const config = {
    get: (key: string) =>
      ({
        JWT_ACCESS_SECRET: 'unit-test-access-secret-7f3a91',
        JWT_REFRESH_SECRET: 'unit-test-refresh-secret-c28d40',
        JWT_ACCESS_EXPIRES: '15m',
        JWT_REFRESH_EXPIRES: '1d',
      })[key],
  };
  const auth = new AuthService(prisma as never, new JwtService({}), config as never, {} as never, {} as never);
  const service = new AdminService(prisma as never, auth, {} as never);
  return { service, auth, admin, user, other, audits, adminLookups, adminUpdates };
}

async function rejects(promise: Promise<unknown>, type: new (...args: never[]) => Error, message: RegExp) {
  await assert.rejects(promise, (err: unknown) => {
    assert.ok(err instanceof type, `expected ${type.name}, got ${String(err)}`);
    const body = (err as BadRequestException).getResponse() as { message?: string };
    assert.match(String(body.message), message);
    return true;
  });
}

const valid = { currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD };

describe('Admin portal: change my own password', () => {
  it('changes the password with a fresh v2 hash, clears the stored handoff copy and audits without the password', async () => {
    const h = await harness();
    const result = await h.service.changeOwnPassword('u-staff', valid);

    assert.deepEqual(result, { changed: true });
    assert.match(String(h.admin.passwordHash), /^v2:/);
    assert.equal(await verifyPassword(NEW_PASSWORD, String(h.admin.passwordHash)), true);
    assert.equal(await verifyPassword(OLD_PASSWORD, String(h.admin.passwordHash)), false);
    assert.equal(h.user.passwordHash, h.admin.passwordHash);
    assert.equal(h.admin.loginPassword, null);
    assert.equal(h.audits.length, 1);
    assert.equal(h.audits[0].action, 'CHANGE_OWN_PASSWORD');
    const auditText = JSON.stringify(h.audits);
    assert.ok(!auditText.includes(NEW_PASSWORD) && !auditText.includes(OLD_PASSWORD));
    assert.ok(!auditText.includes(String(h.admin.passwordHash)));
  });

  it('lets the admin sign in with the new password and rejects the old one', async () => {
    const h = await harness({ userType: 'SUPER_ADMIN' });
    await h.service.changeOwnPassword('u-staff', valid);

    const session = await h.auth.loginAdmin('PW.Staff@careerbridge.local', NEW_PASSWORD);
    assert.equal(session.user.role, 'SUPER_ADMIN');
    assert.ok(session.accessToken);
    await rejects(h.auth.loginAdmin('pw.staff@careerbridge.local', OLD_PASSWORD), UnauthorizedException, /Incorrect email or password/);
  });

  it('rejects a wrong current password with 400 (not 401) and changes nothing', async () => {
    const h = await harness();
    const before = h.admin.passwordHash;
    await rejects(
      h.service.changeOwnPassword('u-staff', { ...valid, currentPassword: 'Wrong#Pass1' }),
      BadRequestException,
      /Current password is incorrect/,
    );
    assert.equal(h.admin.passwordHash, before);
    assert.equal(h.adminUpdates.length, 0);
    assert.equal(h.audits.length, 0);
  });

  it('rejects a confirmation that does not match before touching the database', async () => {
    const h = await harness();
    await rejects(
      h.service.changeOwnPassword('u-staff', { ...valid, confirmPassword: 'NewPass#2028' }),
      BadRequestException,
      /do not match/,
    );
    assert.equal(h.adminLookups.length, 0);
  });

  it('rejects weak passwords using the application password policy', async () => {
    const h = await harness();
    for (const weak of ['short1!', 'alllowercase1!', 'NoDigits!!', 'NoSpecial123', '']) {
      await assert.rejects(
        h.service.changeOwnPassword('u-staff', { ...valid, newPassword: weak, confirmPassword: weak }),
        BadRequestException,
        weak,
      );
    }
    assert.equal(h.adminUpdates.length, 0);
  });

  it('rejects reusing the current password as the new password', async () => {
    const h = await harness();
    await rejects(
      h.service.changeOwnPassword('u-staff', {
        currentPassword: OLD_PASSWORD,
        newPassword: OLD_PASSWORD,
        confirmPassword: OLD_PASSWORD,
      }),
      BadRequestException,
      /must be different/,
    );
  });

  it('refuses callers without an active admin portal account', async () => {
    const candidate = await harness({ withAdminRow: false });
    await rejects(candidate.service.changeOwnPassword('u-candidate', valid), ForbiddenException, /admin portal/);

    const suspended = await harness({ adminStatus: 'SUSPENDED' });
    await rejects(suspended.service.changeOwnPassword('u-staff', valid), ForbiddenException, /admin portal/);

    const employerLinked = await harness({ userType: 'EMPLOYER_ADMIN' });
    await rejects(employerLinked.service.changeOwnPassword('u-staff', valid), ForbiddenException, /admin portal/);
  });

  it('only ever looks up and updates the caller, never another admin', async () => {
    const h = await harness();
    await h.service.changeOwnPassword('u-staff', valid);
    assert.deepEqual(h.adminLookups, [{ userId: 'u-staff' }]);
    assert.deepEqual(h.adminUpdates, [{ id: 'adm-staff' }]);
    assert.equal(h.other.passwordHash, 'v2:untouched:hash');
  });

  it('never returns or logs the password or hash', async () => {
    const h = await harness();
    const logged: string[] = [];
    const methods = ['log', 'info', 'warn', 'error', 'debug'] as const;
    const originals = methods.map((m) => console[m]);
    methods.forEach((m) => {
      console[m] = (...args: unknown[]) => {
        logged.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
      };
    });
    let result: unknown;
    try {
      await h.service.changeOwnPassword('u-staff', { ...valid, currentPassword: 'Wrong#Pass1' }).catch(() => null);
      result = await h.service.changeOwnPassword('u-staff', valid);
    } finally {
      methods.forEach((m, i) => {
        console[m] = originals[i];
      });
    }
    const out = JSON.stringify(result);
    for (const secret of [NEW_PASSWORD, OLD_PASSWORD, 'Wrong#Pass1', String(h.admin.passwordHash)]) {
      assert.ok(!out.includes(secret), 'response must not include passwords or hashes');
      assert.ok(!logged.some((line) => line.includes(secret)), 'logs must not include passwords or hashes');
    }
    assert.ok(!/hash|password/i.test(Object.keys(result as object).join(',')));
  });
});

describe('Admin portal: change-password route guards', () => {
  const handler = AdminController.prototype.changeOwnPassword;

  it('requires authentication (route is not public)', () => {
    assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, handler), undefined);
    assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, AdminController), undefined);
  });

  it('allows only staff roles and blocks candidate / employer callers', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, handler) as string[];
    assert.deepEqual([...roles].sort(), ['PLATFORM_ADMIN', 'PLATFORM_OPERATOR', 'SUPER_ADMIN']);

    const guard = new RolesGuard(new Reflector());
    const ctx = (role?: string) =>
      ({
        getHandler: () => handler,
        getClass: () => AdminController,
        switchToHttp: () => ({ getRequest: () => ({ user: role ? { id: 'u', role } : undefined }) }),
      }) as never;
    for (const role of ['CANDIDATE', 'EMPLOYER_ADMIN', 'EMPLOYER_RECRUITER', undefined]) {
      assert.equal(guard.canActivate(ctx(role)), false, String(role));
    }
    for (const role of ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'PLATFORM_OPERATOR']) {
      assert.equal(guard.canActivate(ctx(role)), true, role);
    }
  });

  it('rejects a body that tries to target another user', async () => {
    const [, dtoType] = Reflect.getMetadata('design:paramtypes', AdminController.prototype, 'changeOwnPassword') as [
      unknown,
      new () => object,
    ];
    const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
    const meta = { type: 'body' as const, metatype: dtoType, data: '' };
    for (const extra of [{ userId: 'u-other' }, { adminId: 'adm-other' }, { id: 'adm-other' }, { email: 'x@y.z' }]) {
      await assert.rejects(pipe.transform({ ...valid, ...extra }, meta), BadRequestException, JSON.stringify(extra));
    }
    const ok = await pipe.transform({ ...valid }, meta);
    assert.deepEqual({ ...ok }, valid);
  });

  it('keeps the Super Admin-only "set another admin password" endpoint unchanged', () => {
    assert.deepEqual(Reflect.getMetadata(ROLES_KEY, AdminController.prototype.setAdminPassword), ['SUPER_ADMIN']);
  });
});

describe('SeedService keeps changed staff passwords across restarts', () => {
  it('does not overwrite the password of existing seeded staff accounts', async () => {
    const userUpdates: Row[] = [];
    const adminUpserts: Array<{ update: Row; create: Row }> = [];
    const prisma = {
      skill: { upsert: async () => ({}) },
      user: {
        findFirst: async ({ where }: { where: Row }) => ({ id: `u-${String(where.email)}` }),
        update: async ({ data }: { data: Row }) => {
          userUpdates.push(data);
          return {};
        },
        create: async () => {
          throw new Error('existing accounts must not be recreated');
        },
      },
      admin: {
        upsert: async (args: { update: Row; create: Row }) => {
          adminUpserts.push(args);
          return {};
        },
      },
      job: { count: async () => 1 },
    };
    const errors: unknown[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => errors.push(args);
    try {
      await new SeedService(prisma as never).onModuleInit();
    } finally {
      console.error = originalError;
    }
    assert.deepEqual(errors, []);
    assert.equal(adminUpserts.length, 3);
    for (const data of userUpdates) {
      assert.ok(!('passwordHash' in data), 'user.update must not reset passwordHash');
    }
    for (const { update, create } of adminUpserts) {
      assert.ok(!('passwordHash' in update) && !('loginPassword' in update), 'admin upsert update must not reset password');
      assert.match(String(create.passwordHash), /^v2:/);
    }
  });
});
