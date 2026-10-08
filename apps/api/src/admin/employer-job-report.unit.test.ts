import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import ExcelJS from 'exceljs';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { REPORT_EXPORT_BATCH } from './admin-report-export';
import {
  daysRequirementOpen,
  jobClosedDate,
  NO_INTERVIEW_LABEL,
  SHORTLIST_REACHED_APPLICATION_STATUSES,
  summariseJobInterviews,
} from './employer-job-report';

type Row = Record<string, any>;

const NOW = new Date('2026-10-07T06:30:00.000Z'); // 2026-10-07 12:00 IST
const ist = (day: string, time = '10:00') => new Date(`${day}T${time}:00+05:30`);
const EMPLOYER_REPORT_HEADERS = [
  'Employer Name',
  'Job Posted Date',
  'Job Name',
  'Candidates Applied',
  'Candidates Shortlisted',
  'Interview Status',
  'Closed Date',
  'Days Requirement Open',
  'Job Status',
];
const SECRET_MARKERS = ['v2:', 'passwordHash', 'password_hash', 'Bearer ', 'eyJ', 'refreshToken', 'sk-', 'AIza'];

/* ---------- in-memory Prisma for jobs, applications, interviews ---------- */

function matches(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (key === 'AND') {
      if (!(cond as Row[]).every((w) => matches(row, w))) return false;
      continue;
    }
    if (key === 'OR') {
      if (!(cond as Row[]).some((w) => matches(row, w))) return false;
      continue;
    }
    const value = row[key];
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('none' in cond) {
        if ((value as Row[]).some((item) => matches(item, cond.none))) return false;
        continue;
      }
      if ('not' in cond) {
        if (cond.not === null ? value == null : value === cond.not) return false;
        continue;
      }
      if ('contains' in cond) {
        if (!String(value ?? '').toLowerCase().includes(String(cond.contains).toLowerCase())) return false;
        continue;
      }
      if ('in' in cond) {
        if (!cond.in.includes(value)) return false;
        continue;
      }
      if (!matches(value ?? {}, cond)) return false;
      continue;
    }
    if (value !== cond) return false;
  }
  return true;
}

type Seed = {
  employers: Row[];
  jobs: Row[];
  applications?: Row[];
  interviews?: Row[];
  employerReschedules?: string[];
};

function harness(seed: Seed) {
  const employers: Row[] = seed.employers.map((e) => ({ user: { email: `${e.id}@hr.test`, status: 'ACTIVE', passwordHash: 'v2:x' }, ...e }));
  const byId = new Map<string, Row>(employers.map((e) => [e.id, e]));
  const jobs: Row[] = seed.jobs.map((j) => ({
    status: 'PUBLISHED',
    publishedAt: null,
    closedAt: null,
    createdAt: ist('2026-09-01'),
    updatedAt: ist('2026-09-01'),
    ...j,
    employer: byId.get(j.employerId),
  }));
  for (const e of employers) e.jobs = jobs.filter((j) => j.employerId === e.id);
  const applications = seed.applications ?? [];
  const interviews = seed.interviews ?? [];
  const calls = { jobQueries: [] as Row[], groupBys: 0, interviewQueries: 0, rescheduleQueries: 0, audits: [] as Row[] };

  const prisma: Row = {
    job: {
      findMany: async (args: Row) => {
        calls.jobQueries.push(args);
        const sorted = jobs
          .filter((j) => matches(j, args.where))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1));
        const start = args.cursor ? sorted.findIndex((j) => j.id === args.cursor.id) + (args.skip ?? 0) : 0;
        return sorted.slice(start, start + args.take).map((j) => {
          const out: Row = {};
          for (const [k, v] of Object.entries(args.select)) {
            out[k] = v === true ? j[k] : { companyName: j.employer.companyName };
          }
          return out;
        });
      },
      count: async () => jobs.length,
    },
    application: {
      groupBy: async ({ by, where }: Row) => {
        calls.groupBys += 1;
        assert.deepEqual(by, ['jobId', 'status']);
        const groups = new Map<string, Row>();
        for (const a of applications.filter((x) => matches(x, where))) {
          const key = `${a.jobId}|${a.status}`;
          const g = groups.get(key) ?? { jobId: a.jobId, status: a.status, _count: { _all: 0 } };
          g._count._all += 1;
          groups.set(key, g);
        }
        return [...groups.values()];
      },
    },
    employerInterview: {
      findMany: async ({ where }: Row) => {
        calls.interviewQueries += 1;
        return interviews
          .filter((iv) => matches(iv, where))
          .map((iv) => ({
            durationMin: 30,
            scheduledEnd: null,
            candidateRescheduleRequestedAt: null,
            ...iv,
            application: { status: applications.find((a) => a.id === iv.applicationId)?.status },
          }));
      },
    },
    employer: {
      count: async ({ where }: Row) => employers.filter((e) => matches(e, where)).length,
    },
    auditLog: {
      findMany: async ({ where }: Row) => {
        calls.rescheduleQueries += 1;
        assert.equal(where.action, 'INTERVIEW_RESCHEDULED');
        return (seed.employerReschedules ?? [])
          .filter((id) => where.resourceId.in.includes(id))
          .map((resourceId) => ({ resourceId }));
      },
      create: async ({ data }: Row) => {
        calls.audits.push(data);
        return data;
      },
    },
  };
  const service = new AdminService(prisma as never, {} as never, {} as never);
  (service as any).reports = async () => ({
    employer: { jobsCreated: jobs.length, jobsPublished: 2, applicationsReceived: applications.length, interviewsConducted: interviews.length, hires: 1 },
  });
  return { service, calls };
}

