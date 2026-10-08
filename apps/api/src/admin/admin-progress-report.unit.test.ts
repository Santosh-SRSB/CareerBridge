import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { buildCandidateProgress, buildEmployerProgress, interviewHappened } from './admin-progress-report';

type Row = Record<string, any>;

const NOW = new Date('2026-10-08T06:00:00.000Z');
const PAST = new Date('2026-10-07T06:00:00.000Z');
const FUTURE = new Date('2026-10-09T06:00:00.000Z');

type Db = {
  candidates: Row[];
  applications: Row[];
  aiInterviews: Row[];
  humanMocks: Row[];
  employers: Row[];
  jobs: Row[];
  interviews: Row[];
};

const empty = (): Db => ({
  candidates: [],
  applications: [],
  aiInterviews: [],
  humanMocks: [],
  employers: [],
  jobs: [],
  interviews: [],
});

/* ---------- Prisma where evaluator with the relation filters the reports use ---------- */

function relations(db: Db): Record<string, Record<string, (row: Row) => Row[]>> {
  return {
    candidate: {
      applications: (c) => db.applications.filter((a) => a.candidateId === c.id),
      interviews: (c) => db.aiInterviews.filter((i) => i.candidateId === c.id),
      humanMockInterviews: (c) => db.humanMocks.filter((i) => i.candidateId === c.id),
    },
    employer: { jobs: (e) => db.jobs.filter((j) => j.employerId === e.id) },
    job: { applications: (j) => db.applications.filter((a) => a.jobId === j.id) },
  };
}

const CHILD_MODEL: Record<string, string> = { jobs: 'job', applications: 'application' };

function matchValue(value: unknown, cond: any): boolean {
  if (cond === null) return value === null || value === undefined;
  if (cond instanceof Date) return value instanceof Date && value.getTime() === cond.getTime();
  if (typeof cond === 'object') {
    if ('in' in cond && !cond.in.includes(value)) return false;
    if ('not' in cond && (cond.not === null ? value === null || value === undefined : value === cond.not)) return false;
    if ('lte' in cond && !((value as Date) <= cond.lte)) return false;
    return true;
  }
  return value === cond;
}

function matches(db: Db, model: string, row: Row, where?: Row): boolean {
  if (!where) return true;
  const rel = relations(db)[model] ?? {};
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'OR') return (cond as Row[]).some((w) => matches(db, model, row, w));
    if (key === 'AND') return (cond as Row[]).every((w) => matches(db, model, row, w));
    if (rel[key]) return rel[key]!(row).some((child) => matches(db, CHILD_MODEL[key] ?? key, child, cond.some));
    return matchValue(row[key], cond);
  });
}

function fakePrisma(db: Db) {
  const queries: string[] = [];
  const counter = (model: string, list: () => Row[]) => ({
    count: async (args?: Row) => {
      queries.push(`${model}.count`);
      return list().filter((r) => matches(db, model, r, args?.where)).length;
    },
  });
  return {
    queries,
    candidate: counter('candidate', () => db.candidates),
    employer: counter('employer', () => db.employers),
    job: counter('job', () => db.jobs),
    application: counter('application', () => db.applications),
    employerInterview: {
      findMany: async (args: Row) => {
        queries.push('employerInterview.findMany');
        const rows = db.interviews
          .filter((r) => matches(db, 'employerInterview', r, args.where))
          .sort((a, b) => (a.id < b.id ? -1 : 1));
        const start = args.cursor ? rows.findIndex((r) => r.id === args.cursor.id) + (args.skip ?? 0) : 0;
        return rows.slice(start, start + args.take).map((r) => ({
          ...r,
          application: { status: db.applications.find((a) => a.id === r.applicationId)?.status ?? 'APPLIED' },
        }));
      },
    },
  };
}

let seq = 0;
function addCandidate(db: Db, over: Row = {}) {
  const c = { id: `c${++seq}`, onboardingCompleted: true, ...over };
  db.candidates.push(c);
  return c;
}
function addEmployer(db: Db, over: Row = {}) {
  const e = { id: `e${++seq}`, verificationStatus: 'KYC_COMPLETE', verified: false, ...over };
  db.employers.push(e);
  return e;
}
function addJob(db: Db, employer: Row, over: Row = {}) {
  const j = { id: `j${++seq}`, employerId: employer.id, status: 'PUBLISHED', publishedAt: PAST, ...over };
  db.jobs.push(j);
  return j;
}
function apply(db: Db, candidate: Row, job: Row, status = 'APPLIED') {
  const a = { id: `a${++seq}`, candidateId: candidate.id, jobId: job.id, status };
  db.applications.push(a);
  return a;
}
function interview(db: Db, app: Row, over: Row = {}) {
  const job = db.jobs.find((j) => j.id === app.jobId)!;
  const iv = {
    id: `iv${String(++seq).padStart(6, '0')}`,
    candidateId: app.candidateId,
    employerId: job.employerId,
    applicationId: app.id,
    status: 'SCHEDULED',
    scheduledAt: PAST,
    scheduledEnd: null,
    durationMin: 30,
    ...over,
  };
  db.interviews.push(iv);
  return iv;
}

