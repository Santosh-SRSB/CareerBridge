/**
 * Registration OTP requests with an in-memory Prisma double (dev OTP mode, no SMS/email/Firebase).
 * "Change mobile number": the replacement request targets the new number and the old one stops verifying.
 * Run: npm run test:auth
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HttpException } from '@nestjs/common';
import { AuthService } from './auth.service';

type Row = Record<string, any>;

function errorCode(err: unknown) {
  return err instanceof HttpException ? String((err.getResponse() as { code?: string }).code) : '';
}

function harness(users: Row[] = []) {
  const otpRequests: Row[] = [];
  const updateManyCalls: Row[] = [];
  let seq = 0;
  const matches = (row: Row, where: Row) =>
    Object.entries(where).every(([key, cond]) => {
      if (cond && typeof cond === 'object' && 'in' in cond) return cond.in.includes(row[key]);
      if (cond && typeof cond === 'object' && 'gte' in cond) return row[key] >= cond.gte;
      if (cond && typeof cond === 'object' && 'equals' in cond) {
        return String(row[key] ?? '').toLowerCase() === String(cond.equals).toLowerCase();
      }
      return row[key] === cond;
    });
  const prisma: any = {
    user: { findFirst: async ({ where }: Row) => users.find((u) => matches(u, where)) ?? null },
    otpRequest: {
      count: async ({ where }: Row) => otpRequests.filter((r) => matches(r, where)).length,
      findFirst: async ({ where }: Row) => otpRequests.find((r) => matches(r, where)) ?? null,
      findUnique: async ({ where }: Row) => otpRequests.find((r) => r.id === where.id) ?? null,
      create: async ({ data }: Row) => {
        const row = { id: `otp-${++seq}`, attemptCount: 0, verifiedAt: null, createdAt: new Date(), ...data };
        otpRequests.push(row);
        return row;
      },
      update: async ({ where, data }: Row) => {
        const row = otpRequests.find((r) => r.id === where.id)!;
        if (data.attemptCount?.increment) row.attemptCount += data.attemptCount.increment;
        return row;
      },
      updateMany: async ({ where, data }: Row) => {
        updateManyCalls.push({ where, data });
        const rows = otpRequests.filter((r) => matches(r, where));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },
    },
  };
  const config = {
    get: (key: string) => ({ AUTH_DEV_OTP: 'true', NODE_ENV: 'development' })[key as 'AUTH_DEV_OTP'],
  };
  const firebase = { isConfigured: () => false };
  const email = { isConfigured: () => false };
  const svc = new AuthService(prisma, {} as any, config as any, firebase as any, email as any);
  return { svc, otpRequests, updateManyCalls };
}

const register = (extra: Row = {}) => ({
  channel: 'MOBILE' as const,
  purpose: 'REGISTER' as const,
  accountType: 'CANDIDATE' as const,
  phone: '+919800000001',
  email: 'asha@example.test',
  fullName: 'Asha K',
  password: 'Secret@123',
  ...extra,
});

describe('Registration "Change mobile number"', () => {
  it('the new request targets the new number and the replaced request is expired server-side', async () => {
    const { svc, otpRequests, updateManyCalls } = harness();
    const first = await svc.requestOtp(register());
    const second = await svc.requestOtp(register({ phone: '+919800000002', replacesRequestId: first.requestId }));
    assert.notEqual(second.requestId, first.requestId);
    const oldReq = otpRequests.find((r) => r.id === first.requestId)!;
    const newReq = otpRequests.find((r) => r.id === second.requestId)!;
    assert.equal(newReq.phone, '+919800000002');
    assert.equal(oldReq.phone, '+919800000001');
    assert.ok(oldReq.expiresAt.getTime() <= Date.now());
    assert.ok(newReq.expiresAt.getTime() > Date.now());
    assert.deepEqual(updateManyCalls.map((c) => c.where), [
      { id: first.requestId, purpose: 'REGISTER', verifiedAt: null },
    ]);
  });

  it('the old number can no longer be verified once replaced', async () => {
    const { svc } = harness();
    const first = await svc.requestOtp(register());
    await svc.requestOtp(register({ phone: '+919800000002', replacesRequestId: first.requestId }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    await assert.rejects(svc.verifyOtp({ requestId: first.requestId, otp: '123456' } as any), (err) => {
      assert.equal(errorCode(err), 'OTP_EXPIRED');
      return true;
    });
  });

  it('without replacesRequestId nothing else is touched (normal first registration and resend)', async () => {
    const { svc, updateManyCalls } = harness();
    await svc.requestOtp(register());
    assert.equal(updateManyCalls.length, 0);
  });

  it('replacesRequestId is ignored outside registration', async () => {
    const { svc, updateManyCalls } = harness([
      { id: 'u1', phone: '+919800000001', email: 'asha@example.test', userType: 'CANDIDATE' },
    ]);
    const login = await svc.requestOtp({
      channel: 'MOBILE',
      purpose: 'LOGIN',
      accountType: 'CANDIDATE',
      phone: '+919800000001',
    } as any);
    await svc.requestOtp({
      channel: 'MOBILE',
      purpose: 'LOGIN',
      accountType: 'CANDIDATE',
      phone: '+919800000001',
      replacesRequestId: login.requestId,
    } as any);
    assert.equal(updateManyCalls.length, 0);
  });

  it('the stored registration payload holds a password hash, never the password, OTP or replaced id', async () => {
    const { svc, otpRequests } = harness();
    const first = await svc.requestOtp(register());
    await svc.requestOtp(register({ phone: '+919800000002', replacesRequestId: first.requestId }));
    for (const row of otpRequests) {
      assert.ok(!row.payloadJson.includes('Secret@123'));
      assert.ok(!row.payloadJson.includes('123456'));
      assert.ok(!row.payloadJson.includes('replacesRequestId'));
      assert.ok(JSON.parse(row.payloadJson).passwordHash);
    }
  });
});

describe('Per-user uniqueness is unchanged', () => {
  const existing = [{ id: 'u1', phone: '+919800000001', email: 'asha@example.test', userType: 'CANDIDATE' }];

  it('a mobile number already registered is rejected for a new registration', async () => {
    const { svc, otpRequests } = harness(existing);
    await assert.rejects(svc.requestOtp(register({ email: 'other@example.test' })), (err) => {
      assert.equal(errorCode(err), 'ACCOUNT_EXISTS');
      return true;
    });
    assert.equal(otpRequests.length, 0);
  });

  it('an email already registered is rejected for a new registration', async () => {
    const { svc, otpRequests } = harness(existing);
    await assert.rejects(svc.requestOtp(register({ phone: '+919800000009' })), (err) => {
      assert.equal(errorCode(err), 'ACCOUNT_EXISTS');
      return true;
    });
    assert.equal(otpRequests.length, 0);
  });

  it('changing to a number that is already registered is rejected and the pending request is kept', async () => {
    const { svc, otpRequests } = harness(existing);
    const first = await svc.requestOtp(register({ phone: '+919800000005', email: 'new@example.test' }));
    await assert.rejects(
      svc.requestOtp(register({ phone: '+919800000001', email: 'new@example.test', replacesRequestId: first.requestId })),
      (err) => errorCode(err) === 'ACCOUNT_EXISTS',
    );
    assert.ok(otpRequests.find((r) => r.id === first.requestId)!.expiresAt.getTime() > Date.now());
  });
});
