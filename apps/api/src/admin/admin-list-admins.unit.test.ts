/**
 * SEC-DB-005 / FIND-B1-001: listAdmins must not expose loginPassword handoff.
 * Run: node -r ts-node/register/transpile-only --test src/admin/admin-list-admins.unit.test.ts
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AdminService } from './admin.service';
import { hashPlatformPassword } from '../auth/password.util';

const HANDOFF = 'Handoff-Plain-9!';
const T0 = new Date('2026-10-01T10:00:00.000Z');

describe('listAdmins — no handoff password in list (SEC-DB-005)', () => {
  it('omits password and loginPassword even when loginPassword is stored', async () => {
    const passwordHash = await hashPlatformPassword('Unused@Hash1');
    const prisma = {
      admin: {
        findMany: async () => [
          {
            id: 'a-op',
            email: 'ops@example.test',
            passwordHash,
            loginPassword: HANDOFF,
            fullName: 'Operator',
            status: 'ACTIVE',
            userId: 'u-op',
            lastLoginAt: T0,
            createdAt: T0,
            user: { phone: '+919000000026', userType: 'PLATFORM_OPERATOR', status: 'ACTIVE' },
          },
        ],
      },
    };
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never);
    const rows = await service.listAdmins();
    assert.equal(rows.length, 1);
    const row = rows[0] as Record<string, unknown>;
    assert.equal(row.email, 'ops@example.test');
    assert.equal(row.password, undefined);
    assert.equal(row.loginPassword, undefined);
    assert.equal(row.passwordHash, undefined);
    const json = JSON.stringify(rows);
    assert.ok(!json.includes(HANDOFF), 'serialized list must not contain handoff plaintext');
    assert.ok(!json.includes('"password"'), 'serialized list must not include password key');
    assert.ok(!json.includes('loginPassword'), 'serialized list must not include loginPassword key');
  });

  it('setAdminPassword still returns plaintext once and leaves stored loginPassword unchanged in DB update', async () => {
    const passwordHash = await hashPlatformPassword('OldStaff@1');
    let adminUpdate: Record<string, unknown> | null = null;
    const prisma = {
      admin: {
        findUnique: async () => ({
          id: 'a-op',
          email: 'ops@example.test',
          passwordHash,
          loginPassword: 'old-handoff',
          status: 'ACTIVE',
          userId: 'u-op',
          user: { userType: 'PLATFORM_OPERATOR', status: 'ACTIVE' },
        }),
        update: async ({ data }: { data: Record<string, unknown> }) => {
          adminUpdate = data;
          return { id: 'a-op', ...data };
        },
      },
      user: {
        update: async () => ({}),
      },
      $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
      auditLog: { create: async () => ({}) },
    };
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never);
    const result = await service.setAdminPassword('u-sa', 'a-op', 'TempHandoff2!');
    assert.equal(result.password, 'TempHandoff2!');
    assert.equal(adminUpdate?.loginPassword, 'TempHandoff2!');
    assert.match(String(adminUpdate?.passwordHash), /^v2:/);
  });
});
