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
import {
  buildWorkbook,
  contentDisposition,
  REPORT_EXPORT_BATCH,
  reportFileName,
  XLSX_MIME,
} from './admin-report-export';
import {
  candidateCurrentPosition,
  candidateYearsOfExperience,
  COMPLETED_MOCK_INTERVIEW_STATUS,
  mockInterviewTaken,
} from './candidate-report-fields';

type Row = Record<string, any>;

const NOW = new Date('2026-10-07T20:00:00.000Z'); // 2026-10-08 01:30 IST
const SECRET_MARKERS = ['v2:', 'passwordHash', 'password_hash', 'loginPassword', 'Bearer ', 'eyJ', 'refreshToken', 'sk-', 'AIza'];

/* ---------- tiny Prisma where evaluator for the filters the exports use ---------- */

function get(row: Row, key: string) {
  return row[key];
}
function matchesWhere(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (key === 'AND') {
      if (!(cond as Row[]).every((w) => matchesWhere(row, w))) return false;
      continue;
    }
    if (key === 'OR') {
      if (!(cond as Row[]).some((w) => matchesWhere(row, w))) return false;
      continue;
    }
    if (key === 'skills') {
      const needle = String(cond.some.name.contains).toLowerCase();
      if (!(row.skills as Row[]).some((s) => s.name.toLowerCase().includes(needle))) return false;
      continue;
    }
    const value = get(row, key);
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('contains' in cond) {
        if (!String(value ?? '').toLowerCase().includes(String(cond.contains).toLowerCase())) return false;
        continue;
      }
      if ('in' in cond) {
        if (!cond.in.includes(value)) return false;
        continue;
      }
      if ('gte' in cond || 'lte' in cond) {
        if (cond.gte && value < cond.gte) return false;
        if (cond.lte && value > cond.lte) return false;
        continue;
      }
      if (!matchesWhere(value ?? {}, cond)) return false;
      continue;
    }
    if (value !== cond) return false;
  }
  return true;
}

function paginate(rows: Row[], args: Row) {
  const sorted = rows
    .filter((r) => matchesWhere(r, args.where))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1));
  let start = 0;
  if (args.cursor) start = sorted.findIndex((r) => r.id === args.cursor.id) + (args.skip ?? 0);
  return sorted.slice(start, start + args.take);
}