const app = (id: string, jobId: string, status: string) => ({ id, jobId, candidateId: `cand-${id}`, status });
const iv = (id: string, jobId: string, applicationId: string, status: string, extra: Row = {}) => ({
  id,
  jobId,
  applicationId,
  status,
  scheduledAt: ist('2026-10-20'),
  createdAt: ist('2026-10-02'),
  ...extra,
});

/** One job covering every interview outcome. */
function mixedJobSeed(): Seed {
  const j = 'job-mixed';
  return {
    employers: [{ id: 'emp-a', companyName: 'Acme Corp' }],
    jobs: [{ id: j, employerId: 'emp-a', title: 'Java Developer', publishedAt: ist('2026-10-01') }],
    applications: [
      app('A', j, 'INTERVIEW'),
      app('B', j, 'INTERVIEW'),
      app('C', j, 'INTERVIEW'),
      app('D', j, 'SELECTED'),
      app('E', j, 'REJECTED'),
      app('F', j, 'INTERVIEW'),
      app('G', j, 'SHORTLISTED'),
      app('H', j, 'INTERVIEW'),
      app('I', j, 'WITHDRAWN'),
      app('J', j, 'APPLIED'),
    ],
    interviews: [
      iv('iA', j, 'A', 'SCHEDULED'),
      iv('iB', j, 'B', 'RESCHEDULE_REQUESTED'),
      iv('iC', j, 'C', 'COMPLETED', { scheduledAt: ist('2026-10-03') }),
      iv('iD', j, 'D', 'COMPLETED', { scheduledAt: ist('2026-10-03') }),
      iv('iE', j, 'E', 'COMPLETED', { scheduledAt: ist('2026-10-03') }),
      iv('iF-old', j, 'F', 'CANCELLED', { createdAt: ist('2026-10-02', '09:00') }),
      iv('iF-new', j, 'F', 'SCHEDULED', { createdAt: ist('2026-10-04') }),
      iv('iH', j, 'H', 'SCHEDULED'),
      iv('iI', j, 'I', 'SCHEDULED'),
    ],
    employerReschedules: ['iH'],
  };
}

async function rowsOf(seed: Seed) {
  const { service, calls } = harness(seed);
  const report = await service.employerReport(undefined, undefined, NOW);
  return { report, rows: report.rows, calls, service };
}

async function sheet(buffer: Buffer, name: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as never);
  const ws = wb.getWorksheet(name);
  assert.ok(ws, `sheet ${name}`);
  const rows: unknown[][] = [];
  ws.eachRow((r) => rows.push((r.values as unknown[]).slice(1)));
  return { wb, rows };
}

/* ---------- basic shape ---------- */

