/**
 * Registration and forgot-password OTP flows with an in-memory Prisma double (dev OTP mode, no SMS/email/Firebase).
 * "Change mobile number": the replacement request targets the new number and the old one stops verifying.
 * Forgot password: request → reset with the emailed OTP → sign in with the new password, for both roles.
 * Run: npm run test:auth
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { BadRequestException, HttpException, Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, NestFactory } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { RequestOtpDto } from './dto/request-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { hashPassword } from './password.util';
import { RequestIdInterceptor } from '../common/interceptors/request-id.interceptor';

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
    user: {
      findFirst: async ({ where }: Row) => users.find((u) => matches(u, where)) ?? null,
      update: async ({ where, data }: Row) => Object.assign(users.find((u) => u.id === where.id)!, data),
    },
    refreshToken: { create: async ({ data }: Row) => data },
    otpRequest: {
      count: async ({ where }: Row) => otpRequests.filter((r) => matches(r, where)).length,
      findFirst: async ({ where }: Row) => otpRequests.find((r) => matches(r, where)) ?? null,
      findUnique: async ({ where }: Row) => otpRequests.find((r) => r.id === where.id) ?? null,
      create: async ({ data }: Row) => {
        const row = { id: randomUUID(), seq: ++seq, attemptCount: 0, verifiedAt: null, createdAt: new Date(), ...data };
        otpRequests.push(row);
        return row;
      },
      update: async ({ where, data }: Row) => {
        const row = otpRequests.find((r) => r.id === where.id)!;
        const { attemptCount, ...rest } = data;
        if (attemptCount?.increment) row.attemptCount += attemptCount.increment;
        return Object.assign(row, rest);
      },
      updateMany: async ({ where, data }: Row) => {
        updateManyCalls.push({ where, data });
        const rows = otpRequests.filter((r) => matches(r, where));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },
    },
  };
  const settings: Record<string, string> = {
    AUTH_DEV_OTP: 'true',
    NODE_ENV: 'development',
    JWT_ACCESS_SECRET: 'unit-test-access-secret',
    JWT_REFRESH_SECRET: 'unit-test-refresh-secret',
  };
  const config = { get: (key: string) => settings[key] };
  const jwt = { signAsync: async () => 'signed-token' };
  const firebase = { isConfigured: () => false };
  const email = { isConfigured: () => false };
  const svc = new AuthService(prisma, jwt as any, config as any, firebase as any, email as any);
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

const OLD_PASSWORD = 'OldPass@123';
const NEW_PASSWORD = 'NewPass@456';

async function accountUsers() {
  const passwordHash = await hashPassword(OLD_PASSWORD);
  return [
    { id: 'cand-1', phone: '+919800000011', email: 'cand@example.test', userType: 'CANDIDATE', status: 'ACTIVE', passwordHash },
    { id: 'emp-1', phone: '+919800000022', email: 'boss@company.test', userType: 'EMPLOYER_ADMIN', status: 'ACTIVE', passwordHash },
  ];
}

const ROLES = [
  { accountType: 'CANDIDATE' as const, email: 'cand@example.test', userId: 'cand-1' },
  { accountType: 'EMPLOYER' as const, email: 'boss@company.test', userId: 'emp-1' },
];

const resetRequest = (accountType: 'CANDIDATE' | 'EMPLOYER', email: string, extra: Row = {}) => ({
  channel: 'EMAIL' as const,
  purpose: 'RESET_PASSWORD' as const,
  accountType,
  email,
  ...extra,
});

/** The same wrapping the API applies to every successful response. */
async function asHttpBody(result: unknown) {
  const http = { getRequest: () => ({ headers: {} }), getResponse: () => ({ setHeader: () => undefined }) };
  const context = { switchToHttp: () => http } as any;
  return lastValueFrom(new RequestIdInterceptor().intercept(context, { handle: () => of(result) }));
}