function candidates(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${String(i).padStart(5, '0')}`,
    firstName: i === 0 ? '=HYPERLINK("http://x")' : `Cand${i}`,
    lastName: i % 2 ? 'Rao' : null,
    city: i % 3 === 0 ? 'Pune' : 'Delhi',
    state: 'MH',
    profileCompletion: i % 101,
    createdAt: new Date(Date.UTC(2026, 0, 1) + i * 3_600_000),
    passwordHash: 'v2:should-never-leak',
    user: {
      email: `cand${i}@example.test`,
      phone: `+9198${String(i).padStart(8, '0')}`,
      status: i % 4 === 0 ? 'SUSPENDED' : 'ACTIVE',
      passwordHash: 'v2:should-never-leak',
    },
    skills: [{ name: i % 2 ? 'Java' : 'Excel' }, { name: 'Communication' }],
    hasExperience: null,
    experienceLevel: null,
    totalExperienceYears: 0,
    totalExperienceMonths: 0,
    experiences: [],
    interviews: [],
    humanMockInterviews: [],
    _count: { applications: i % 5, resumes: 1 },
  }));
}

const role = (jobTitle: string, extra: Row = {}): Row => ({
  jobTitle,
  company: 'Acme',
  isInternship: false,
  stillInCompany: false,
  startDate: null,
  endDate: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  description: 'never exported',
  ...extra,
});

function employers(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `e${String(i).padStart(5, '0')}`,
    companyName: `Company ${i}`,
    verified: i % 2 === 0,
    verificationStatus: i % 2 === 0 ? 'VERIFIED' : 'PENDING',
    createdAt: new Date(Date.UTC(2026, 0, 1) + i * 3_600_000),
    user: { email: `hr${i}@company${i}.test`, phone: `+9177${String(i).padStart(8, '0')}`, status: i % 3 === 0 ? 'INACTIVE' : 'ACTIVE', passwordHash: 'v2:x' },
    _count: { jobs: 2, interviews: i % 4 },
  }));
}

function harness(opts: { candidates?: number; employers?: number } = {}) {
  const cands = candidates(opts.candidates ?? 7);
  const emps = employers(opts.employers ?? 5);
  const calls = { candidateQueries: [] as Row[], employerQueries: [] as Row[], jobQueries: 0, audits: [] as Row[] };
  const select = (row: Row, sel: Row | undefined) => {
    if (!sel) return row;
    const out: Row = {};
    for (const [k, v] of Object.entries(sel)) {
      if (v === true) out[k] = row[k];
      else if (k === 'skills') out[k] = row.skills.slice(0, v.take ?? undefined).map((s: Row) => ({ name: s.name }));
      else if (k === '_count') {
        out[k] = Object.fromEntries(
          Object.entries(v.select as Row).map(([rel, c]) => [
            rel,
            c === true ? row._count[rel] : (row[rel] as Row[]).filter((x) => matchesWhere(x, c.where)).length,
          ]),
        );
      } else if (Array.isArray(row[k])) out[k] = row[k].map((x: Row) => select(x, v.select));
      else out[k] = select(row[k], v.select);
    }
    return out;
  };
  const prisma: Row = {
    candidate: {
      findMany: async (args: Row) => {
        calls.candidateQueries.push(args);
        return paginate(cands, args).map((r) => select(r, args.select));
      },
      count: async () => cands.length,
    },
    employer: {
      findMany: async (args: Row) => {
        calls.employerQueries.push(args);
        return paginate(emps, args).map((r) => select(r, args.select));
      },
      count: async () => emps.length,
    },
    // Per-job Employer Report coverage lives in employer-job-report.unit.test.ts.
    job: {
      findMany: async () => {
        calls.jobQueries += 1;
        return [];
      },
      count: async () => 10,
    },
    auditLog: {
      create: async ({ data }: Row) => {
        calls.audits.push(data);
        return data;
      },
    },
  };
  const service = new AdminService(prisma as never, {} as never, {} as never);
  // The summary sheet reuses the Reports blocks; stub them so the fake stays small.
  (service as any).reports = async () => ({
    candidate: { profilesCompleted: 3, resumesCreated: 9, avgAtsScore: 71.5 },
    employer: { jobsCreated: 10, jobsPublished: 6, applicationsReceived: 40, interviewsConducted: 12, hires: 2 },
  });
  return { service, calls, cands, emps };
}

async function readWorkbook(buffer: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as never);
  return wb;
}
function sheetRows(wb: ExcelJS.Workbook, name: string): unknown[][] {
  const ws = wb.getWorksheet(name);
  assert.ok(ws, `sheet ${name}`);
  const rows: unknown[][] = [];
  ws.eachRow((row) => rows.push((row.values as unknown[]).slice(1)));
  return rows;
}
async function workbookText(buffer: Buffer) {
  const wb = await readWorkbook(buffer);
  const parts: string[] = [];
  wb.eachSheet((ws) => ws.eachRow((row) => parts.push(JSON.stringify(row.values))));
  return parts.join('\n');
}
function assertNoSecrets(text: string) {
  for (const marker of SECRET_MARKERS) assert.ok(!text.includes(marker), `workbook contains ${marker}`);
}

const CANDIDATE_HEADERS = [
  'Candidate Name',
  'Email',
  'Phone',
  'Location',
  'Profile Completion (%)',
  'Primary Skills',
  'Applications',
  'Resumes',
  'Account Status',
  'Registered On',
  'Current Position',
  'Mock Interview Taken',
  'Years of Experience',
];

/* ---------- helpers ---------- */

describe('report export helpers', () => {
  it('file names follow careerbridge-<kind>-report-YYYY-MM-DD.xlsx in India time', () => {
    assert.equal(reportFileName('employer', NOW), 'careerbridge-employer-report-2026-10-08.xlsx');
    assert.equal(reportFileName('candidate', NOW), 'careerbridge-candidate-report-2026-10-08.xlsx');
    assert.equal(contentDisposition('careerbridge-employer-report-2026-10-08.xlsx'), 'attachment; filename="careerbridge-employer-report-2026-10-08.xlsx"');
  });
  it('buildWorkbook writes a valid xlsx and neutralises formula-like cells', async () => {
    const buffer = await buildWorkbook([
      {
        name: 'S',
        columns: [{ header: 'A', width: 10, value: (r: Row) => r.a }],
        rows: [{ a: '=1+1' }, { a: '+cmd|calc' }, { a: '@SUM(A1)' }, { a: '+91 98000 00006' }, { a: 'plain' }, { a: 5 }],
      },
    ]);
    assert.equal(buffer.subarray(0, 2).toString('latin1'), 'PK', 'xlsx is a zip container');
    const rows = sheetRows(await readWorkbook(buffer), 'S');
    assert.deepEqual(rows, [['A'], ["'=1+1"], ["'+cmd|calc"], ["'@SUM(A1)"], ['+91 98000 00006'], ['plain'], [5]]);
  });
});

/* ---------- authorization ---------- */

describe('report export routes — authorization', () => {
  const handlers = ['exportEmployerReport', 'exportCandidateReport'] as const;
  const guard = new RolesGuard(new Reflector());
  for (const name of handlers) {
    const handler = (AdminController.prototype as any)[name];
    const ctx = (role?: string) =>
      ({
        getHandler: () => handler,
        getClass: () => AdminController,
        switchToHttp: () => ({ getRequest: () => ({ user: role ? { id: 'u', role } : undefined }) }),
      }) as never;
    it(`${name}: same roles as the Reports page (Super Admin, Platform Admin)`, () => {
      assert.deepEqual([...(Reflect.getMetadata(ROLES_KEY, handler) as string[])].sort(), ['PLATFORM_ADMIN', 'SUPER_ADMIN']);
      assert.deepEqual(
        [...(Reflect.getMetadata(ROLES_KEY, (AdminController.prototype as any).reports) as string[])].sort(),
        ['PLATFORM_ADMIN', 'SUPER_ADMIN'],
      );
      for (const role of ['SUPER_ADMIN', 'PLATFORM_ADMIN']) assert.equal(guard.canActivate(ctx(role)), true, role);
    });
    it(`${name}: candidate, employer and operator are forbidden (403)`, () => {
      for (const role of ['CANDIDATE', 'EMPLOYER_ADMIN', 'EMPLOYER_RECRUITER', 'PLATFORM_OPERATOR']) {
        assert.equal(guard.canActivate(ctx(role)), false, role);
      }
    });
    it(`${name}: not public — the global JWT guard rejects unauthenticated calls`, () => {
      assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, handler), undefined);
      assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, AdminController), undefined);
      assert.equal(guard.canActivate(ctx(undefined)), false);
    });
  }
});

/* ---------- controller response ---------- */

function fakeResponse() {
  const res: Row = { headers: {} as Record<string, string>, statusCode: 0, body: null as Buffer | null };
  res.setHeader = (k: string, v: string) => {
    res.headers[k.toLowerCase()] = v;
  };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.end = (buf: Buffer) => {
    res.body = buf;
    return res;
  };
  return res;
}

describe('report export endpoints — response', () => {
  for (const [method, kind] of [
    ['exportEmployerReport', 'employer'],
    ['exportCandidateReport', 'candidate'],
  ] as const) {
    it(`${method}: xlsx content type, attachment filename, no-store, valid workbook`, async () => {
      const { service } = harness();
      const controller = new AdminController(service, {} as never);
      const res = fakeResponse();
      await (controller as any)[method]({ id: 'admin-1' }, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.headers['content-type'], XLSX_MIME);
      assert.match(res.headers['content-disposition'], new RegExp(`^attachment; filename="careerbridge-${kind}-report-\\d{4}-\\d{2}-\\d{2}\\.xlsx"$`));
      assert.equal(res.headers['cache-control'], 'no-store');
      assert.match(res.headers['access-control-expose-headers'], /Content-Disposition/);
      assert.equal(Number(res.headers['content-length']), res.body.length);
      const wb = await readWorkbook(res.body);
      assert.deepEqual(wb.worksheets.map((w) => w.name), ['Summary', kind === 'employer' ? 'Employer Jobs' : 'Candidates']);
    });
  }
});

/* ---------- candidate export ---------- */

describe('AdminService.candidateReportExport', () => {
  it('columns mirror the Admin candidate report; every candidate is present with real values', async () => {
    const { service, cands } = harness({ candidates: 7 });
    const file = await service.candidateReportExport('admin-1', undefined, {}, NOW);
    assert.equal(file.fileName, 'careerbridge-candidate-report-2026-10-08.xlsx');
    const rows = sheetRows(await readWorkbook(file.buffer), 'Candidates');
    assert.deepEqual(rows[0], CANDIDATE_HEADERS);
    assert.equal(rows.length, 8);
    const newest = cands[6]!;
    const first = rows[1]!;
    assert.equal(first[0], 'Cand6');
    assert.equal(first[1], newest.user.email);
    assert.equal(first[2], newest.user.phone);
    assert.equal(first[3], 'Pune, MH');
    assert.equal(first[4], newest.profileCompletion);
    assert.equal(first[5], 'Excel, Communication');
    assert.equal(first[6], newest._count.applications);
    assert.equal(first[7], 1);
    assert.equal(first[8], newest.user.status);
    assert.ok(first[9] instanceof Date);
    assert.deepEqual(first.slice(10), ['Fresher', 'No', 'Fresher']);
    const injected = rows.at(-1)!;
    assert.equal(injected[0], `'=HYPERLINK("http://x")`, 'formula-like names are stored as text');
  });

  it('summary sheet mirrors the Reports "candidate" block', async () => {
    const { service } = harness();
    const file = await service.candidateReportExport('admin-1', undefined, {}, NOW);
    const summary = Object.fromEntries(sheetRows(await readWorkbook(file.buffer), 'Summary').slice(1).map((r) => [r[0], r[1]]));
    assert.equal(summary['Profiles completed'], 3);
    assert.equal(summary['Resumes created'], 9);
    assert.equal(summary['Average ATS score'], 71.5);
    assert.equal(summary['Candidates exported'], 7);
    assert.equal(summary['Filters'], 'None (all records)');
  });

  it('honours the existing Admin candidate filters (search, location, skill, status, dates)', async () => {
    const { service, cands } = harness({ candidates: 40 });
    const file = await service.candidateReportExport(
      'admin-1',
      'rao',
      { location: 'pune', skill: 'java', status: 'active', from: '2026-01-01', to: '2026-01-02' },
      NOW,
    );
    const emails = sheetRows(await readWorkbook(file.buffer), 'Candidates').slice(1).map((r) => r[1]);
    const end = new Date(Date.UTC(2026, 0, 2, 18, 29, 59, 999));
    const start = new Date(Date.UTC(2025, 11, 31, 18, 30));
    const expected = cands
      .filter(
        (c) =>
          c.lastName === 'Rao' &&
          c.city === 'Pune' &&
          c.skills.some((s: Row) => s.name === 'Java') &&
          c.user.status === 'ACTIVE' &&
          c.createdAt >= start &&
          c.createdAt <= end,
      )
      .map((c) => c.user.email)
      .reverse();
    assert.ok(expected.length > 0);
    assert.deepEqual(emails, expected);
    await assert.rejects(service.candidateReportExport('admin-1', undefined, { status: 'BANNED' }, NOW), BadRequestException);
    await assert.rejects(
      service.candidateReportExport('admin-1', undefined, { from: '2026-02-01', to: '2026-01-01' }, NOW),
      BadRequestException,
    );
  });

  it('exports all matching candidates, not only the 100-row Admin list page', async () => {
    const total = REPORT_EXPORT_BATCH * 2 + 3;
    const { service, calls } = harness({ candidates: total });
    const list = await service.candidates();
    assert.equal(calls.candidateQueries[0].take, 100, 'Admin list is capped at 100');
    void list;
    calls.candidateQueries.length = 0;
    const file = await service.candidateReportExport('admin-1', undefined, {}, NOW);
    assert.equal(file.rowCount, total);
    const rows = sheetRows(await readWorkbook(file.buffer), 'Candidates');
    assert.equal(rows.length, total + 1);
    assert.equal(new Set(rows.slice(1).map((r) => r[1])).size, total, 'no duplicates across batches');
    assert.equal(calls.candidateQueries.length, 3);
    assert.deepEqual(calls.candidateQueries[1].cursor, { id: calls.candidateQueries[1].cursor.id });
    assert.equal(calls.candidateQueries[1].skip, 1);
  });

  it('contains no passwords, hashes, tokens or keys and writes a non-PII audit entry', async () => {
    const { service, calls } = harness();
    const file = await service.candidateReportExport('admin-1', undefined, { location: 'Pune' }, NOW);
    assertNoSecrets(await workbookText(file.buffer));
    for (const q of calls.candidateQueries) assert.doesNotMatch(JSON.stringify(q.select), /password|token|secret/i);
    assert.equal(calls.audits[0].action, 'EXPORT_CANDIDATE_REPORT');
    assert.equal(calls.audits[0].resourceType, 'REPORT');
    assert.deepEqual(JSON.parse(calls.audits[0].newValue), { rows: 3, filters: 'location=Pune' });
  });
});