describe('Employer Report — one row per posted job', () => {
  it('1. one employer with one job: employer name, posted date, job name, counts, status, days open', async () => {
    const { rows } = await rowsOf({
      employers: [{ id: 'emp-a', companyName: 'Acme Corp' }],
      jobs: [{ id: 'j1', employerId: 'emp-a', title: 'Java Developer', publishedAt: ist('2026-10-01') }],
      applications: [app('a1', 'j1', 'APPLIED')],
    });
    assert.equal(rows.length, 1);
    assert.deepEqual(
      { ...rows[0], interviewStatusCounts: undefined },
      {
        jobId: 'j1',
        employerId: 'emp-a',
        employerName: 'Acme Corp',
        jobTitle: 'Java Developer',
        jobStatus: 'PUBLISHED',
        jobStatusLabel: 'Active',
        postedDate: '2026-10-01',
        candidatesApplied: 1,
        candidatesShortlisted: 0,
        interviewStatus: NO_INTERVIEW_LABEL,
        interviewStatusCounts: undefined,
        closedDate: null,
        daysOpen: 6,
      },
    );
  });

  it('2. a posted job with zero applications still appears (0 | 0 | No Interview)', async () => {
    const { rows } = await rowsOf({
      employers: [{ id: 'emp-a', companyName: 'Employer A' }],
      jobs: [{ id: 'j1', employerId: 'emp-a', title: 'Java Developer', publishedAt: ist('2026-10-01') }],
    });
    assert.equal(rows.length, 1);
    const r = rows[0]!;
    assert.deepEqual(
      [r.employerName, r.postedDate, r.jobTitle, r.candidatesApplied, r.candidatesShortlisted, r.interviewStatus, r.daysOpen],
      ['Employer A', '2026-10-01', 'Java Developer', 0, 0, 'No Interview', 6],
    );
  });

  it('never-posted drafts are left out; paused, closed and legacy jobs without publishedAt are kept', async () => {
    const { rows } = await rowsOf({
      employers: [{ id: 'emp-a', companyName: 'Acme' }],
      jobs: [
        { id: 'draft', employerId: 'emp-a', title: 'Draft only', status: 'DRAFT', publishedAt: null },
        { id: 'unpublished-later', employerId: 'emp-a', title: 'Taken back to draft', status: 'DRAFT', publishedAt: ist('2026-09-10') },
        { id: 'paused', employerId: 'emp-a', title: 'Paused', status: 'PAUSED', publishedAt: ist('2026-09-12') },
        { id: 'closed', employerId: 'emp-a', title: 'Closed', status: 'CLOSED', publishedAt: ist('2026-09-13') },
        { id: 'legacy', employerId: 'emp-a', title: 'Legacy live', status: 'PUBLISHED', publishedAt: null, createdAt: ist('2026-09-14') },
      ],
    });
    assert.deepEqual(rows.map((r) => r.jobId).sort(), ['closed', 'legacy', 'paused', 'unpublished-later']);
    assert.equal(rows.find((r) => r.jobId === 'legacy')!.postedDate, '2026-09-14', 'falls back to the created date');
    assert.deepEqual(
      Object.fromEntries(rows.map((r) => [r.jobId, r.jobStatusLabel])),
      { 'unpublished-later': 'Draft', paused: 'Paused', closed: 'Closed', legacy: 'Active' },
    );
  });

  it('3/4/5/6. multiple applications, shortlisted candidates, jobs with and without interviews', async () => {
    const { rows } = await rowsOf({
      employers: [{ id: 'emp-a', companyName: 'Acme' }],
      jobs: [
        { id: 'with-iv', employerId: 'emp-a', title: 'With interviews', publishedAt: ist('2026-10-01') },
        { id: 'no-iv', employerId: 'emp-a', title: 'No interviews', publishedAt: ist('2026-10-02') },
      ],
      applications: [
        app('a1', 'with-iv', 'INTERVIEW'),
        app('a2', 'with-iv', 'SHORTLISTED'),
        app('a3', 'with-iv', 'APPLIED'),
        app('b1', 'no-iv', 'SHORTLISTED'),
        app('b2', 'no-iv', 'UNDER_REVIEW'),
      ],
      interviews: [iv('i1', 'with-iv', 'a1', 'SCHEDULED')],
    });
    const by = Object.fromEntries(rows.map((r) => [r.jobId, r]));
    assert.equal(by['with-iv'].candidatesApplied, 3);
    assert.equal(by['with-iv'].candidatesShortlisted, 2);
    assert.equal(by['with-iv'].interviewStatus, '1 Interview Scheduled');
    assert.equal(by['no-iv'].candidatesApplied, 2);
    assert.equal(by['no-iv'].candidatesShortlisted, 1);
    assert.equal(by['no-iv'].interviewStatus, 'No Interview', 'applications without interviews keep the job row');
  });

  it('7/8. several jobs per employer and several employers: rows newest posting first, stable order', async () => {
    const { rows } = await rowsOf({
      employers: [
        { id: 'emp-a', companyName: 'Acme' },
        { id: 'emp-b', companyName: 'Beta Labs' },
      ],
      jobs: [
        { id: 'a1', employerId: 'emp-a', title: 'Analyst', publishedAt: ist('2026-10-01') },
        { id: 'a2', employerId: 'emp-a', title: 'Backend Engineer', publishedAt: ist('2026-10-03') },
        { id: 'b1', employerId: 'emp-b', title: 'Tester', publishedAt: ist('2026-10-03') },
        { id: 'b2', employerId: 'emp-b', title: 'Designer', publishedAt: ist('2026-09-20') },
      ],
      applications: [app('x', 'a1', 'APPLIED'), app('y', 'b1', 'APPLIED'), app('z', 'b1', 'SHORTLISTED')],
    });
    assert.deepEqual(
      rows.map((r) => [r.employerName, r.jobTitle, r.postedDate, r.candidatesApplied]),
      [
        ['Acme', 'Backend Engineer', '2026-10-03', 0],
        ['Beta Labs', 'Tester', '2026-10-03', 2],
        ['Acme', 'Analyst', '2026-10-01', 1],
        ['Beta Labs', 'Designer', '2026-09-20', 0],
      ],
    );
  });
});

