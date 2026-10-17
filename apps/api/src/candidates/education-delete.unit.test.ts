/**
 * SEC-AUTHZ-023 / FIND-B1-002: removeEducation must 404 when zero owned rows deleted.
 * Run: node -r ts-node/register/transpile-only --test src/candidates/education-delete.unit.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { CandidatesService } from './candidates.service';

type Edu = { id: string; candidateId: string; qualification: string };

function harness(opts: { callerUserId: string; callerCandidateId: string; education: Edu[] }) {
  const education = opts.education.map((e) => ({ ...e }));
  const deleteCalls: Array<{ id: string; candidateId: string }> = [];

  const baseCandidate = {
    id: opts.callerCandidateId,
    userId: opts.callerUserId,
    firstName: 'A',
    lastName: 'Cand',
    city: 'Madurai',
    state: 'Tamil Nadu',
    preferredWorkCity: null,
    profileCompletion: 50,
    hasExperience: 'NO',
    experienceLevel: 'fresher',
    photoUrl: null,
    education: education.filter((e) => e.candidateId === opts.callerCandidateId),
    skills: [],
    experiences: [],
    user: { phone: '+919800000001', email: 'a@example.test' },
  };

  const prisma = {
    candidate: {
      findUnique: async ({ where }: { where: { userId: string } }) => {
        if (where.userId !== opts.callerUserId) return null;
        return {
          ...baseCandidate,
          education: education.filter((e) => e.candidateId === opts.callerCandidateId),
        };
      },
      update: async ({ where }: { where: { userId: string }; data: unknown }) => {
        if (where.userId !== opts.callerUserId) throw new Error('wrong user');
        return {
          ...baseCandidate,
          education: education.filter((e) => e.candidateId === opts.callerCandidateId),
        };
      },
    },
    candidateEducation: {
      deleteMany: async ({ where }: { where: { id: string; candidateId: string } }) => {
        deleteCalls.push({ id: where.id, candidateId: where.candidateId });
        const before = education.length;
        for (let i = education.length - 1; i >= 0; i--) {
          if (education[i].id === where.id && education[i].candidateId === where.candidateId) {
            education.splice(i, 1);
          }
        }
        return { count: before - education.length };
      },
    },
  };

  const service = new CandidatesService(
    prisma as never,
    { recomputeMatchesForPublishedJobs: async () => undefined } as never,
    {} as never,
    {
      isConfigured: () => false,
      getSignedUrl: async () => {
        throw new Error('no signer');
      },
    } as never,
    { markEligible: async () => undefined } as never,
    {} as never,
  );

  return { service, education, deleteCalls };
}

describe('removeEducation ownership (SEC-AUTHZ-023)', () => {
  it('throws NotFoundException for another candidate education id and leaves the row', async () => {
    const foreign: Edu = {
      id: 'edu-b',
      candidateId: 'cand-b',
      qualification: 'BSc',
    };
    const { service, education, deleteCalls } = harness({
      callerUserId: 'user-a',
      callerCandidateId: 'cand-a',
      education: [foreign],
    });

    await assert.rejects(
      () => service.removeEducation('user-a', 'edu-b'),
      (err: unknown) => {
        assert.ok(err instanceof NotFoundException);
        const body = (err as NotFoundException).getResponse() as { message?: string; code?: string };
        const msg = typeof body === 'string' ? body : body.message;
        assert.match(String(msg), /Education record was not found/i);
        return true;
      },
    );

    assert.equal(education.length, 1);
    assert.equal(education[0].id, 'edu-b');
    assert.equal(education[0].candidateId, 'cand-b');
    assert.deepEqual(deleteCalls, [{ id: 'edu-b', candidateId: 'cand-a' }]);
  });

  it('deletes the caller-owned education and returns a profile', async () => {
    const own: Edu = {
      id: 'edu-a',
      candidateId: 'cand-a',
      qualification: 'BSc',
    };
    const { service, education, deleteCalls } = harness({
      callerUserId: 'user-a',
      callerCandidateId: 'cand-a',
      education: [own],
    });

    const result = await service.removeEducation('user-a', 'edu-a');
    assert.equal(education.length, 0);
    assert.deepEqual(deleteCalls, [{ id: 'edu-a', candidateId: 'cand-a' }]);
    assert.ok(result && typeof result === 'object');
    assert.equal((result as { id?: string }).id, 'cand-a');
  });
});