const counts = (report: { stages: Array<{ key: string; count: number }> }) =>
  Object.fromEntries(report.stages.map((s) => [s.key, s.count]));

/* ---------- interview happened rule ---------- */

describe('interviewHappened', () => {
  it('completed always counts; offered/agreed slots count once they have ended', () => {
    assert.equal(interviewHappened({ status: 'COMPLETED', scheduledAt: FUTURE }, NOW), true);
    for (const status of ['PROPOSED', 'SCHEDULED', 'CONFIRMED']) {
      assert.equal(interviewHappened({ status, scheduledAt: PAST }, NOW), true, status);
      assert.equal(interviewHappened({ status, scheduledAt: FUTURE }, NOW), false, status);
    }
  });
  it('cancelled, candidate-reschedule and withdrawn applications never count', () => {
    assert.equal(interviewHappened({ status: 'CANCELLED', scheduledAt: PAST }, NOW), false);
    assert.equal(interviewHappened({ status: 'RESCHEDULE_NEEDED', scheduledAt: PAST }, NOW), false);
    assert.equal(interviewHappened({ status: 'RESCHEDULE_REQUESTED', scheduledAt: PAST }, NOW), false);
    assert.equal(
      interviewHappened({ status: 'SCHEDULED', scheduledAt: PAST, applicationStatus: 'WITHDRAWN' }, NOW),
      false,
    );
  });
  it('uses the slot end (scheduledEnd, else start + duration)', () => {
    const start = new Date(NOW.getTime() - 20 * 60_000);
    assert.equal(interviewHappened({ status: 'SCHEDULED', scheduledAt: start, durationMin: 30 }, NOW), false);
    assert.equal(interviewHappened({ status: 'SCHEDULED', scheduledAt: start, durationMin: 15 }, NOW), true);
    assert.equal(interviewHappened({ status: 'SCHEDULED', scheduledAt: start, scheduledEnd: FUTURE }, NOW), false);
  });
});

/* ---------- candidate progress ---------- */