/* ---------- counts ---------- */

describe('Employer Report — counts', () => {
  it('9/10. applications and shortlisted are counted per job, never across jobs', async () => {
    const { rows } = await rowsOf({
      employers: [{ id: 'emp-a', companyName: 'Acme' }],
      jobs: [
        { id: 'j1', employerId: 'emp-a', title: 'One', publishedAt: ist('2026-10-01') },
        { id: 'j2', employerId: 'emp-a', title: 'Two', publishedAt: ist('2026-10-02') },
      ],
      applications: [
        ...['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'ON_HOLD', 'INTERVIEW', 'SELECTED', 'HIRED', 'REJECTED', 'WITHDRAWN'].map((s, i) =>
          app(`j1-${i}`, 'j1', s),
        ),
        app('j2-0', 'j2', 'SHORTLISTED'),
      ],
    });
    const by = Object.fromEntries(rows.map((r) => [r.jobId, r]));
    assert.equal(by.j1.candidatesApplied, 9, 'every application on the job, including withdrawn');
    assert.equal(by.j1.candidatesShortlisted, 5, 'shortlisted, on hold, interview, selected, hired');
    assert.deepEqual([...SHORTLIST_REACHED_APPLICATION_STATUSES], ['SHORTLISTED', 'ON_HOLD', 'INTERVIEW', 'SELECTED', 'HIRED']);
    assert.equal(by.j2.candidatesApplied, 1);
    assert.equal(by.j2.candidatesShortlisted, 1);
  });

  it('11/12. several interviews for one candidate do not inflate applied, shortlisted or interview counts', async () => {
    const { rows } = await rowsOf({
      employers: [{ id: 'emp-a', companyName: 'Acme' }],
      jobs: [{ id: 'j1', employerId: 'emp-a', title: 'One', publishedAt: ist('2026-10-01') }],
      applications: [app('a1', 'j1', 'INTERVIEW')],
      interviews: [
        iv('i1', 'j1', 'a1', 'CANCELLED', { createdAt: ist('2026-10-02', '09:00') }),
        iv('i2', 'j1', 'a1', 'CANCELLED', { createdAt: ist('2026-10-02', '11:00') }),
        iv('i3', 'j1', 'a1', 'SCHEDULED', { createdAt: ist('2026-10-03') }),
      ],
    });
    assert.equal(rows.length, 1, 'still one row per job');
    assert.equal(rows[0]!.candidatesApplied, 1);
    assert.equal(rows[0]!.candidatesShortlisted, 1);
    assert.equal(rows[0]!.interviewStatus, '1 Interview Scheduled');
  });

  it('aggregates in a fixed number of queries per batch of jobs (no per-job query)', async () => {
    const total = REPORT_EXPORT_BATCH + 20;
    const seed: Seed = {
      employers: [{ id: 'emp-a', companyName: 'Acme' }],
      jobs: Array.from({ length: total }, (_, i) => ({
        id: `j${String(i).padStart(4, '0')}`,
        employerId: 'emp-a',
        title: `Job ${i}`,
        publishedAt: ist('2026-10-01'),
        createdAt: new Date(Date.UTC(2026, 0, 1) + i * 60_000),
      })),
      applications: [app('a1', 'j0000', 'APPLIED')],
    };
    const { report, calls } = await rowsOf(seed);
    assert.equal(report.total, total);
    assert.equal(report.rows.length, 500, 'the Reports table shows the first 500 rows');
    assert.equal(calls.jobQueries.length, 2);
    assert.equal(calls.groupBys, 2);
    assert.equal(calls.interviewQueries, 2);
    assert.equal(calls.rescheduleQueries, 0, 'no reschedule lookup when there are no interviews');
    assert.ok(calls.jobQueries.every((q) => q.select && !q.include && q.take === REPORT_EXPORT_BATCH));
    assert.equal(new Set(calls.jobQueries.map((q) => q.cursor?.id ?? 'first')).size, 2);
  });
});

/* ---------- days open ---------- */

