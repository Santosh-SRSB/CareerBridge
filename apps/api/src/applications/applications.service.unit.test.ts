/**
 * Candidate interview list with an in-memory Prisma double: cancelled interviews are excluded from the
 * normal list at the query level but stay stored and reachable through the detail endpoint.
 * Run: npm run test:interview
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApplicationsService } from './applications.service';

type Row = Record<string, any>;

const CANDIDATE = { id: 'cand-1', userId: 'user-1' };
const OTHER_CANDIDATE = { id: 'cand-2', userId: 'user-2' };

function interview(id: string, status: string, hoursFromNow: number, candidateId = CANDIDATE.id): Row {
  return {
    id,
    applicationId: `app-${id}`,
    candidateId,
    scheduledAt: new Date(Date.now() + hoursFromNow * 3_600_000),
    durationMin: 30,
    mode: 'VIDEO',
    location: 'https://meet.google.com/abc-defg-hij',
    meetingUrl: null,
    status,
    notes: null,
    whatsappStatus: null,
    application: { status: 'INTERVIEW', job: { title: `Job ${id}`, employer: { companyName: 'Acme Pvt Ltd' } } },
  };
}

function matches(row: Row, where: Row) {
  return Object.entries(where).every(([key, cond]) =>
    cond && typeof cond === 'object' && 'not' in cond ? row[key] !== cond.not : row[key] === cond,
  );
}

function harness(rows: Row[]) {
  const queries: Row[] = [];
  const prisma: any = {
    candidate: {
      findUnique: async ({ where }: Row) =>
        [CANDIDATE, OTHER_CANDIDATE].find((c) => c.userId === where.userId) ?? null,
    },
    employerInterview: {
      findMany: async ({ where }: Row) => {
        queries.push(where);
        return rows.filter((row) => matches(row, where));
      },
      findFirst: async ({ where }: Row) => rows.find((row) => matches(row, where)) ?? null,
    },
  };
  const config = { get: (_key: string, fallback?: unknown) => fallback };
  const svc = new ApplicationsService(
    prisma,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    config as any,
    {} as any,
    {} as any,
  );
  return { svc, rows, queries };
}

describe('Candidate interview list hides cancelled interviews', () => {
  const seed = () => [
    interview('scheduled', 'SCHEDULED', 24),
    interview('confirmed', 'CONFIRMED', 48),
    interview('reschedule', 'RESCHEDULE_NEEDED', 72),
    interview('completed', 'COMPLETED', -48),
    interview('cancelled', 'CANCELLED', 96),
    interview('cancelled-past', 'CANCELLED', -24),
    interview('other-candidate', 'SCHEDULED', 24, OTHER_CANDIDATE.id),
  ];

  it('filters CANCELLED in the database query, not only in the UI', async () => {
    const { svc, queries } = harness(seed());
    await svc.listScheduledInterviews(CANDIDATE.userId);
    assert.deepEqual(queries, [{ candidateId: CANDIDATE.id, status: { not: 'CANCELLED' } }]);
  });

  it('active, scheduled and past non-cancelled interviews are listed unchanged; cancelled ones are not', async () => {
    const { svc } = harness(seed());
    const list = await svc.listScheduledInterviews(CANDIDATE.userId);
    assert.deepEqual(
      list.map((item) => [item.id, item.status]).sort(),
      [
        ['completed', 'COMPLETED'],
        ['confirmed', 'CONFIRMED'],
        ['reschedule', 'RESCHEDULE_NEEDED'],
        ['scheduled', 'PENDING_CONFIRMATION'],
      ],
    );
    assert.ok(list.every((item) => item.status !== 'CANCELLED'));
  });

  it('cancelled records remain stored and the detail endpoint (notification link) still returns them', async () => {
    const { svc, rows } = harness(seed());
    await svc.listScheduledInterviews(CANDIDATE.userId);
    assert.equal(rows.filter((row) => row.status === 'CANCELLED').length, 2);
    const detail = await svc.getScheduledInterview(CANDIDATE.userId, 'cancelled');
    assert.equal(detail.status, 'CANCELLED');
    assert.equal(detail.cancelledBy, 'EMPLOYER');
  });

  it("another candidate's interviews are never listed", async () => {
    const { svc } = harness(seed());
    const list = await svc.listScheduledInterviews(OTHER_CANDIDATE.userId);
    assert.deepEqual(list.map((item) => item.id), ['other-candidate']);
  });
});