for (const role of ROLES) {
  describe(`Forgot password (${role.accountType})`, () => {
    it('request OTP succeeds for the registered email and stores only the account type', async () => {
      const { svc, otpRequests } = harness(await accountUsers());
      const result = await svc.requestOtp(resetRequest(role.accountType, role.email) as any);
      assert.ok(result.requestId);
      assert.equal(result.devOtp, '123456');
      const row = otpRequests.find((r) => r.id === result.requestId)!;
      assert.equal(row.purpose, 'RESET_PASSWORD');
      assert.equal(row.channel, 'EMAIL');
      assert.deepEqual(JSON.parse(row.payloadJson), { accountType: role.accountType });
    });

    it('the correct OTP resets the password, and the user signs in with the new one (not the old one)', async () => {
      const users = await accountUsers();
      const { svc, otpRequests } = harness(users);
      const { requestId } = await svc.requestOtp(resetRequest(role.accountType, role.email) as any);
      const result = await svc.resetPassword({ requestId, otp: '123456', accountType: role.accountType, password: NEW_PASSWORD });
      assert.equal(result.message, 'Password updated. You can sign in now.');
      assert.ok(otpRequests.find((r) => r.id === requestId)!.verifiedAt);

      const session = await svc.loginWithPassword(role.email, NEW_PASSWORD, role.accountType);
      assert.equal(session.user.id, role.userId);
      await assert.rejects(svc.loginWithPassword(role.email, OLD_PASSWORD, role.accountType), (err) => {
        assert.equal(errorCode(err), 'UNAUTHORIZED');
        return true;
      });
      const other = users.find((u) => u.id !== role.userId)!;
      await svc.loginWithPassword(other.email, OLD_PASSWORD, other.userType === 'CANDIDATE' ? 'CANDIDATE' : 'EMPLOYER');
    });

    it('the success response reaches the client as { success, data: { message } } (the web client reads data)', async () => {
      const { svc } = harness(await accountUsers());
      const { requestId } = await svc.requestOtp(resetRequest(role.accountType, role.email) as any);
      const body = (await asHttpBody(
        await svc.resetPassword({ requestId, otp: '123456', accountType: role.accountType, password: NEW_PASSWORD }),
      )) as Row;
      assert.equal(body.success, true);
      assert.equal(body.data?.message, 'Password updated. You can sign in now.');
    });

    it('an incorrect OTP is rejected as INVALID_OTP and the password is unchanged', async () => {
      const users = await accountUsers();
      const { svc } = harness(users);
      const before = users.find((u) => u.id === role.userId)!.passwordHash;
      const { requestId } = await svc.requestOtp(resetRequest(role.accountType, role.email) as any);
      await assert.rejects(
        svc.resetPassword({ requestId, otp: '654321', accountType: role.accountType, password: NEW_PASSWORD }),
        (err) => {
          assert.equal(errorCode(err), 'INVALID_OTP');
          return true;
        },
      );
      assert.equal(users.find((u) => u.id === role.userId)!.passwordHash, before);
      await svc.loginWithPassword(role.email, OLD_PASSWORD, role.accountType);
    });

    it('an expired OTP is rejected as OTP_EXPIRED', async () => {
      const { svc, otpRequests } = harness(await accountUsers());
      const { requestId } = await svc.requestOtp(resetRequest(role.accountType, role.email) as any);
      otpRequests.find((r) => r.id === requestId)!.expiresAt = new Date(Date.now() - 1000);
      await assert.rejects(
        svc.resetPassword({ requestId, otp: '123456', accountType: role.accountType, password: NEW_PASSWORD }),
        (err) => {
          assert.equal(errorCode(err), 'OTP_EXPIRED');
          return true;
        },
      );
    });

    it('an OTP that was already used cannot reset the password again', async () => {
      const { svc } = harness(await accountUsers());
      const { requestId } = await svc.requestOtp(resetRequest(role.accountType, role.email) as any);
      await svc.resetPassword({ requestId, otp: '123456', accountType: role.accountType, password: NEW_PASSWORD });
      await assert.rejects(
        svc.resetPassword({ requestId, otp: '123456', accountType: role.accountType, password: 'Another@789' }),
        (err) => errorCode(err) === 'INVALID_OTP',
      );
      await svc.loginWithPassword(role.email, NEW_PASSWORD, role.accountType);
    });

    it('a new code replaces nothing server-side: replacesRequestId is ignored for RESET_PASSWORD', async () => {
      const { svc, updateManyCalls, otpRequests } = harness(await accountUsers());
      const first = await svc.requestOtp(resetRequest(role.accountType, role.email) as any);
      await svc.requestOtp(resetRequest(role.accountType, role.email, { replacesRequestId: first.requestId }) as any);
      assert.equal(updateManyCalls.length, 0);
      assert.ok(otpRequests.find((r) => r.id === first.requestId)!.expiresAt.getTime() > Date.now());
    });
  });
}

describe('Forgot password guards', () => {
  it('an email with no account of that role gets ACCOUNT_NOT_FOUND and no OTP is created', async () => {
    const { svc, otpRequests } = harness(await accountUsers());
    await assert.rejects(svc.requestOtp(resetRequest('EMPLOYER', 'cand@example.test') as any), (err) => {
      assert.equal(errorCode(err), 'ACCOUNT_NOT_FOUND');
      return true;
    });
    assert.equal(otpRequests.length, 0);
  });

  it('a registration OTP request cannot be used to reset a password', async () => {
    const { svc } = harness(await accountUsers());
    const reg = await svc.requestOtp(register());
    await assert.rejects(
      svc.resetPassword({ requestId: reg.requestId, otp: '123456', accountType: 'CANDIDATE', password: NEW_PASSWORD }),
      (err) => errorCode(err) === 'INVALID_OTP',
    );
  });

  it('a reset OTP request cannot be used on the registration/login verify endpoint', async () => {
    const { svc } = harness(await accountUsers());
    const { requestId } = await svc.requestOtp(resetRequest('CANDIDATE', 'cand@example.test') as any);
    await assert.rejects(svc.verifyOtp({ requestId, otp: '123456' } as any), (err) => errorCode(err) === 'VALIDATION_ERROR');
  });
});