describe('Closed Date and Days Requirement Open', () => {
  const OCT_8 = ist('2026-10-08', '12:00');
  const job = (extra: Row) => ({ status: 'PUBLISHED', publishedAt: ist('2026-10-01'), closedAt: null, createdAt: ist('2026-09-01'), ...extra });

  it('A. open job posted 30 Sep, today 8 Oct → 8 days, no closed date', () => {
    const open = job({ publishedAt: ist('2026-09-30') });
    assert.equal(daysRequirementOpen(open as never, OCT_8), 8);
    assert.equal(jobClosedDate(open as never), null);
  });

  it('B. closed the same day it was posted → closed date that day, 0 days', () => {
    const closed = job({ status: 'CLOSED', publishedAt: ist('2026-09-30', '09:00'), closedAt: ist('2026-09-30', '18:00') });
    assert.equal(jobClosedDate(closed as never), '2026-09-30');
    assert.equal(daysRequirementOpen(closed as never, OCT_8), 0);
  });

  it('C. posted 28 Sep, closed 2 Oct → closed date 2 Oct, 4 days', () => {
    const closed = job({ status: 'CLOSED', publishedAt: ist('2026-09-28'), closedAt: ist('2026-10-02') });
    assert.equal(jobClosedDate(closed as never), '2026-10-02');
    assert.equal(daysRequirementOpen(closed as never, OCT_8), 4);
  });

  it('D. a closed job edited later (updatedAt 8 Oct) still reports its close: 4 days, not 10', () => {
    const closed = job({ status: 'CLOSED', publishedAt: ist('2026-09-28'), closedAt: ist('2026-10-02'), updatedAt: ist('2026-10-08') });
    assert.equal(jobClosedDate(closed as never), '2026-10-02');
    assert.equal(daysRequirementOpen(closed as never, OCT_8), 4);
  });

  it('E. an open job edited yesterday still counts to today: posted 30 Sep → 8 days on 8 Oct', () => {
    const open = job({ publishedAt: ist('2026-09-30'), updatedAt: ist('2026-10-07') });
    assert.equal(daysRequirementOpen(open as never, OCT_8), 8);
  });

  it('F. a legacy CLOSED job with no recorded close time → no closed date and no days (not guessed)', () => {
    const legacy = job({ status: 'CLOSED', publishedAt: ist('2026-09-01'), closedAt: null, updatedAt: ist('2026-09-11') });
    assert.equal(jobClosedDate(legacy as never), null);
    assert.equal(daysRequirementOpen(legacy as never, NOW), null);
  });

  it('every job that is not closed (active, pending review, paused, posted draft) counts India days to today', () => {
    assert.equal(daysRequirementOpen(job({}) as never, NOW), 6);
    for (const status of ['PENDING_REVIEW', 'PAUSED', 'DRAFT']) {
      assert.equal(daysRequirementOpen(job({ status, updatedAt: ist('2026-10-02') }) as never, NOW), 6, status);
      assert.equal(jobClosedDate(job({ status, closedAt: ist('2026-10-02') }) as never), null, `${status} has no closed date`);
    }
    assert.equal(daysRequirementOpen(job({ publishedAt: ist('2026-10-07', '00:05') }) as never, NOW), 0, 'posted today');
    assert.equal(daysRequirementOpen(job({ publishedAt: new Date('2026-10-01T20:00:00Z') }) as never, NOW), 5, '01:30 IST on 2 Oct');
  });

  it('closed date is the India calendar date of the close (late-evening UTC is the next day in India)', () => {
    const closed = job({ status: 'CLOSED', publishedAt: ist('2026-09-28'), closedAt: new Date('2026-10-01T20:00:00Z') });
    assert.equal(jobClosedDate(closed as never), '2026-10-02');
    assert.equal(daysRequirementOpen(closed as never, NOW), 4);
  });

  it('future, inverted or invalid dates are safe: never negative, null when unusable', () => {
    assert.equal(daysRequirementOpen(job({ publishedAt: ist('2026-10-20') }) as never, NOW), 0, 'future posted date');
    assert.equal(daysRequirementOpen(job({ status: 'CLOSED', closedAt: ist('2026-09-01') }) as never, NOW), 0, 'closed before posted');
    assert.equal(daysRequirementOpen(job({ status: 'CLOSED', closedAt: ist('2026-12-01') }) as never, NOW), 6, 'close in the future capped at now');
    assert.equal(daysRequirementOpen(job({ publishedAt: new Date('not a date') }) as never, NOW), null);
    assert.equal(daysRequirementOpen(job({ status: 'CLOSED', closedAt: new Date('bad') }) as never, NOW), null, 'unusable close time');
    assert.equal(jobClosedDate(job({ status: 'CLOSED', closedAt: new Date('bad') }) as never), null);
  });

  it('report rows carry the closed date and days from closedAt, never from updatedAt', async () => {
    const { rows, calls } = await rowsOf({
      employers: [{ id: 'emp-a', companyName: 'Acme' }],
      jobs: [
        { id: 'open', employerId: 'emp-a', title: 'Open', publishedAt: ist('2026-10-01'), updatedAt: ist('2026-10-03') },
        {
          id: 'closed',
          employerId: 'emp-a',
          title: 'Closed',
          status: 'CLOSED',
          publishedAt: ist('2026-09-01'),
          closedAt: ist('2026-09-11'),
          updatedAt: ist('2026-10-06'),
        },
        { id: 'legacy', employerId: 'emp-a', title: 'Legacy closed', status: 'CLOSED', publishedAt: ist('2026-09-02'), updatedAt: ist('2026-09-05') },
      ],
    });
    const by = Object.fromEntries(rows.map((r) => [r.jobId, [r.closedDate, r.daysOpen, r.jobStatusLabel]]));
    assert.deepEqual(by, {
      open: [null, 6, 'Active'],
      closed: ['2026-09-11', 10, 'Closed'],
      legacy: [null, null, 'Closed'],
    });
    assert.ok(calls.jobQueries.every((q) => q.select.closedAt === true && !('updatedAt' in q.select)));
  });
});

