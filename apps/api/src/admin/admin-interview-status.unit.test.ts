import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import {
  ADMIN_INTERVIEW_STATUS_LABELS,
  ADMIN_INTERVIEW_STATUSES,
  deriveAdminInterviewStatus,
  type AdminInterviewStatusInput,
} from './admin-interview-status';
import { AdminService } from './admin.service';

type Row = Record<string, any>;

const NOW = new Date('2026-10-07T10:00:00.000Z');
const HOUR = 3_600_000;
const futureSlot = { scheduledAt: new Date(NOW.getTime() + 24 * HOUR), durationMin: 30 };
const pastSlot = { scheduledAt: new Date(NOW.getTime() - 3 * HOUR), durationMin: 30 };

const derive = (
  applicationStatus: string,
  interview: AdminInterviewStatusInput['interview'],
  extra: Partial<AdminInterviewStatusInput> = {},
) => deriveAdminInterviewStatus({ applicationStatus, interview, now: NOW, ...extra });

describe('deriveAdminInterviewStatus — stakeholder flow', () => {
  it('1. application SHORTLISTED + no interview → Profile Shortlisted', () => {
    assert.equal(derive('SHORTLISTED', null), 'PROFILE_SHORTLISTED');
  });
  it('applications outside the interview flow without an interview are not listed', () => {
    for (const app of ['APPLIED', 'UNDER_REVIEW', 'INTERVIEW', 'ON_HOLD', 'WITHDRAWN']) {
      assert.equal(derive(app, null), null, app);
    }
  });

  it('2. interview SCHEDULED + no reschedule → Interview Scheduled', () => {
    assert.equal(derive('INTERVIEW', { status: 'SCHEDULED', ...futureSlot }), 'INTERVIEW_SCHEDULED');
  });
  it('3. interview CONFIRMED + no reschedule → Interview Scheduled', () => {
    assert.equal(derive('INTERVIEW', { status: 'CONFIRMED', ...futureSlot }), 'INTERVIEW_SCHEDULED');
  });

  it('4. interview RESCHEDULE_NEEDED → Interview Rescheduled', () => {
    assert.equal(derive('INTERVIEW', { status: 'RESCHEDULE_NEEDED', ...futureSlot }), 'INTERVIEW_RESCHEDULED');
  });
  it('5. interview RESCHEDULE_REQUESTED → Interview Rescheduled', () => {
    assert.equal(derive('INTERVIEW', { status: 'RESCHEDULE_REQUESTED', ...futureSlot }), 'INTERVIEW_RESCHEDULED');
  });
  it('candidate reschedule slots past their old time stay Interview Rescheduled (no agreed time yet)', () => {
    assert.equal(derive('INTERVIEW', { status: 'RESCHEDULE_REQUESTED', ...pastSlot }), 'INTERVIEW_RESCHEDULED');
  });
  it('7. interview with an employer reschedule audit row → Interview Rescheduled', () => {
    assert.equal(
      derive('INTERVIEW', { status: 'SCHEDULED', ...futureSlot }, { employerRescheduled: true }),
      'INTERVIEW_RESCHEDULED',
    );
    assert.equal(
      derive('INTERVIEW', { status: 'CONFIRMED', ...futureSlot }, { employerRescheduled: true }),
      'INTERVIEW_RESCHEDULED',
    );
  });
  it('a recorded candidate reschedule request keeps the interview Interview Rescheduled after re-confirmation', () => {
    assert.equal(
      derive('INTERVIEW', { status: 'CONFIRMED', ...futureSlot, candidateRescheduleRequestedAt: NOW }),
      'INTERVIEW_RESCHEDULED',
    );
  });

  it('8. interview COMPLETED + application still INTERVIEW → Feedback Pending', () => {
    assert.equal(derive('INTERVIEW', { status: 'COMPLETED', ...pastSlot }), 'FEEDBACK_PENDING');
    assert.equal(derive('ON_HOLD', { status: 'COMPLETED', ...pastSlot }), 'FEEDBACK_PENDING');
  });
  it('9. confirmed interview past its end time + no outcome → Feedback Pending', () => {
    assert.equal(derive('INTERVIEW', { status: 'CONFIRMED', ...pastSlot }), 'FEEDBACK_PENDING');
    assert.equal(derive('INTERVIEW', { status: 'SCHEDULED', ...pastSlot }), 'FEEDBACK_PENDING');
    assert.equal(derive('ON_HOLD', { status: 'CONFIRMED', ...pastSlot }), 'FEEDBACK_PENDING');
  });
  it('end time uses scheduledEnd when present, else scheduledAt + durationMin', () => {
    const inProgress = { status: 'CONFIRMED', scheduledAt: new Date(NOW.getTime() - 10 * 60_000), durationMin: 30 };
    assert.equal(derive('INTERVIEW', inProgress), 'INTERVIEW_SCHEDULED');
    assert.equal(
      derive('INTERVIEW', { ...inProgress, scheduledEnd: new Date(NOW.getTime() - 60_000) }),
      'FEEDBACK_PENDING',
    );
  });
  it('10. past interview with a final SELECTED outcome → Selected, not Feedback Pending', () => {
    assert.equal(derive('SELECTED', { status: 'CONFIRMED', ...pastSlot }), 'SELECTED');
    assert.equal(derive('SELECTED', { status: 'COMPLETED', ...pastSlot }), 'SELECTED');
  });
  it('11. past interview with a REJECTED outcome → Rejected, not Feedback Pending', () => {
    assert.equal(derive('REJECTED', { status: 'CONFIRMED', ...pastSlot }), 'REJECTED');
    assert.equal(derive('REJECTED', { status: 'COMPLETED', ...pastSlot }), 'REJECTED');
  });

  it('12. application SELECTED → Selected', () => {
    assert.equal(derive('SELECTED', { status: 'SCHEDULED', ...futureSlot }), 'SELECTED');
    assert.equal(derive('SELECTED', null), 'SELECTED');
  });
  it('13. application HIRED → Selected', () => {
    assert.equal(derive('HIRED', { status: 'COMPLETED', ...pastSlot }), 'SELECTED');
    assert.equal(derive('HIRED', null), 'SELECTED');
  });
  it('14. application REJECTED → Rejected', () => {
    assert.equal(derive('REJECTED', { status: 'SCHEDULED', ...futureSlot }), 'REJECTED');
    assert.equal(derive('REJECTED', null), 'REJECTED');
  });

  it('15. interview CANCELLED → Cancelled, never Scheduled/Rescheduled/Feedback Pending/Selected/Rejected', () => {
    for (const app of ['INTERVIEW', 'ON_HOLD', 'SELECTED', 'HIRED', 'REJECTED', 'SHORTLISTED']) {
      assert.equal(derive(app, { status: 'CANCELLED', ...pastSlot }), 'CANCELLED', `past ${app}`);
      assert.equal(
        derive(app, { status: 'CANCELLED', ...futureSlot, candidateRescheduleRequestedAt: NOW }, { employerRescheduled: true }),
        'CANCELLED',
        `future ${app}`,
      );
    }
  });
  it('a withdrawn application shows its interview as Cancelled', () => {
    assert.equal(derive('WITHDRAWN', { status: 'CONFIRMED', ...futureSlot }), 'CANCELLED');
  });
});