/** AuthController over HTTP with the same global prefix, pipe, interceptor and filter as main.ts / AppModule. */
async function httpApi(svc: AuthService) {
  @Module({
    controllers: [AuthController],
    providers: [
      { provide: AuthService, useValue: svc },
      { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
      { provide: APP_FILTER, useClass: HttpExceptionFilter },
    ],
  })
  class AuthHttpTestModule {}
  const app = await NestFactory.create(AuthHttpTestModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  await app.listen(0, '127.0.0.1');
  const base = `${await app.getUrl()}/api/v1`;
  return {
    close: () => app.close(),
    async post(path: string, body: Row) {
      const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: res.status, body: (await res.json()) as Row };
    },
  };
}

describe('Forgot password over HTTP: exact JSON the web client receives', () => {
  for (const role of ROLES) {
    it(`${role.accountType}: request → reset → sign in; reset body is { success, data: { message }, requestId }`, async () => {
      const { svc } = harness(await accountUsers());
      const api = await httpApi(svc);
      try {
        const requested = await api.post('/auth/otp/request', resetRequest(role.accountType, role.email));
        assert.equal(requested.status, 201);
        const requestId = requested.body.data.requestId;

        const reset = await api.post('/auth/password/reset', {
          requestId,
          otp: '123456',
          accountType: role.accountType,
          password: NEW_PASSWORD,
        });
        assert.equal(reset.status, 201);
        assert.deepEqual(reset.body, {
          success: true,
          data: { message: 'Password updated. You can sign in now.' },
          requestId: reset.body.requestId,
        });
        assert.equal(typeof reset.body.requestId, 'string');

        const login = await api.post('/auth/login', { identifier: role.email, password: NEW_PASSWORD, accountType: role.accountType });
        assert.equal(login.status, 201);
        assert.equal(login.body.data.user.id, role.userId);
        const oldLogin = await api.post('/auth/login', { identifier: role.email, password: OLD_PASSWORD, accountType: role.accountType });
        assert.equal(oldLogin.status, 401);
      } finally {
        await api.close();
      }
    });
  }

  it('wrong, expired and used OTPs and unknown fields come back as error bodies with stable codes', async () => {
    const { svc, otpRequests } = harness(await accountUsers());
    const api = await httpApi(svc);
    const reset = (requestId: string, otp: string, extra: Row = {}) =>
      api.post('/auth/password/reset', { requestId, otp, accountType: 'CANDIDATE', password: NEW_PASSWORD, ...extra });
    try {
      const first = (await api.post('/auth/otp/request', resetRequest('CANDIDATE', 'cand@example.test'))).body.data.requestId;
      const wrong = await reset(first, '654321');
      assert.deepEqual([wrong.status, wrong.body.success, wrong.body.error.code], [400, false, 'INVALID_OTP']);

      const raw = await reset(first, '123456', { role: 'x' });
      assert.deepEqual([raw.status, raw.body.error.code, raw.body.error.message], [400, 'VALIDATION_ERROR', 'property role should not exist']);

      const second = (await api.post('/auth/otp/request', resetRequest('CANDIDATE', 'cand@example.test'))).body.data.requestId;
      otpRequests.find((r) => r.id === second)!.expiresAt = new Date(Date.now() - 1000);
      const expired = await reset(second, '123456');
      assert.deepEqual([expired.status, expired.body.error.code], [400, 'OTP_EXPIRED']);

      const third = (await api.post('/auth/otp/request', resetRequest('CANDIDATE', 'cand@example.test'))).body.data.requestId;
      assert.equal((await reset(third, '123456')).status, 201);
      const used = await reset(third, '123456');
      assert.deepEqual([used.status, used.body.error.code], [400, 'INVALID_OTP']);
    } finally {
      await api.close();
    }
  });
});

describe('Auth DTO validation (global ValidationPipe settings)', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
  const validate = (metatype: unknown, body: Row) =>
    pipe.transform(body, { type: 'body', metatype: metatype as never, data: '' });

  for (const role of ROLES) {
    it(`accepts the forgot-password request and reset payloads sent by the web page (${role.accountType})`, async () => {
      await validate(RequestOtpDto, resetRequest(role.accountType, role.email));
      await validate(ResetPasswordDto, { requestId: 'otp-request-id-1', otp: '123456', accountType: role.accountType, password: NEW_PASSWORD });
    });
  }

  it('still rejects unknown properties and keeps registration strict', async () => {
    await assert.rejects(
      validate(ResetPasswordDto, { requestId: 'otp-request-id-1', otp: '123456', accountType: 'CANDIDATE', password: NEW_PASSWORD, role: 'x' }),
      BadRequestException,
    );
    await assert.rejects(validate(RequestOtpDto, { ...register(), password: undefined }), BadRequestException);
    await assert.rejects(validate(RequestOtpDto, { ...register(), fullName: undefined }), BadRequestException);
    await validate(RequestOtpDto, register({ replacesRequestId: 'otp-1' }));
  });
});