/* ---------- interview aggregation ---------- */

describe('Interview Status aggregation (Phase 2 statuses, one per interviewed candidate)', () => {
  it('16/18/19/20/21. counts every stage in a fixed order using each candidate’s latest interview', async () => {
    const { rows, calls } = await rowsOf(mixedJobSeed());
    const r = rows[0]!;
    assert.equal(
      r.interviewStatus,
      '2 Interview Scheduled, 2 Interview Rescheduled, 1 Feedback Pending, 1 Selected, 1 Rejected, 1 Cancelled',
    );
    assert.deepEqual(r.interviewStatusCounts, {
      INTERVIEW_SCHEDULED: 2,
      INTERVIEW_RESCHEDULED: 2,
      FEEDBACK_PENDING: 1,
      SELECTED: 1,
      REJECTED: 1,
      CANCELLED: 1,
    });
    assert.equal(r.candidatesApplied, 10);
    assert.equal(r.candidatesShortlisted, 7);
    assert.equal(calls.rescheduleQueries, 1, 'employer reschedules come from one audit lookup per batch');
  });

  it('17. no interview → "No Interview"', () => {
    assert.deepEqual(summariseJobInterviews([], new Set(), NOW), { label: 'No Interview', counts: {}, interviewedCandidates: 0 });
  });

  it('18. scheduled; 19. candidate or employer reschedule; 20. completed or slot passed → Feedback Pending', () => {
    const base = { id: 'x', applicationId: 'a', createdAt: ist('2026-10-01'), scheduledAt: ist('2026-10-20'), durationMin: 30 };
    const one = (status: string, applicationStatus: string, extra: Row = {}, rescheduled = false) =>
      summariseJobInterviews([{ ...base, status, applicationStatus, ...extra }], new Set(rescheduled ? ['x'] : []), NOW).label;
    assert.equal(one('SCHEDULED', 'INTERVIEW'), '1 Interview Scheduled');
    assert.equal(one('CONFIRMED', 'INTERVIEW'), '1 Interview Scheduled');
    assert.equal(one('RESCHEDULE_NEEDED', 'INTERVIEW'), '1 Interview Rescheduled');
    assert.equal(one('SCHEDULED', 'INTERVIEW', {}, true), '1 Interview Rescheduled');
    assert.equal(one('COMPLETED', 'INTERVIEW'), '1 Feedback Pending');
    assert.equal(one('SCHEDULED', 'INTERVIEW', { scheduledAt: ist('2026-10-06') }), '1 Feedback Pending');
  });

  it('21. outcomes follow the application: selected, hired, rejected; withdrawn or cancelled → Cancelled', () => {
    const base = { id: 'x', applicationId: 'a', createdAt: ist('2026-10-01'), scheduledAt: ist('2026-10-03'), durationMin: 30 };
    const one = (status: string, applicationStatus: string) =>
      summariseJobInterviews([{ ...base, status, applicationStatus }], new Set(), NOW).label;
    assert.equal(one('COMPLETED', 'SELECTED'), '1 Selected');
    assert.equal(one('COMPLETED', 'HIRED'), '1 Selected');
    assert.equal(one('COMPLETED', 'REJECTED'), '1 Rejected');
    assert.equal(one('SCHEDULED', 'WITHDRAWN'), '1 Cancelled');
    assert.equal(one('CANCELLED', 'INTERVIEW'), '1 Cancelled');
  });
});

/* ---------- Excel ---------- */