/* ---------- candidate recruitment fields ---------- */

describe('Candidate Report — Current Position, Mock Interview Taken, Years of Experience', () => {
  const profile = (extra: Row = {}): Row => ({
    hasExperience: null,
    experienceLevel: null,
    totalExperienceYears: 0,
    totalExperienceMonths: 0,
    experiences: [],
    ...extra,
  });

  it('1/A. a fresher shows Fresher for position and experience', () => {
    for (const p of [profile(), profile({ hasExperience: 'NONE', experienceLevel: 'fresher' })]) {
      assert.equal(candidateCurrentPosition(p as never), 'Fresher');
      assert.equal(candidateYearsOfExperience(p as never), 'Fresher');
    }
  });

  it('D. no experience but education and an internship → still Fresher (internships are not a current position)', () => {
    const p = profile({ hasExperience: 'INTERNSHIP', experiences: [role('Marketing Intern', { isInternship: true, stillInCompany: true })] });
    assert.equal(candidateCurrentPosition(p as never), 'Fresher');
    assert.equal(candidateYearsOfExperience(p as never), 'Fresher');
  });

  it('2/3/4/B. experienced: current paid role title and stored years (+ months as one decimal)', () => {
    const p = profile({
      hasExperience: 'YES',
      totalExperienceYears: 7,
      totalExperienceMonths: 6,
      experiences: [
        role('Junior Developer', { startDate: new Date('2016-01-01') }),
        role('Senior Java Developer', { stillInCompany: true, startDate: new Date('2021-04-01') }),
        role('Java Developer', { startDate: new Date('2019-01-01') }),
      ],
    });
    assert.equal(candidateCurrentPosition(p as never), 'Senior Java Developer');
    assert.equal(candidateYearsOfExperience(p as never), 7.5);
    assert.equal(candidateYearsOfExperience(profile({ hasExperience: 'YES', totalExperienceYears: 3 }) as never), 3);
    assert.equal(candidateYearsOfExperience(profile({ hasExperience: 'YES', totalExperienceYears: 1, totalExperienceMonths: 4 }) as never), 1.3);
    assert.equal(candidateYearsOfExperience(profile({ hasExperience: 'YES', totalExperienceMonths: 6 }) as never), 0.5);
  });

  it('without a current role the most recently started paid role is the position', () => {
    const p = profile({
      hasExperience: 'YES',
      totalExperienceYears: 4,
      experiences: [role('Frontend Developer', { startDate: new Date('2022-02-01') }), role('Web Designer', { startDate: new Date('2019-06-01') })],
    });
    assert.equal(candidateCurrentPosition(p as never), 'Frontend Developer');
  });

  it('ties between current roles prefer a real company over a resume-sync placeholder, in either order', () => {
    const same = { stillInCompany: true, startDate: new Date('2023-06-01') };
    const real = role('Team Lead', { ...same, company: 'Infinite Potential Digital Marketing', createdAt: new Date('2026-09-28T05:47:14.100Z') });
    const placeholder = role('Team Leader', { ...same, company: 'Company', createdAt: new Date('2026-09-28T05:47:14.900Z') });
    for (const experiences of [[real, placeholder], [placeholder, real]]) {
      assert.equal(candidateCurrentPosition(profile({ hasExperience: 'YES', totalExperienceYears: 5, experiences }) as never), 'Team Lead');
    }
  });

  it('C. experienced with no titled paid role → no position (never invented)', () => {
    for (const experiences of [[], [role('   ')], [role('Role')], [role('Data Intern', { isInternship: true })]]) {
      const p = profile({ hasExperience: 'YES', totalExperienceYears: 2, experiences });
      assert.equal(candidateCurrentPosition(p as never), null, JSON.stringify(experiences.map((e) => e.jobTitle)));
    }
  });

  it('8/F. experienced with no stored years (incomplete or legacy profile) → no experience value, not a guess', () => {
    const p = profile({ hasExperience: 'YES', experiences: [role('Project Manager', { startDate: new Date('2015-01-01') })] });
    assert.equal(candidateYearsOfExperience(p as never), null);
    assert.equal(candidateCurrentPosition(p as never), 'Project Manager');
  });

  it('5/6/7/E. Mock Interview Taken is Yes when at least one AI or human mock interview is completed', () => {
    assert.equal(mockInterviewTaken({ interviews: 1, humanMockInterviews: 0 }), 'Yes');
    assert.equal(mockInterviewTaken({ interviews: 0, humanMockInterviews: 1 }), 'Yes');
    assert.equal(mockInterviewTaken({ interviews: 3, humanMockInterviews: 2 }), 'Yes');
    assert.equal(mockInterviewTaken({ interviews: 0, humanMockInterviews: 0 }), 'No');
    assert.equal(COMPLETED_MOCK_INTERVIEW_STATUS, 'COMPLETED');
  });

  it('9/10. Excel has the three headers after the existing columns and resolved values per candidate', async () => {
    const { service, cands, calls } = harness({ candidates: 6 });
    // Newest first: cands[5] is the first data row.
    Object.assign(cands[5]!, {
      hasExperience: 'YES',
      totalExperienceYears: 5,
      experiences: [role('Software Engineer', { stillInCompany: true, startDate: new Date('2023-01-01') })],
      interviews: [{ status: 'IN_PROGRESS' }, { status: 'COMPLETED' }, { status: 'COMPLETED' }],
    });
    Object.assign(cands[4]!, {
      hasExperience: 'NONE',
      interviews: [{ status: 'IN_PROGRESS' }],
      humanMockInterviews: [{ status: 'SCHEDULED' }, { status: 'CANCELLED' }],
    });
    Object.assign(cands[3]!, { hasExperience: 'NONE', humanMockInterviews: [{ status: 'COMPLETED' }] });
    Object.assign(cands[2]!, { hasExperience: 'YES', totalExperienceYears: 2, totalExperienceMonths: 6, experiences: [role('Role')] });
    Object.assign(cands[1]!, { hasExperience: 'YES', experiences: [role('Project Manager')] });
    const file = await service.candidateReportExport('admin-1', undefined, {}, NOW);
    const rows = sheetRows(await readWorkbook(file.buffer), 'Candidates');
    assert.deepEqual(rows[0]!.slice(0, 10), CANDIDATE_HEADERS.slice(0, 10), 'existing columns unchanged and in order');
    assert.deepEqual(rows[0]!.slice(10), ['Current Position', 'Mock Interview Taken', 'Years of Experience']);
    assert.equal(rows.length, 7, 'one row per candidate');
    assert.deepEqual(
      rows.slice(1).map((r) => r.slice(10)),
      [
        ['Software Engineer', 'Yes', 5],
        ['Fresher', 'No', 'Fresher'],
        ['Fresher', 'Yes', 'Fresher'],
        ['—', 'No', 2.5],
        ['Project Manager', 'No', '—'],
        ['Fresher', 'No', 'Fresher'],
      ],
    );
    const q = calls.candidateQueries[0];
    assert.deepEqual(q.select._count.select.interviews, { where: { status: 'COMPLETED' } });
    assert.deepEqual(q.select._count.select.humanMockInterviews, { where: { status: 'COMPLETED' } });
    assert.ok(!('description' in q.select.experiences.select), 'only the fields the report needs');
  });

  it('performance: the new fields add no query — still one candidate query per batch', async () => {
    const total = REPORT_EXPORT_BATCH + 10;
    const { service, calls } = harness({ candidates: total });
    // The fake has no interview / humanMockInterview / candidateExperience delegates: any per-candidate lookup would throw.
    const file = await service.candidateReportExport('admin-1', undefined, {}, NOW);
    assert.equal(file.rowCount, total);
    assert.equal(calls.candidateQueries.length, 2);
  });
});