describe('deriveAdminInterviewStatus — priority', () => {
  const rescheduledPast = { status: 'COMPLETED', ...pastSlot, candidateRescheduleRequestedAt: NOW };
  it('Rejected overrides Selected-era, Feedback Pending and Rescheduled signals', () => {
    assert.equal(derive('REJECTED', rescheduledPast, { employerRescheduled: true }), 'REJECTED');
  });
  it('Selected overrides Feedback Pending and Rescheduled', () => {
    assert.equal(derive('HIRED', rescheduledPast, { employerRescheduled: true }), 'SELECTED');
  });
  it('Feedback Pending overrides Rescheduled', () => {
    assert.equal(derive('INTERVIEW', rescheduledPast, { employerRescheduled: true }), 'FEEDBACK_PENDING');
    assert.equal(
      derive('INTERVIEW', { status: 'CONFIRMED', ...pastSlot }, { employerRescheduled: true }),
      'FEEDBACK_PENDING',
    );
  });
  it('Rescheduled overrides Scheduled', () => {
    assert.equal(derive('INTERVIEW', { status: 'SCHEDULED', ...futureSlot }, { employerRescheduled: true }), 'INTERVIEW_RESCHEDULED');
  });
  it('Profile Shortlisted only applies without an interview', () => {
    assert.equal(derive('SHORTLISTED', null), 'PROFILE_SHORTLISTED');
    assert.equal(derive('SHORTLISTED', { status: 'SCHEDULED', ...futureSlot }), 'INTERVIEW_SCHEDULED');
  });
  it('every admin status has a stakeholder label and none exposes raw reschedule enums', () => {
    assert.deepEqual(Object.keys(ADMIN_INTERVIEW_STATUS_LABELS).sort(), [...ADMIN_INTERVIEW_STATUSES].sort());
    assert.deepEqual(Object.values(ADMIN_INTERVIEW_STATUS_LABELS), [
      'Profile Shortlisted',
      'Interview Scheduled',
      'Interview Rescheduled',
      'Feedback Pending',
      'Selected',
      'Rejected',
      'Cancelled',
    ]);
  });
});