describe('Employer Excel export — per-job rows', () => {
  async function exportOf(seed: Seed, query?: string, status?: string) {
    const { service, calls } = harness(seed);
    const report = await service.employerReport(query, status, NOW);
    const file = await service.employerReportExport('admin-1', query, status, NOW);
    return { report, file, calls };
  }

  it('22/23/24/25. one row per job, headers match the Reports table, same counts and days open', async () => {
    const seed = mixedJobSeed();
    seed.employers.push({ id: 'emp-b', companyName: 'Beta Labs' }, { id: 'emp-c', companyName: 'No Jobs Ltd' });
    seed.jobs.push(
      { id: 'b-1', employerId: 'emp-b', title: 'Tester', publishedAt: ist('2026-09-30') },
      {
        id: 'b-2',
        employerId: 'emp-b',
        title: 'Closed role',
        status: 'CLOSED',
        publishedAt: ist('2026-09-01'),
        closedAt: ist('2026-09-11'),
        updatedAt: ist('2026-10-05'),
      },
    );
    const { report, file } = await exportOf(seed);
    assert.equal(file.fileName, 'careerbridge-employer-report-2026-10-07.xlsx');
    assert.equal(file.rowCount, 3);
    const { wb, rows: rawRows } = await sheet(file.buffer, 'Employer Jobs');
    const rows = rawRows.map((r) => Array.from(r, (v) => v ?? null));
    assert.deepEqual(wb.worksheets.map((w) => w.name), ['Summary', 'Employer Jobs']);
    assert.deepEqual(rows[0], EMPLOYER_REPORT_HEADERS);
    assert.equal(rows.length - 1, report.total);
    assert.deepEqual(
      rows.slice(1),
      report.rows.map((r) => [
        r.employerName,
        r.postedDate,
        r.jobTitle,
        r.candidatesApplied,
        r.candidatesShortlisted,
        r.interviewStatus,
        r.closedDate,
        r.daysOpen,
        r.jobStatusLabel,
      ]),
    );
    assert.deepEqual(rows[1], [
      'Acme Corp',
      '2026-10-01',
      'Java Developer',
      10,
      7,
      '2 Interview Scheduled, 2 Interview Rescheduled, 1 Feedback Pending, 1 Selected, 1 Rejected, 1 Cancelled',
      null,
      6,
      'Active',
    ]);
    assert.deepEqual(rows[3], ['Beta Labs', '2026-09-01', 'Closed role', 0, 0, 'No Interview', '2026-09-11', 10, 'Closed']);
  });

  it('26. Summary sheet keeps the Phase 3 Reports metrics and counts exported job rows', async () => {
    const seed = mixedJobSeed();
    seed.employers.push({ id: 'emp-c', companyName: 'No Jobs Ltd' });
    const { file } = await exportOf(seed);
    const { rows } = await sheet(file.buffer, 'Summary');
    assert.deepEqual(rows[0], ['Metric', 'Value']);
    const summary = Object.fromEntries(rows.slice(1).map((r) => [r[0], r[1]]));
    assert.equal(summary['Report'], 'CareerBridge Employer Report');
    assert.equal(summary['Generated at (IST)'], '2026-10-07 12:00');
    assert.equal(summary['Filters'], 'None (all records)');
    assert.equal(summary['Jobs exported'], 1);
    assert.equal(summary['Employers with jobs'], 1);
    assert.equal(summary['Employers with no posted jobs'], 1);
    for (const k of ['Jobs created', 'Jobs published', 'Applications received', 'Interviews conducted', 'Hires']) assert.ok(k in summary, k);
  });

  it('existing employer filters (search, account status) apply to the job rows; unknown status → 400', async () => {
    const seed: Seed = {
      employers: [
        { id: 'emp-a', companyName: 'Acme Corp' },
        { id: 'emp-b', companyName: 'Acme Labs', user: { email: 'b@hr.test', status: 'SUSPENDED' } },
        { id: 'emp-c', companyName: 'Other' },
      ],
      jobs: [
        { id: 'a1', employerId: 'emp-a', title: 'A1', publishedAt: ist('2026-10-01') },
        { id: 'b1', employerId: 'emp-b', title: 'B1', publishedAt: ist('2026-10-01') },
        { id: 'c1', employerId: 'emp-c', title: 'C1', publishedAt: ist('2026-10-01') },
      ],
    };
    const { report, file } = await exportOf(seed, 'acme', 'active');
    assert.deepEqual(report.rows.map((r) => r.jobId), ['a1']);
    const { rows } = await sheet(file.buffer, 'Employer Jobs');
    assert.deepEqual(rows.slice(1).map((r) => r[2]), ['A1']);
    const summary = Object.fromEntries((await sheet(file.buffer, 'Summary')).rows.map((r) => [r[0], r[1]]));
    assert.equal(summary['Filters'], 'search=acme; status=ACTIVE');
    const { service } = harness(seed);
    await assert.rejects(service.employerReport(undefined, 'DELETED', NOW), BadRequestException);
    await assert.rejects(service.employerReportExport('admin-1', undefined, 'DELETED', NOW), BadRequestException);
  });

  it('exports every job across batches, not only the 500 rows shown on the Reports page', async () => {
    const total = REPORT_EXPORT_BATCH * 2 + 7;
    const { file, report } = await exportOf({
      employers: [{ id: 'emp-a', companyName: 'Acme' }],
      jobs: Array.from({ length: total }, (_, i) => ({
        id: `j${String(i).padStart(4, '0')}`,
        employerId: 'emp-a',
        title: `Job ${i}`,
        publishedAt: ist('2026-10-01'),
        createdAt: new Date(Date.UTC(2026, 0, 1) + i * 60_000),
      })),
    });
    assert.equal(report.rows.length, 500);
    assert.equal(file.rowCount, total);
    const { rows } = await sheet(file.buffer, 'Employer Jobs');
    assert.equal(rows.length - 1, total);
    assert.equal(new Set(rows.slice(1).map((r) => r[2])).size, total, 'no duplicate rows across batches');
  });

  it('27. Phase 3 protections: formula-like text neutralised, no secrets, audit entry with row count', async () => {
    const seed: Seed = {
      employers: [{ id: 'emp-a', companyName: '=HYPERLINK("http://x")' }],
      jobs: [{ id: 'j1', employerId: 'emp-a', title: '+cmd|calc', publishedAt: ist('2026-10-01') }],
    };
    const { file, calls } = await exportOf(seed);
    const { wb, rows } = await sheet(file.buffer, 'Employer Jobs');
    assert.equal(rows[1]![0], `'=HYPERLINK("http://x")`);
    assert.equal(rows[1]![2], `'+cmd|calc`);
    const text: string[] = [];
    wb.eachSheet((ws) => ws.eachRow((r) => text.push(JSON.stringify(r.values))));
    for (const marker of SECRET_MARKERS) assert.ok(!text.join('\n').includes(marker), marker);
    for (const q of calls.jobQueries) assert.doesNotMatch(JSON.stringify(q.select), /password|token|secret|email|phone/i);
    assert.equal(calls.audits.length, 1);
    assert.equal(calls.audits[0].action, 'EXPORT_EMPLOYER_REPORT');
    assert.deepEqual(JSON.parse(calls.audits[0].newValue), { rows: 1, filters: 'None (all records)' });
  });
});