describe('Candidate progress', () => {
  it('zero data: every stage is 0 and percentages are null', async () => {
    const report = await buildCandidateProgress(fakePrisma(empty()) as never, NOW);
    assert.equal(report.registered, 0);
    assert.equal(report.stages.length, 7);
    assert.ok(report.stages.every((s) => s.count === 0 && s.percentOfRegistered === null));
  });

  it('stages are in stakeholder order with the requested labels', async () => {
    const report = await buildCandidateProgress(fakePrisma(empty()) as never, NOW);
    assert.deepEqual(
      report.stages.map((s) => s.label),
      [
        'Candidate Onboarded',
        'Took Mock Interview',
        'Applied for Job',
        'Shortlisted',
        'Interviewed',
        'Shortlisted (Final)',
        'Joined',
      ],
    );
    assert.ok(report.stages.every((s) => s.definition.length > 10));
  });

  it('onboarded uses onboardingCompleted; registered counts everyone', async () => {
    const db = empty();
    addCandidate(db);
    addCandidate(db);
    addCandidate(db, { onboardingCompleted: false });
    const report = await buildCandidateProgress(fakePrisma(db) as never, NOW);
    assert.equal(report.registered, 3);
    assert.equal(counts(report).ONBOARDED, 2);
    assert.equal(report.stages[0]!.percentOfRegistered, 66.7);
  });

  it('mock interview: completed AI or human mock, counted once per candidate', async () => {
    const db = empty();
    const both = addCandidate(db);
    const aiOnly = addCandidate(db);
    const humanOnly = addCandidate(db);
    const unfinished = addCandidate(db);
    db.aiInterviews.push({ candidateId: both.id, status: 'COMPLETED' }, { candidateId: both.id, status: 'COMPLETED' });
    db.humanMocks.push({ candidateId: both.id, status: 'COMPLETED' });
    db.aiInterviews.push({ candidateId: aiOnly.id, status: 'COMPLETED' });
    db.humanMocks.push({ candidateId: humanOnly.id, status: 'COMPLETED' });
    db.aiInterviews.push({ candidateId: unfinished.id, status: 'IN_PROGRESS' });
    db.humanMocks.push({ candidateId: unfinished.id, status: 'SCHEDULED' });
    assert.equal(counts(await buildCandidateProgress(fakePrisma(db) as never, NOW)).MOCK_INTERVIEW, 3);
  });

  it('multiple applications and interviews never double count a candidate', async () => {
    const db = empty();
    const emp = addEmployer(db);
    const jobs = [addJob(db, emp), addJob(db, emp), addJob(db, emp)];
    const busy = addCandidate(db);
    const apps = jobs.map((j) => apply(db, busy, j, 'INTERVIEW'));
    for (const app of apps) {
      interview(db, app, { status: 'COMPLETED' });
      interview(db, app, { status: 'SCHEDULED' });
    }
    db.applications.find((a) => a.id === apps[0]!.id)!.status = 'HIRED';
    db.applications.find((a) => a.id === apps[1]!.id)!.status = 'SELECTED';
    const c = counts(await buildCandidateProgress(fakePrisma(db) as never, NOW));
    assert.deepEqual(
      [c.APPLIED, c.SHORTLISTED, c.INTERVIEWED, c.FINAL_SHORTLISTED, c.JOINED],
      [1, 1, 1, 1, 1],
    );
  });

  it('application status mapping across multiple candidates', async () => {
    const db = empty();
    const emp = addEmployer(db);
    const job = addJob(db, emp);
    const statuses = ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'ON_HOLD', 'INTERVIEW', 'SELECTED', 'HIRED', 'REJECTED', 'WITHDRAWN'];
    for (const status of statuses) apply(db, addCandidate(db), job, status);
    const c = counts(await buildCandidateProgress(fakePrisma(db) as never, NOW));
    assert.equal(c.APPLIED, 9, 'every applicant, including rejected/withdrawn');
    assert.equal(c.SHORTLISTED, 5, 'Shortlisted, On hold, Interview, Selected, Hired');
    assert.equal(c.FINAL_SHORTLISTED, 2, 'Selected and Hired — not ordinary Shortlisted');
    assert.equal(c.JOINED, 1, 'Hired only');
  });

  it('interviewed counts only interviews that happened', async () => {
    const db = empty();
    const emp = addEmployer(db);
    const job = addJob(db, emp);
    const make = (status: string, over: Row = {}, appStatus = 'INTERVIEW') =>
      interview(db, apply(db, addCandidate(db), job, appStatus), { status, ...over });
    make('COMPLETED');
    make('CONFIRMED');
    make('SCHEDULED', { scheduledAt: FUTURE });
    make('CANCELLED');
    make('RESCHEDULE_NEEDED');
    make('SCHEDULED', {}, 'WITHDRAWN');
    make('SCHEDULED', {}, 'REJECTED');
    assert.equal(counts(await buildCandidateProgress(fakePrisma(db) as never, NOW)).INTERVIEWED, 3);
  });

  it('aggregates in the database: a fixed number of queries regardless of data size', async () => {
    const db = empty();
    const emp = addEmployer(db);
    const job = addJob(db, emp);
    for (let i = 0; i < 40; i++) interview(db, apply(db, addCandidate(db), job, 'INTERVIEW'), { status: 'COMPLETED' });
    const prisma = fakePrisma(db);
    await buildCandidateProgress(prisma as never, NOW);
    assert.equal(prisma.queries.filter((q) => q.endsWith('.count')).length, 7);
    assert.equal(prisma.queries.filter((q) => q === 'employerInterview.findMany').length, 1);
  });

  it('reads interviews in batches so large volumes are all counted', async () => {
    const db = empty();
    const emp = addEmployer(db);
    const job = addJob(db, emp);
    for (let i = 0; i < 2300; i++) interview(db, apply(db, addCandidate(db), job, 'INTERVIEW'), { status: 'COMPLETED' });
    const prisma = fakePrisma(db);
    const report = await buildCandidateProgress(prisma as never, NOW);
    assert.equal(counts(report).INTERVIEWED, 2300);
    assert.equal(prisma.queries.filter((q) => q === 'employerInterview.findMany').length, 3);
  });
});

/* ---------- employer progress ---------- */