/* ---------- AdminService list + detail ---------- */

function interviewRow(id: string, status: string, applicationStatus: string, scheduledAt: Date, extra: Row = {}): Row {
  return {
    id,
    applicationId: `APP-${id}`,
    status,
    mode: 'VIDEO',
    scheduledAt,
    scheduledEnd: null,
    durationMin: 30,
    whatsappStatus: null,
    candidateRescheduleRequestedAt: null,
    confirmedAt: null,
    candidateFeedbackAt: null,
    createdAt: new Date(scheduledAt.getTime() - 48 * HOUR),
    job: { title: `Job ${id}` },
    candidate: { firstName: `Cand ${id}`, lastName: null },
    employer: { companyName: 'Acme' },
    application: { status: applicationStatus, hiringOutcome: null },
    ...extra,
  };
}

function listHarness() {
  const soon = new Date(Date.now() + 24 * HOUR);
  const past = new Date(Date.now() - 5 * HOUR);
  const interviews = [
    interviewRow('IV-SCHED', 'SCHEDULED', 'INTERVIEW', soon),
    interviewRow('IV-RESCH-CAND', 'RESCHEDULE_REQUESTED', 'INTERVIEW', soon),
    interviewRow('IV-RESCH-EMP', 'SCHEDULED', 'INTERVIEW', new Date(soon.getTime() + HOUR)),
    interviewRow('IV-FEEDBACK', 'CONFIRMED', 'INTERVIEW', past),
    interviewRow('IV-SELECTED', 'COMPLETED', 'HIRED', past),
    interviewRow('IV-REJECTED', 'CONFIRMED', 'REJECTED', past),
    interviewRow('IV-CANCELLED', 'CANCELLED', 'INTERVIEW', soon),
  ];
  const audits = [
    { id: 'A1', action: 'INTERVIEW_RESCHEDULED', resourceType: 'INTERVIEW', resourceId: 'IV-RESCH-EMP', userId: 'u-emp', createdAt: new Date() },
  ];
  const shortlisted = [
    {
      id: 'APP-SL',
      status: 'SHORTLISTED',
      updatedAt: new Date(),
      job: { title: 'Picker', employer: { companyName: 'Acme' } },
      candidate: { firstName: 'Short', lastName: 'Listed' },
    },
  ];
  const calls = { interviewWhere: [] as Row[], applicationWhere: [] as Row[] };
  const prisma = {
    employerInterview: {
      findMany: async ({ where }: Row) => {
        calls.interviewWhere.push(where);
        return interviews.filter((r) => !where.status || r.status === where.status);
      },
      findUnique: async ({ where }: Row) => interviews.find((r) => r.id === where.id) ?? null,
    },
    application: {
      findMany: async ({ where }: Row) => {
        calls.applicationWhere.push(where);
        return shortlisted;
      },
    },
    auditLog: {
      findMany: async ({ where }: Row) =>
        audits.filter(
          (a) =>
            (!where.action || a.action === where.action) &&
            a.resourceType === where.resourceType &&
            (where.resourceId?.in ? where.resourceId.in.includes(a.resourceId) : a.resourceId === where.resourceId),
        ),
    },
    user: { findMany: async () => [{ id: 'u-emp', email: 'emp@example.test', userType: 'EMPLOYER' }] },
    whatsAppMessage: { findMany: async () => [] },
  };
  const service = new AdminService(prisma as never, {} as never, {} as never);
  return { service, calls, interviews };
}