/* ---------- authorization ---------- */

describe('Employer Report routes — authorization', () => {
  const guard = new RolesGuard(new Reflector());
  for (const name of ['employerReport', 'exportEmployerReport'] as const) {
    const handler = (AdminController.prototype as any)[name];
    const ctx = (role?: string) =>
      ({
        getHandler: () => handler,
        getClass: () => AdminController,
        switchToHttp: () => ({ getRequest: () => ({ user: role ? { id: 'u', role } : undefined }) }),
      }) as never;

    it(`${name}: 28/29. Platform Admin and Super Admin allowed — same roles as GET /admin/reports`, () => {
      assert.deepEqual(
        [...(Reflect.getMetadata(ROLES_KEY, handler) as string[])].sort(),
        [...(Reflect.getMetadata(ROLES_KEY, (AdminController.prototype as any).reports) as string[])].sort(),
      );
      assert.equal(guard.canActivate(ctx('PLATFORM_ADMIN')), true);
      assert.equal(guard.canActivate(ctx('SUPER_ADMIN')), true);
    });
    it(`${name}: 30/31. candidate, employer and operator get 403`, () => {
      for (const role of ['CANDIDATE', 'EMPLOYER_ADMIN', 'EMPLOYER_RECRUITER', 'PLATFORM_OPERATOR']) {
        assert.equal(guard.canActivate(ctx(role)), false, role);
      }
    });
    it(`${name}: 32. not public — unauthenticated requests are rejected by the global JWT guard`, () => {
      assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, handler), undefined);
      assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, AdminController), undefined);
      assert.equal(guard.canActivate(ctx(undefined)), false);
    });
  }

  it('the Reports endpoint passes the employer filters through to the service', async () => {
    const seen: unknown[] = [];
    const controller = new AdminController({ employerReport: async (...args: unknown[]) => (seen.push(args), { rows: [] }) } as never, {} as never);
    await controller.employerReport('acme', 'ACTIVE');
    assert.deepEqual(seen, [['acme', 'ACTIVE']]);
  });
});
