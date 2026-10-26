/**
 * Resume routes stay candidate-authenticated except the two intentional public workers.
 * Run: npm.cmd run test:resume -w api
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Reflector } from '@nestjs/core';
import { UserType } from '../prisma/client';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ResumesController } from './resumes.controller';

const reflector = new Reflector();
const guard = new RolesGuard(reflector);

function ctx(handler: (...args: never[]) => unknown, role?: string) {
  return {
    getHandler: () => handler,
    getClass: () => ResumesController,
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { id: 'u', role } : undefined }) }),
  } as never;
}

function method(name: keyof ResumesController) {
  return ResumesController.prototype[name] as (...args: never[]) => unknown;
}

describe('ResumesController authorization', () => {
  it('class default is candidate-only and not public', () => {
    assert.deepEqual(Reflect.getMetadata(ROLES_KEY, ResumesController), [UserType.CANDIDATE]);
    assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, ResumesController), undefined);
  });

  for (const name of ['list', 'create', 'get', 'upload', 'download', 'viewUrl'] as const) {
    it(`${name} rejects anonymous and employer callers`, () => {
      const handler = method(name);
      assert.equal(reflector.getAllAndOverride(IS_PUBLIC_KEY, [handler, ResumesController]), undefined);
      assert.equal(guard.canActivate(ctx(handler, UserType.CANDIDATE)), true);
      assert.equal(guard.canActivate(ctx(handler, UserType.EMPLOYER_ADMIN)), false);
      assert.equal(guard.canActivate(ctx(handler)), false);
    });
  }

  it('structure-text remains the public AI helper, not a private resume read', () => {
    const handler = method('structureText');
    assert.equal(reflector.getAllAndOverride(IS_PUBLIC_KEY, [handler, ResumesController]), true);
    assert.equal(guard.canActivate(ctx(handler)), true);
  });

  it('worker/process stays a secret-gated callback, not a candidate session read', () => {
    const handler = method('processWorker');
    assert.equal(reflector.getAllAndOverride(IS_PUBLIC_KEY, [handler, ResumesController]), true);
  });
});