describe('Employer progress', () => {
  it('zero data', async () => {
    const report = await buildEmployerProgress(fakePrisma(empty()) as never, NOW);
    assert.equal(report.registered, 0);
    assert.deepEqual(
      report.stages.map((s) => [s.label, s.count]),
      [
        ['Employers Onboarded', 0],
        ['Requirements Posted', 0],
        ['Interview Happened', 0],
        ['Selection Done', 0],
        ['Candidates Onboarded', 0],
      ],
    );
    assert.equal(report.stages[1]!.detail, '0 jobs posted');
  });

  it('onboarded follows the KYC gate (legacy verified=true counts; unverified does not)', async () => {
    const db = empty();
    addEmployer(db, { verificationStatus: 'UNVERIFIED', verified: false });
    addEmployer(db, { verificationStatus: 'UNVERIFIED', verified: true });
    addEmployer(db, { verificationStatus: 'PENDING' });
    addEmployer(db, { verificationStatus: 'VERIFIED', verified: true });
    const report = await buildEmployerProgress(fakePrisma(db) as never, NOW);
    assert.equal(report.registered, 4);
    assert.equal(counts(report).ONBOARDED, 3);
  });

  it('one employer with many jobs, interviews, selections and hires counts once per stage', async () => {
    const db = empty();
    const big = addEmployer(db);
    const small = addEmployer(db);
    addEmployer(db);
    const jobs = Array.from({ length: 10 }, () => addJob(db, big));
    addJob(db, big, { status: 'DRAFT', publishedAt: null });
    addJob(db, small);
    jobs.forEach((job, i) => {
      const app = apply(db, addCandidate(db), job, i < 3 ? 'HIRED' : i < 6 ? 'SELECTED' : 'INTERVIEW');
      interview(db, app, { status: 'COMPLETED' });
      interview(db, app, { status: 'CONFIRMED' });
    });
    const report = await buildEmployerProgress(fakePrisma(db) as never, NOW);
    const c = counts(report);
    assert.deepEqual(
      [c.ONBOARDED, c.REQUIREMENTS_POSTED, c.INTERVIEW_HAPPENED, c.SELECTION_DONE, c.CANDIDATES_ONBOARDED],
      [3, 2, 1, 1, 1],
    );
    assert.deepEqual(
      report.stages.slice(1).map((s) => s.detail),
      ['11 jobs posted', '20 interviews held', '6 selections', '3 hires'],
    );
  });

  it('a job that was never posted and a future interview do not count', async () => {
    const db = empty();
    const emp = addEmployer(db);
    const draft = addJob(db, emp, { status: 'DRAFT', publishedAt: null });
    interview(db, apply(db, addCandidate(db), draft, 'INTERVIEW'), { scheduledAt: FUTURE });
    const c = counts(await buildEmployerProgress(fakePrisma(db) as never, NOW));
    assert.equal(c.REQUIREMENTS_POSTED, 0);
    assert.equal(c.INTERVIEW_HAPPENED, 0);
  });

  it('selection vs hire mapping is per employer', async () => {
    const db = empty();
    const selectsOnly = addEmployer(db);
    const hires = addEmployer(db);
    apply(db, addCandidate(db), addJob(db, selectsOnly), 'SELECTED');
    apply(db, addCandidate(db), addJob(db, hires), 'HIRED');
    apply(db, addCandidate(db), addJob(db, hires), 'HIRED');
    const c = counts(await buildEmployerProgress(fakePrisma(db) as never, NOW));
    assert.equal(c.SELECTION_DONE, 2);
    assert.equal(c.CANDIDATES_ONBOARDED, 1);
  });
});

/* ---------- routes ---------- */

describe('Progress report routes', () => {
  const guard = new RolesGuard(new Reflector());
  for (const name of ['candidateProgress', 'employerProgress'] as const) {
    const handler = (AdminController.prototype as any)[name];
    const ctx = (role?: string) =>
      ({
        getHandler: () => handler,
        getClass: () => AdminController,
        switchToHttp: () => ({ getRequest: () => ({ user: role ? { id: 'u', role } : undefined }) }),
      }) as never;
    it(`${name}: same roles as the Reports page (Super Admin and Admin)`, () => {
      assert.deepEqual(
        [...(Reflect.getMetadata(ROLES_KEY, handler) as string[])].sort(),
        [...(Reflect.getMetadata(ROLES_KEY, (AdminController.prototype as any).reports) as string[])].sort(),
      );
      assert.equal(guard.canActivate(ctx('SUPER_ADMIN')), true);
      assert.equal(guard.canActivate(ctx('PLATFORM_ADMIN')), true);
    });
    it(`${name}: operator, candidate and employer get 403; unauthenticated is rejected`, () => {
      for (const role of ['PLATFORM_OPERATOR', 'CANDIDATE', 'EMPLOYER_ADMIN', 'EMPLOYER_RECRUITER']) {
        assert.equal(guard.canActivate(ctx(role)), false, role);
      }
      assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, handler), undefined);
      assert.equal(guard.canActivate(ctx(undefined)), false);
    });
  }

  it('the service delegates to the shared builders', async () => {
    const service = new AdminService(fakePrisma(empty()) as never, {} as never, {} as never);
    const [cand, emp] = await Promise.all([service.candidateProgress(NOW), service.employerProgress(NOW)]);
    assert.equal(cand.stages.length, 7);
    assert.equal(emp.stages.length, 5);
    assert.equal(cand.generatedAt, NOW.toISOString());
  });
});
