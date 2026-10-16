/**
 * Admin phone generation when the first number is already taken.
 * Run: node -r ts-node/register/transpile-only --test src/admin/admin-create-phone.unit.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AdminService } from './admin.service';

describe('createAdmin phone collision', () => {
  it('retries with a longer suffix when the generated phone is taken', async () => {
    const seen: string[] = [];
    let storedPhone = '';
    const prisma = {
      admin: { findUnique: async () => null },
      user: {
        findFirst: async ({ where }: { where: { phone: string } }) => {
          seen.push(where.phone);
          return { id: 'taken' };
        },
      },
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          user: {
            create: async ({ data }: { data: { phone: string } }) => {
              storedPhone = data.phone;
              return { id: 'user-1' };
            },
          },
          admin: {
            create: async () => ({
              id: 'admin-1',
              email: 'ops@example.test',
              fullName: 'Ops',
              status: 'ACTIVE',
              user: { userType: 'PLATFORM_OPERATOR', phone: storedPhone, status: 'ACTIVE' },
            }),
          },
        }),
      auditLog: { create: async () => ({ id: 'audit-1' }) },
    };
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never);
    const result = await service.createAdmin('actor-1', {
      email: 'Ops@Example.test',
      password: 'Secret@123',
      fullName: 'Ops',
    });

    assert.equal(seen.length, 1);
    assert.match(seen[0], /^\+91\d{10}$/);
    assert.match(storedPhone, /^\+91\d{11}$/);
    assert.match(result.phone, /^\+91\d{11}$/);
    assert.notEqual(seen[0], storedPhone);
    assert.equal(result.phone, storedPhone);
  });
});
