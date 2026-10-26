/**
 * Human-mock list/create/complete stay candidate-only; token join stays invite-only.
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
import { HumanMocksController } from './human-mocks.controller';

const reflector = new Reflector();
const guard = new RolesGuard(reflector);

function ctx(handler: (...args: never[]) => unknown, role?: string) {
  return {
    getHandler: () => handler,
    getClass: () => HumanMocksController,
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { id: 'u', role } : undefined }) }),
  } as never;
}

function method(name: keyof HumanMocksController) {
  return HumanMocksController.prototype[name] as (...args: never[]) => unknown;
}

describe('HumanMocksController authorization', () => {
  for (const name of ['list', 'schedule', 'complete'] as const) {
    it(`${name} is candidate-only and not public`, () => {
      const handler = method(name);
      assert.deepEqual(reflector.getAllAndOverride(ROLES_KEY, [handler, HumanMocksController]), [
        UserType.CANDIDATE,
      ]);
      assert.equal(reflector.getAllAndOverride(IS_PUBLIC_KEY, [handler, HumanMocksController]), undefined);
      assert.equal(guard.canActivate(ctx(handler, UserType.CANDIDATE)), true);
      assert.equal(guard.canActivate(ctx(handler, UserType.EMPLOYER_ADMIN)), false);
      assert.equal(guard.canActivate(ctx(handler)), false);
    });
  }

  it('get is public so invitees can present a token; the handler still 401s without token or session', () => {
    const handler = method('get');
    assert.equal(reflector.getAllAndOverride(IS_PUBLIC_KEY, [handler, HumanMocksController]), true);
  });

  it('join/signal/peek stay token-or-owner public for the live room', () => {
    for (const name of ['join', 'signal', 'peek'] as const) {
      const handler = method(name);
      assert.equal(reflector.getAllAndOverride(IS_PUBLIC_KEY, [handler, HumanMocksController]), true, name);
    }
  });
});
