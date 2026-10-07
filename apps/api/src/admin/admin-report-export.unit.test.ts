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
    _count: { applications: i % 5, resumes: 1 },
  }));
}

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
      else if (k === '_count') out[k] = row._count;
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
      const controller = new AdminController(service);
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
