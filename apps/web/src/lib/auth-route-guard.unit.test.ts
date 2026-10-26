import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isPublicHumanMockRoom,
  requiresCandidateAuth,
  resolveAuthRedirect,
} from './auth-route-guard';

describe('isPublicHumanMockRoom', () => {
  it('allows only the live room when a join token is present', () => {
    assert.equal(isPublicHumanMockRoom('/interviews/human/abc/room', '?token=join-token'), true);
    assert.equal(
      isPublicHumanMockRoom('/interviews/human/abc/room', new URLSearchParams('role=interviewer&token=join-token')),
      true,
    );
    assert.equal(isPublicHumanMockRoom('/interviews/human/abc/room', '?token='), false);
    assert.equal(isPublicHumanMockRoom('/interviews/human/abc/room', ''), false);
    assert.equal(isPublicHumanMockRoom('/interviews/human/abc', '?token=join-token'), false);
    assert.equal(isPublicHumanMockRoom('/interviews/human/abc/score', '?token=join-token'), false);
  });
});

describe('requiresCandidateAuth', () => {
  it('protects resume and interview product pages', () => {
    for (const path of [
      '/resume',
      '/resume/builder',
      '/resume/abc',
      '/resumes',
      '/interviews',
      '/interviews/mock',
      '/interviews/mock/abc/result',
      '/interviews/human/abc',
      '/interviews/human/abc/room',
      '/interviews/human/abc/score',
    ]) {
      assert.equal(requiresCandidateAuth(path), true, path);
    }
  });

  it('does not protect public marketing or job pages', () => {
    for (const path of ['/', '/jobs', '/jobs/abc', '/login', '/register', '/employer/welcome']) {
      assert.equal(requiresCandidateAuth(path), false, path);
    }
  });

  it('leaves tokenized human-mock rooms public', () => {
    assert.equal(requiresCandidateAuth('/interviews/human/abc/room', '?token=join-token'), false);
  });
});

describe('resolveAuthRedirect', () => {
  it('sends signed-out visitors from resume and interviews to candidate login', () => {
    assert.deepEqual(resolveAuthRedirect({ pathname: '/resume', signedIn: false }), {
      pathname: '/login',
      role: 'candidate',
      next: '/resume',
    });
    assert.deepEqual(resolveAuthRedirect({ pathname: '/interviews/mock', signedIn: false }), {
      pathname: '/login',
      role: 'candidate',
      next: '/interviews/mock',
    });
  });

  it('does not redirect signed-in candidates or tokenized invitees', () => {
    assert.equal(resolveAuthRedirect({ pathname: '/resume', signedIn: true }), null);
    assert.equal(
      resolveAuthRedirect({
        pathname: '/interviews/human/abc/room',
        search: '?role=interviewer&token=join-token',
        signedIn: false,
      }),
      null,
    );
  });

  it('keeps existing employer public entry points and employer login redirect', () => {
    assert.equal(resolveAuthRedirect({ pathname: '/employer/register', signedIn: false }), null);
    assert.equal(resolveAuthRedirect({ pathname: '/employer/welcome', signedIn: false }), null);
    assert.equal(resolveAuthRedirect({ pathname: '/employer/terms', signedIn: false }), null);
    assert.deepEqual(resolveAuthRedirect({ pathname: '/employer/jobs', signedIn: false }), {
      pathname: '/login',
      role: 'employer',
      next: '/employer/jobs',
    });
    assert.equal(resolveAuthRedirect({ pathname: '/employer/jobs', signedIn: true }), null);
  });
});
