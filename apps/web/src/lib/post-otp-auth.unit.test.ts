import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AuthSession, AuthUser } from '@careerbridge/shared';
import { POST_REGISTRATION_PATH } from './onboarding-flow';
import {
  CANDIDATE_REGISTERED_TOAST,
  isAuthSession,
  resolvePostOtpAuthAction,
} from './post-otp-auth';

const candidate: AuthUser = {
  id: 'cand-1',
  role: 'CANDIDATE',
  phone: '+919800000001',
  firstName: 'Asha',
  email: 'asha@example.test',
  onboardingCompleted: false,
  dashboardReached: false,
};

const session: AuthSession = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  tokenType: 'Bearer',
  expiresIn: 3600,
  user: candidate,
};

describe('isAuthSession', () => {
  it('accepts a complete session and rejects failed or employer sign-in-required payloads', () => {
    assert.equal(isAuthSession(session), true);
    assert.equal(isAuthSession({ registered: true, signInRequired: true }), false);
    assert.equal(isAuthSession(null), false);
    assert.equal(isAuthSession({ accessToken: '', refreshToken: 'r', user: candidate } as AuthSession), false);
  });
});

describe('resolvePostOtpAuthAction', () => {
  it('logs a newly registered candidate in and sends them to onboarding', () => {
    const action = resolvePostOtpAuthAction(session, 'REGISTER', 'CANDIDATE');
    assert.equal(action.type, 'authenticated');
    if (action.type !== 'authenticated') return;
    assert.equal(action.path, POST_REGISTRATION_PATH);
    assert.equal(action.path, '/onboarding');
    assert.equal(action.toast, CANDIDATE_REGISTERED_TOAST);
    assert.equal(action.session.accessToken, session.accessToken);
    assert.equal(action.session.user.role, 'CANDIDATE');
    assert.equal(action.session.user.onboardingCompleted, false);
  });

  it('keeps employer registration on the existing sign-in-required path', () => {
    const action = resolvePostOtpAuthAction(
      { registered: true, signInRequired: true },
      'REGISTER',
      'EMPLOYER',
    );
    assert.deepEqual(action, {
      type: 'sign-in-required',
      path: '/login?registered=1&role=employer',
    });
    assert.equal(isAuthSession({ registered: true, signInRequired: true }), false);
  });

  it('does not establish a session when registration verification returns no tokens', () => {
    assert.equal(resolvePostOtpAuthAction(undefined, 'REGISTER', 'CANDIDATE').type, 'invalid');
    assert.equal(resolvePostOtpAuthAction({} as AuthSession, 'REGISTER', 'CANDIDATE').type, 'invalid');
  });

  it('duplicate successful candidate results stay on the same authenticated destination', () => {
    const first = resolvePostOtpAuthAction(session, 'REGISTER', 'CANDIDATE');
    const second = resolvePostOtpAuthAction(session, 'REGISTER', 'CANDIDATE');
    assert.deepEqual(first, second);
    assert.equal(first.type, 'authenticated');
  });

  it('candidate login still uses the existing post-auth destination', () => {
    const onboarded: AuthSession = {
      ...session,
      user: { ...candidate, onboardingCompleted: true, dashboardReached: true },
    };
    const action = resolvePostOtpAuthAction(onboarded, 'LOGIN', 'CANDIDATE');
    assert.equal(action.type, 'authenticated');
    if (action.type !== 'authenticated') return;
    assert.equal(action.path, '/dashboard');
    assert.equal(action.toast, undefined);
  });

  it('a signed-in candidate can open protected onboarding immediately after registration', () => {
    const action = resolvePostOtpAuthAction(session, 'REGISTER', 'CANDIDATE');
    assert.equal(action.type, 'authenticated');
    if (action.type !== 'authenticated') return;
    assert.ok(action.session.accessToken);
    assert.ok(action.session.refreshToken);
    assert.equal(action.session.user.id, 'cand-1');
  });
});