describe('AdminService.interviews — derived adminStatus list', () => {
  it('returns raw status, applicationStatus and adminStatus for every row, plus shortlisted applications', async () => {
    const { service } = listHarness();
    const rows: Row[] = await service.interviews();
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    assert.equal(byId['IV-SCHED'].adminStatus, 'INTERVIEW_SCHEDULED');
    assert.equal(byId['IV-RESCH-CAND'].adminStatus, 'INTERVIEW_RESCHEDULED');
    assert.equal(byId['IV-RESCH-CAND'].status, 'RESCHEDULE_REQUESTED', 'raw status preserved');
    assert.equal(byId['IV-RESCH-EMP'].adminStatus, 'INTERVIEW_RESCHEDULED');
    assert.equal(byId['IV-FEEDBACK'].adminStatus, 'FEEDBACK_PENDING');
    assert.equal(byId['IV-SELECTED'].adminStatus, 'SELECTED');
    assert.equal(byId['IV-SELECTED'].applicationStatus, 'HIRED');
    assert.equal(byId['IV-REJECTED'].adminStatus, 'REJECTED');
    assert.equal(byId['IV-CANCELLED'].adminStatus, 'CANCELLED');
    assert.equal(byId['IV-CANCELLED'].adminStatusLabel, 'Cancelled');
    const sl = byId['APP-SL'];
    assert.equal(sl.recordType, 'APPLICATION');
    assert.equal(sl.adminStatus, 'PROFILE_SHORTLISTED');
    assert.equal(sl.adminStatusLabel, 'Profile Shortlisted');
    assert.equal(sl.interviewId, null);
    assert.equal(sl.scheduledAt, null);
    assert.ok(rows.every((r) => !('sortAt' in r)));
  });

  it('shortlisted-application query excludes applications with an active interview', async () => {
    const { service, calls } = listHarness();
    await service.interviews();
    const where = calls.applicationWhere[0];
    assert.equal(where.status, 'SHORTLISTED');
    assert.deepEqual(where.employerInterviews.none.status.in.sort(), [
      'CONFIRMED',
      'PROPOSED',
      'RESCHEDULE_NEEDED',
      'RESCHEDULE_REQUESTED',
      'SCHEDULED',
    ]);
  });

  const cases: Array<[string, string[]]> = [
    ['PROFILE_SHORTLISTED', ['APP-SL']],
    ['INTERVIEW_SCHEDULED', ['IV-SCHED']],
    ['INTERVIEW_RESCHEDULED', ['IV-RESCH-CAND', 'IV-RESCH-EMP']],
    ['FEEDBACK_PENDING', ['IV-FEEDBACK']],
    ['SELECTED', ['IV-SELECTED']],
    ['REJECTED', ['IV-REJECTED']],
    ['CANCELLED', ['IV-CANCELLED']],
  ];
  for (const [filter, expected] of cases) {
    it(`filter ${filter} returns only matching rows`, async () => {
      const { service } = listHarness();
      const rows: Row[] = await service.interviews(undefined, filter);
      assert.deepEqual(rows.map((r) => r.id).sort(), [...expected].sort());
      assert.ok(rows.every((r) => r.adminStatus === filter));
    });
  }

  it('PROFILE_SHORTLISTED filter does not query interviews; raw filters skip shortlisted applications', async () => {
    const a = listHarness();
    await a.service.interviews(undefined, 'PROFILE_SHORTLISTED');
    assert.equal(a.calls.interviewWhere.length, 0);
    const b = listHarness();
    const rows: Row[] = await b.service.interviews(undefined, 'RESCHEDULE_REQUESTED');
    assert.equal(b.calls.applicationWhere.length, 0);
    assert.deepEqual(rows.map((r) => r.id), ['IV-RESCH-CAND']);
  });

  it('unknown filter values are rejected with 400', async () => {
    const { service } = listHarness();
    await assert.rejects(service.interviews(undefined, 'FEEDBACK'), BadRequestException);
  });
});

describe('AdminService.interviewDetails — derived status + recorded events', () => {
  it('returns raw + derived status and events only from real timestamps', async () => {
    const { service } = listHarness();
    const detail: Row = await service.interviewDetails('IV-RESCH-EMP');
    assert.equal(detail.status, 'SCHEDULED');
    assert.equal(detail.applicationStatus, 'INTERVIEW');
    assert.equal(detail.adminStatus, 'INTERVIEW_RESCHEDULED');
    assert.equal(detail.adminStatusLabel, 'Interview Rescheduled');
    const labels = detail.statusEvents.map((e: Row) => e.label);
    assert.deepEqual(labels, ['Interview scheduled by employer', 'Employer rescheduled the interview']);
  });

  it('cancelled interview detail is Cancelled with no fabricated outcome events', async () => {
    const { service } = listHarness();
    const detail: Row = await service.interviewDetails('IV-CANCELLED');
    assert.equal(detail.adminStatus, 'CANCELLED');
    assert.deepEqual(detail.statusEvents.map((e: Row) => e.label), ['Interview scheduled by employer']);
  });
});
