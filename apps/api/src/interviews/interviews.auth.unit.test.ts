/**
 * Mock-interview HTTP routes require a candidate session.
 * Run: npm.cmd run test:interview -w api
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Reflector } from '@nestjs/core';
import { UserType } from '../prisma/client';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { InterviewsController } from './interviews.controller';

const reflector = new Reflector();
const guard = new RolesGuard(reflector);

function ctx(handler: (...args: never[]) => unknown, role?: string) {
  return {
    getHandler: () => handler,
    getClass: () => InterviewsController,
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { id: 'u', role } : undefined }) }),
  } as never;
}

function method(name: keyof InterviewsController) {
  return InterviewsController.prototype[name] as (...args: never[]) => unknown;
}

describe('InterviewsController authorization', () => {
  it('class default is candidate-only and not public', () => {
    assert.deepEqual(Reflect.getMetadata(ROLES_KEY, InterviewsController), [UserType.CANDIDATE]);
    assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, InterviewsController), undefined);
  });

  for (const name of ['list', 'start', 'createLive', 'get', 'pdf', 'end'] as const) {
    it(`${name} rejects anonymous and employer callers`, () => {
      const handler = method(name);
      assert.equal(reflector.getAllAndOverride(IS_PUBLIC_KEY, [handler, InterviewsController]), undefined);
      assert.equal(guard.canActivate(ctx(handler, UserType.CANDIDATE)), true);
      assert.equal(guard.canActivate(ctx(handler, UserType.EMPLOYER_ADMIN)), false);
      assert.equal(guard.canActivate(ctx(handler, UserType.EMPLOYER_RECRUITER)), false);
      assert.equal(guard.canActivate(ctx(handler)), false);
    });
  }
});
