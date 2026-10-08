/**
 * EmployersService / JobsService / MatchingService / GstService / WhatsApp guards with an in-memory
 * Prisma double. No network, no Gemini, no WhatsApp sends, no payments.
 * Run: npm.cmd run test:employer -w api
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { JOB_CATEGORIES } from '@careerbridge/shared';
import { EmployersController } from './employers.controller';
import { EmployersService } from './employers.service';
import { JobsService } from '../jobs/jobs.service';
import { MatchingService } from '../matching/matching.service';
import { GstService, GST_MOCK_ACTIVE_MESSAGE } from '../gst/gst.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { WhatsAppWebhookService } from '../whatsapp/whatsapp.webhook.service';
import { InterviewWhatsAppService } from '../whatsapp/interview-whatsapp.service';
import { consentedWhatsAppNumber } from '../whatsapp/interview-lifecycle.util';
import { companyLogoUrl } from './company-logo.util';
import { withNotifyPrefs } from './employer-policy';
import { closedAtForStatusChange } from './job-lifecycle';

const BUCKET = 'srsbbucket';
const EMP_A = '6d318eed-780b-4ee3-9027-5827611b6d55';
const EMP_B = '11111111-2222-4333-8444-555555555555';
const EMP_U = '22222222-3333-4444-8555-666666666666';
const CAND = '33333333-4444-4555-8666-777777777777';
const CAND_OTHER = '44444444-5555-4666-8777-888888888888';
const VALID_GSTIN = '27AAPFU0939F1ZV';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

type Row = Record<string, any>;

function httpStatus(err: unknown) {
  return err instanceof HttpException ? err.getStatus() : null;
}
function httpMessage(err: unknown) {
  const body = err instanceof HttpException ? (err.getResponse() as { message?: string }) : null;
  return String(body?.message || '');
}

function baseEmployer(id: string, userId: string, extra: Row = {}): Row {
  return {
    id,
    userId,
    companyName: 'Acme Pvt Ltd',
    industry: null,
    city: 'Pune',
    contactName: 'HR',
    gstNumber: null,
    cin: null,
    website: null,
    panNumber: null,
    workEmail: null,
    designation: null,
    logoUrl: null,
    verificationStatus: 'UNVERIFIED',
    verified: false,
    ...extra,
  };
}

function makeDb() {
  return {
    employers: [
      // Seeded before the status enum: boolean says verified, enum still UNVERIFIED.
      baseEmployer(EMP_A, 'uA', { verified: true, verificationStatus: 'UNVERIFIED' }),
      baseEmployer(EMP_B, 'uB', { verificationStatus: 'PENDING', gstNumber: '29AAAAA0000A1ZY' }),
      baseEmployer(EMP_U, 'uU'),
    ] as Row[],
    jobs: [
      { id: 'JA1', employerId: EMP_A, title: 'Job A1', status: 'PUBLISHED', salaryMin: 216000, salaryMax: 264000 },
      { id: 'JA2', employerId: EMP_A, title: 'Job A2', status: 'PUBLISHED' },
      { id: 'JA3', employerId: EMP_A, title: 'Job A3', status: 'PUBLISHED' },
      { id: 'JB1', employerId: EMP_B, title: 'Job B1', status: 'PUBLISHED' },
      { id: 'JU1', employerId: EMP_U, title: 'Job U1', status: 'DRAFT' },
    ] as Row[],
    candidates: [
      {
        id: CAND,
        userId: 'cU',
        firstName: 'Asha',
        lastName: 'K',
        city: 'Pune',
        whatsappOptIn: true,
        whatsappNumber: '+919800000001',
        user: { id: 'cU', email: 'asha@example.test', phone: '+919800000001' },
      },
      {
        id: CAND_OTHER,
        userId: 'cO',
        firstName: 'Ravi',
        lastName: null,
        city: 'Pune',
        whatsappOptIn: false,
        whatsappNumber: null,
        user: { id: 'cO', email: null, phone: '+919800000002' },
      },
    ] as Row[],
    applications: [
      { id: 'APP1', candidateId: CAND, jobId: 'JA1', resumeId: 'R1', status: 'APPLIED', createdAt: new Date(1) },
      { id: 'APP2', candidateId: CAND, jobId: 'JA2', resumeId: 'R2', status: 'SHORTLISTED', createdAt: new Date(2) },
      { id: 'APP3', candidateId: CAND_OTHER, jobId: 'JA1', resumeId: 'R3', status: 'HIRED', createdAt: new Date(3) },
      { id: 'APP4', candidateId: CAND_OTHER, jobId: 'JA2', resumeId: 'R4', status: 'WITHDRAWN', createdAt: new Date(4) },
    ] as Row[],
    interviews: [] as Row[],
    notifications: [] as Row[],
    settings: [] as Row[],
    candidateViews: [] as Row[],
  };
}
type Db = ReturnType<typeof makeDb>;

function matches(row: Row, where: Row | undefined, db: Db): boolean {
  for (const [key, cond] of Object.entries(where || {})) {
    if (key === 'job') {
      const job = db.jobs.find((j) => j.id === row.jobId);
      if (!job || (cond.employerId && job.employerId !== cond.employerId)) return false;
      continue;
    }
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('in' in cond) {
        if (!cond.in.includes(row[key])) return false;
        continue;
      }
      if ('not' in cond) {
        if (row[key] === cond.not) return false;
        continue;
      }
      if ('equals' in cond) {
        if (String(row[key] ?? '').toLowerCase() !== String(cond.equals).toLowerCase()) return false;
        continue;
      }
    }
    if (row[key] !== cond) return false;
  }
  return true;
}

function hydrateApplication(db: Db, app: Row) {
  const candidate = db.candidates.find((c) => c.id === app.candidateId)!;
  const job = db.jobs.find((j) => j.id === app.jobId)!;
  return { ...app, candidate: { ...candidate, skills: [] }, job };
}
function hydrateInterview(db: Db, row: Row) {
  const app = db.applications.find((a) => a.id === row.applicationId)!;
  return { ...row, application: hydrateApplication(db, app) };
}

type Opts = {
  recomputeThrows?: boolean;
  gstResult?: Row;
  smtp?: boolean;
  storage?: boolean;
  sendTextResult?: { ok: boolean };
};

function harness(opts: Opts = {}) {
  const db = makeDb();
  const calls = {
    gst: [] as string[],
    employerUpdates: [] as Row[],
    jobUpdates: [] as Row[],
    appUpdates: [] as Row[],
    uploads: [] as Array<{ path: string; opts: Row }>,
    enqueue: [] as string[],
    enqueueKinds: [] as string[],
    rescheduleEmails: [] as Row[],
    confirmNow: [] as string[],
    sendText: [] as Row[],
    notifications: [] as Row[],
    emails: 0,
    downloads: [] as Array<{ userId: string; resumeId: string }>,
    advisoryLocks: 0,
    recompute: 0,
    alerts: 0,
    audits: [] as Row[],
  };
  let seq = 0;

  const prisma: any = {
    employer: {
      findUnique: async ({ where }: Row) => db.employers.find((e) => e.userId === where.userId) ?? null,
      findFirst: async ({ where }: Row) => db.employers.find((e) => matches(e, where, db)) ?? null,
      update: async ({ where, data }: Row) => {
        calls.employerUpdates.push(data);
        const row = db.employers.find((e) => e.id === where.id)!;
        Object.assign(row, data);
        return { ...row };
      },
    },
    job: {
      findFirst: async ({ where }: Row) => db.jobs.find((j) => matches(j, where, db)) ?? null,
      findUnique: async ({ where }: Row) => db.jobs.find((j) => j.id === where.id) ?? null,
      count: async ({ where }: Row) => db.jobs.filter((j) => matches(j, where, db)).length,
      create: async ({ data }: Row) => {
        const row = { id: `J${++seq}`, ...data };
        db.jobs.push(row);
        return row;
      },
      update: async ({ where, data }: Row) => {
        calls.jobUpdates.push(data);
        const row = db.jobs.find((j) => j.id === where.id)!;
        // Prisma leaves a field unchanged when its value is undefined.
        Object.assign(row, Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)));
        return { ...row };
      },
    },
    application: {
      findFirst: async ({ where }: Row) => {
        const rows = db.applications
          .filter((a) => matches(a, where, db))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return rows[0] ? hydrateApplication(db, rows[0]) : null;
      },
      update: async ({ where, data }: Row) => {
        calls.appUpdates.push(data);
        const row = db.applications.find((a) => a.id === where.id)!;
        Object.assign(row, data);
        return { ...row };
      },
    },
    candidate: {
      findUnique: async ({ where }: Row) => db.candidates.find((c) => c.id === where.id) ?? null,
    },
    resume: { findFirst: async () => null },
    platformSetting: {
      findMany: async ({ where }: Row) => db.settings.filter((s) => where.key.in.includes(s.key)),
    },
    employerCandidateView: {
      findUnique: async ({ where }: Row) => {
        const k = where.employerId_candidateId_period;
        return (
          db.candidateViews.find(
            (v) => v.employerId === k.employerId && v.candidateId === k.candidateId && v.period === k.period,
          ) ?? null
        );
      },
      count: async ({ where }: Row) => db.candidateViews.filter((v) => matches(v, where, db)).length,
      create: async ({ data }: Row) => {
        db.candidateViews.push(data);
        return data;
      },
    },
    notification: {
      findFirst: async ({ where }: Row) => db.notifications.find((n) => matches(n, where, db)) ?? null,
    },
    employerInterview: {
      findMany: async ({ where }: Row) => db.interviews.filter((i) => matches(i, where, db)),
      findFirst: async ({ where }: Row) => {
        const row = db.interviews.find((i) => matches(i, where, db));
        return row ? hydrateInterview(db, row) : null;
      },
      create: async ({ data }: Row) => {
        const row = {
          id: `IV${++seq}`,
          createdAt: new Date(),
          confirmedAt: null,
          meetingUrl: null,
          candidateFeedbackAt: null,
          feedbackRequestedAt: null,
          ...data,
        };
        db.interviews.push(row);
        return hydrateInterview(db, row);
      },
      update: async ({ where, data }: Row) => {
        const row = db.interviews.find((i) => i.id === where.id)!;
        Object.assign(row, data);
        return hydrateInterview(db, row);
      },
    },
    auditLog: {
      create: async ({ data }: Row) => {
        calls.audits.push(data);
        return data;
      },
    },
    $executeRaw: async () => {
      calls.advisoryLocks += 1;
      return 1;
    },
    $queryRaw: async () => assert.fail('pg_advisory_xact_lock returns void; $queryRaw cannot deserialize it'),
    $transaction: async (arg: unknown) =>
      typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(prisma) : Promise.all(arg as unknown[]),
  };

  const matching = {
    ensureJobPostingPayment: async () => undefined,
    recomputeMatchesForJob: async () => {
      calls.recompute += 1;
      if (opts.recomputeThrows) throw new Error('Gemini embeddings 429 RESOURCE_EXHAUSTED');
    },
    assertJobUnlocked: async () => undefined,
    candidateUnlockLimit: async () => 0,
    assertCandidateVisibleForJob: async () => undefined,
  };
  const interviewWhatsApp = {
    enqueueInvitation: async (id: string, kind = 'initial') => {
      calls.enqueue.push(id);
      calls.enqueueKinds.push(kind);
    },
    sendConfirmationNow: async (id: string) => {
      calls.confirmNow.push(id);
      return { ok: true };
    },
  };
  const whatsapp = {
    sendText: async (input: Row) => {
      calls.sendText.push(input);
      return opts.sendTextResult ?? { ok: false };
    },
  };
  const whatsappWebhook = { resolveNotifyPhone: (c: Row) => consentedWhatsAppNumber(c) };
  const notifications = {
    create: async (input: Row) => {
      calls.notifications.push(input);
      db.notifications.push(input);
    },
  };
  const config = { get: (_key: string, fallback?: unknown) => fallback };
  const resumes = {
    download: async (userId: string, resumeId: string) => {
      calls.downloads.push({ userId, resumeId });
      return { userId, resumeId };
    },
  };
  const email = {
    isConfigured: () => Boolean(opts.smtp),
    sendEmployerInterviewScheduled: async () => {
      calls.emails += 1;
      return true;
    },
    sendEmployerInterviewRescheduleUpdate: async (input: Row) => {
      calls.emails += 1;
      calls.rescheduleEmails.push(input);
      return true;
    },
    sendEmployerInterviewCancelled: async () => {
      calls.emails += 1;
      return true;
    },
  };
  const jobsService = {
    notifyCandidatesForPublishedJob: async () => {
      calls.alerts += 1;
    },
  };
  const storage = {
    isConfigured: () => Boolean(opts.storage),
    getBucketName: () => BUCKET,
    uploadFile: async (path: string, _buf: Buffer, uploadOpts: Row) => {
      calls.uploads.push({ path, opts: uploadOpts });
    },
    deleteFile: async () => undefined,
    downloadFile: async () => PNG_1X1,
    getSignedUrl: async (path: string) => `https://signed.example/${path}?sig=1`,
  };
  const testimonials = { markEligible: async () => undefined };
  const gst = {
    verify: async (gstin: string) => {
      calls.gst.push(gstin);
      return (
        opts.gstResult ?? {
          success: true,
          verified: true,
          status: 'ACTIVE',
          trademark: 'Mock Trade Name',
          provider: 'MOCK',
          mock: true,
          message: GST_MOCK_ACTIVE_MESSAGE,
        }
      );
    },
  };

  const catalog = {
    isActiveValue: async (kind: string, value: string) =>
      kind === 'JOB_CATEGORY' && (JOB_CATEGORIES as readonly string[]).includes(value),
  };

  const svc = new EmployersService(
    prisma,
    {} as any,
    matching as any,
    interviewWhatsApp as any,
    whatsapp as any,
    whatsappWebhook as any,
    notifications as any,
    config as any,
    resumes as any,
    email as any,
    jobsService as any,
    storage as any,
    testimonials as any,
    gst as any,
    catalog as any,
  );
  return { svc, db, calls, prisma };
}

const jobDto = (extra: Row = {}) => ({
  title: 'Warehouse associate',
  description: 'Pick and pack',
  city: 'Pune',
  category: 'Delivery/Logistics',
  salaryMin: 216000,
  salaryMax: 264000,
  ...extra,
});

describe('Fix 1 — resume download needs employer + job + application', () => {
  it('candidate applied to job A → download OK (that application resume)', async () => {
    const { svc, calls } = harness();
    await svc.downloadCandidateResume('uA', CAND, 'JA1');
    assert.deepEqual(calls.downloads, [{ userId: 'cU', resumeId: 'R1' }]);
  });
  it('candidate applied to job B → download OK (job B application resume)', async () => {
    const { svc, calls } = harness();
    await svc.downloadCandidateResume('uA', CAND, 'JA2');
    assert.deepEqual(calls.downloads, [{ userId: 'cU', resumeId: 'R2' }]);
  });
  it('same employer, job C the candidate did NOT apply to → 403', async () => {
    const { svc, calls } = harness();
    await assert.rejects(svc.downloadCandidateResume('uA', CAND, 'JA3'), (err) => {
      assert.ok(err instanceof ForbiddenException);
      assert.match(httpMessage(err), /not applied to the selected job/);
      return true;
    });
    assert.equal(calls.downloads.length, 0);
  });
  it("employer B → 403, with or without employer A's job id", async () => {
    const { svc, calls } = harness();
    await assert.rejects(svc.downloadCandidateResume('uB', CAND, 'JA1'), ForbiddenException);
    await assert.rejects(svc.downloadCandidateResume('uB', CAND), ForbiddenException);
    assert.equal(calls.downloads.length, 0);
  });
  it('no job id → latest application to this employer', async () => {
    const { svc, calls } = harness();
    await svc.downloadCandidateResume('uA', CAND);
    assert.deepEqual(calls.downloads, [{ userId: 'cU', resumeId: 'R2' }]);
  });
});

describe('Fix 2 — one verification state everywhere', () => {
  it('profile reports the effective status and a boolean derived from it', async () => {
    const { svc } = harness();
    const a = await svc.me('uA');
    assert.equal(a.verificationStatus, 'VERIFIED');
    assert.equal(a.verified, true);
    const b = await svc.me('uB');
    assert.equal(b.verificationStatus, 'PENDING');
    assert.equal(b.verified, false);
    const u = await svc.me('uU');
    assert.equal(u.verificationStatus, 'UNVERIFIED');
    assert.equal(u.verified, false);
  });
  it('UNVERIFIED employer cannot search, invite, post or publish (server-side)', async () => {
    const { svc, calls } = harness();
    await assert.rejects(svc.searchCandidates('uU', { jobId: 'JU1' }), ForbiddenException);
    await assert.rejects(svc.createJob('uU', jobDto() as any), ForbiddenException);
    await assert.rejects(svc.setStatus('uU', 'JU1', 'PUBLISHED' as any), ForbiddenException);
    assert.equal(calls.jobUpdates.length, 0);
  });
  it('KYC-complete / legacy-verified employers pass the gate', async () => {
    const { svc } = harness();
    // Passes the KYC gate, then fails on the next (unrelated) validation.
    await assert.rejects(svc.searchCandidates('uA', {}), (err) => {
      assert.ok(err instanceof BadRequestException);
      assert.match(httpMessage(err), /Select a job/);
      return true;
    });
    await assert.rejects(svc.searchCandidates('uB', {}), BadRequestException);
  });
  it('submitVerification keeps the boolean in sync with the status', async () => {
    const { svc, calls } = harness();
    await svc.submitVerification('uB', { companyName: 'Beta Co', workEmail: 'hr@beta.in', designation: 'HR Manager' });
    assert.equal(calls.employerUpdates.at(-1)?.verificationStatus, 'PENDING');
    assert.equal(calls.employerUpdates.at(-1)?.verified, false);
  });
});

describe('Fix 3 — PATCH /employers/me/kyc validates GSTIN on the server', () => {
  const kyc = (extra: Row = {}) => ({
    gstNumber: VALID_GSTIN,
    panNumber: 'AAPFU0939F',
    website: 'https://acme.in',
    ...extra,
  });

  it('invalid format/checksum → 400 before any provider call', async () => {
    const { svc, calls } = harness();
    await assert.rejects(svc.saveKyc('uU', kyc({ gstNumber: '27AAPFU0939F1ZX' })), BadRequestException);
    await assert.rejects(svc.saveKyc('uU', kyc({ gstNumber: 'NOTAGSTIN' })), BadRequestException);
    assert.equal(calls.gst.length, 0);
    assert.equal(calls.employerUpdates.length, 0);
  });
  it('NOT_ACTIVE → 400, nothing saved', async () => {
    const { svc, calls } = harness({
      gstResult: { success: true, verified: false, status: 'NOT_ACTIVE', message: 'This GSTIN is not active.', provider: 'GSTINAPI', mock: false },
    });
    await assert.rejects(svc.saveKyc('uU', kyc()), (err) => {
      assert.equal(httpStatus(err), 400);
      return true;
    });
    assert.equal(calls.employerUpdates.length, 0);
  });
  it('provider unavailable → 503, nothing saved', async () => {
    const { svc, calls } = harness({
      gstResult: { success: false, verified: false, status: 'UNKNOWN', message: 'unavailable', provider: 'GSTINAPI', mock: false },
    });
    await assert.rejects(svc.saveKyc('uU', kyc()), (err) => {
      assert.equal(httpStatus(err), 503);
      return true;
    });
    assert.equal(calls.employerUpdates.length, 0);
  });
  it('GSTIN already used by another employer → 409', async () => {
    const { svc, db, calls } = harness();
    db.employers.find((e) => e.id === EMP_B)!.gstNumber = VALID_GSTIN.toLowerCase();
    await assert.rejects(svc.saveKyc('uU', kyc()), (err) => {
      assert.equal(httpStatus(err), 409);
      return true;
    });
    assert.equal(calls.employerUpdates.length, 0);
  });
  it('resaving your own GSTIN is not a duplicate', async () => {
    const { svc, db } = harness();
    db.employers.find((e) => e.id === EMP_U)!.gstNumber = VALID_GSTIN;
    await svc.saveKyc('uU', kyc());
  });
  it('mock ACTIVE: saves KYC_COMPLETE, keeps company name, ignores client trademark, says MOCK', async () => {
    const { svc, calls } = harness();
    const res = await svc.saveKyc('uU', kyc({ trademark: 'Totally Real Corp' }));
    const saved = calls.employerUpdates.at(-1)!;
    assert.equal(saved.gstNumber, VALID_GSTIN);
    assert.equal(saved.verificationStatus, 'KYC_COMPLETE');
    assert.equal(saved.verified, false);
    assert.equal('companyName' in saved, false);
    assert.deepEqual(res.gstVerification, { status: 'ACTIVE', provider: 'MOCK', mock: true });
    assert.equal(res.verified, false);
  });
  it('live provider trade name may set the company name', async () => {
    const { svc, calls } = harness({
      gstResult: { success: true, verified: true, status: 'ACTIVE', trademark: 'ACME  TRADERS', provider: 'GSTINAPI', mock: false },
    });
    await svc.saveKyc('uU', kyc());
    assert.equal(calls.employerUpdates.at(-1)?.companyName, 'ACME TRADERS');
  });
  it('changing GSTIN on a PENDING employer resets to KYC_COMPLETE', async () => {
    const { svc, calls } = harness();
    await svc.saveKyc('uB', kyc());
    assert.equal(calls.employerUpdates.at(-1)?.verificationStatus, 'KYC_COMPLETE');
  });
  it('website with a non-http scheme is rejected in KYC too', async () => {
    const { svc, calls } = harness();
    await assert.rejects(svc.saveKyc('uU', kyc({ website: 'javascript:alert(1)' })), BadRequestException);
    assert.equal(calls.gst.length, 0);
  });
});

describe('Fix 3 — GstService reports MOCK truthfully', () => {
  const make = (cfg: Row, details: Row) => {
    const audits: Row[] = [];
    const svc = new GstService(
      { get: () => cfg } as any,
      { getGstinDetails: async () => details } as any,
      { gstVerificationAudit: { create: async ({ data }: Row) => audits.push(data) } } as any,
    );
    return { svc, audits };
  };
  const mockCfg = { environment: 'sandbox', provider: 'IRIS_IRP', gstinApiKey: '', mockEnabled: true, configured: false };

  it('mock ACTIVE → provider MOCK, mock=true, user-facing test-mode message, audit says MOCK', async () => {
    const { svc, audits } = make(mockCfg, { status: 'ACTIVE', tradeName: 'Mock Traders', responseCode: '200' });
    const r = await svc.verify(VALID_GSTIN, 'u1');
    assert.equal(r.provider, 'MOCK');
    assert.equal(r.mock, true);
    assert.equal(r.message, GST_MOCK_ACTIVE_MESSAGE);
    assert.doesNotMatch(String(r.message), /GSTINAPI_KEY|GST_MOCK|IRIS/);
    assert.equal(audits[0]?.provider, 'MOCK');
  });
  it('mock NOT_ACTIVE message has no env-var names', async () => {
    const { svc } = make(mockCfg, { status: 'NOT_ACTIVE', tradeName: null });
    const r = await svc.verify(VALID_GSTIN);
    assert.equal(r.mock, true);
    assert.doesNotMatch(String(r.message), /GSTINAPI_KEY|GST_MOCK|IRIS/);
  });
  it('live provider → provider label kept, mock=false, audit provider matches', async () => {
    const { svc, audits } = make(
      { environment: 'production', provider: 'GSTINAPI', gstinApiKey: 'x', mockEnabled: false, configured: true },
      { status: 'ACTIVE', tradeName: 'Acme' },
    );
    const r = await svc.verify(VALID_GSTIN);
    assert.equal(r.provider, 'GSTINAPI');
    assert.equal(r.mock, false);
    assert.equal(audits[0]?.provider, 'GSTINAPI');
  });
});

describe('Fix 4 — website validation on profile update', () => {
  it('rejects javascript:/data:/file:, accepts https', async () => {
    const { svc, calls } = harness();
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'ftp://acme.in']) {
      await assert.rejects(svc.updateMe('uA', { website: bad }), BadRequestException, bad);
    }
    assert.equal(calls.employerUpdates.length, 0);
    await svc.updateMe('uA', { website: 'https://acme.in' });
    assert.equal(calls.employerUpdates.at(-1)?.website, 'https://acme.in/');
  });
});

describe('Fix 5 — logo upload is validated and stored privately', () => {
  it('mismatched bytes → 400, nothing stored', async () => {
    const { svc, calls } = harness({ storage: true });
    const html = Buffer.from('<html></html>');
    await assert.rejects(
      svc.uploadLogoFile('uA', { buffer: html, mimetype: 'image/png', size: html.length }),
      BadRequestException,
    );
    assert.equal(calls.uploads.length, 0);
    assert.equal(calls.employerUpdates.length, 0);
  });
  it('valid PNG → private upload at the canonical key; profile returns a signed URL', async () => {
    const { svc, calls } = harness({ storage: true });
    const profile = await svc.uploadLogoFile('uA', { buffer: PNG_1X1, mimetype: 'image/png', size: PNG_1X1.length });
    assert.equal(calls.uploads.length, 1);
    assert.equal(calls.uploads[0]?.path, `Images/company-logo-${EMP_A}.png`);
    assert.equal(calls.uploads[0]?.opts.isPublic, false);
    assert.equal(calls.employerUpdates.at(-1)?.logoUrl, companyLogoUrl(BUCKET, EMP_A, 'png'));
    assert.equal(profile.logoUrl, `https://signed.example/Images/company-logo-${EMP_A}.png?sig=1`);
  });
  it("a stored reference to another employer's logo or an external URL is never served", async () => {
    const { svc, db } = harness({ storage: true });
    db.employers.find((e) => e.id === EMP_A)!.logoUrl = companyLogoUrl(BUCKET, EMP_B, 'png');
    assert.equal((await svc.me('uA')).logoUrl, null);
    db.employers.find((e) => e.id === EMP_A)!.logoUrl = 'https://evil.example/logo.png';
    assert.equal((await svc.me('uA')).logoUrl, null);
  });
});

describe('Fix 6 — salary range on the server', () => {
  it('create and update reject min > max', async () => {
    const { svc, calls } = harness();
    await assert.rejects(svc.createJob('uA', jobDto({ salaryMin: 50000, salaryMax: 20000 }) as any), BadRequestException);
    await assert.rejects(svc.updateJob('uA', 'JA1', jobDto({ salaryMin: 50000, salaryMax: 20000 }) as any), BadRequestException);
    assert.equal(calls.jobUpdates.length, 0);
    const job = await svc.createJob('uA', jobDto({ salaryMin: 20000, salaryMax: 50000 }) as any);
    assert.equal(job.salaryMin, 20000);
  });
  it('create rejects a category that is not in the admin-managed catalog', async () => {
    const { svc } = harness();
    await assert.rejects(
      svc.createJob('uA', jobDto({ category: 'Not A Category' }) as any),
      (err) => httpStatus(err) === 400 && /valid job category/.test(httpMessage(err)),
    );
  });
  it('publishing requires both salary ends; a draft may be saved without salary', async () => {
    const { svc, calls, db } = harness();
    await assert.rejects(
      svc.createJob('uA', jobDto({ salaryMin: undefined, publish: true }) as any),
      (err) => httpStatus(err) === 400 && /Minimum salary is required/.test(httpMessage(err)),
    );
    await assert.rejects(
      svc.createJob('uA', jobDto({ salaryMax: 0, publish: true }) as any),
      (err) => httpStatus(err) === 400 && /Maximum salary is required/.test(httpMessage(err)),
    );
    const draft: any = await svc.createJob('uA', jobDto({ salaryMin: undefined, salaryMax: undefined }) as any);
    assert.equal(draft.status, 'DRAFT');
    Object.assign(db.jobs.find((j) => j.id === draft.id)!, { salaryMin: null, salaryMax: null });
    const writes = calls.jobUpdates.length;
    await assert.rejects(
      svc.setStatus('uA', draft.id, 'PUBLISHED' as any),
      (err) => httpStatus(err) === 400 && /Minimum salary is required/.test(httpMessage(err)),
    );
    assert.equal(calls.jobUpdates.length, writes);
  });
});

describe('Fix 7 — only PUBLISHED jobs are public', () => {
  const make = (status: string, applied: boolean) => {
    const svc = new JobsService(
      {
        job: { findUnique: async () => ({ id: 'J', status, description: 'd', experience: 'x', benefits: null, employer: {} }) },
        application: { findUnique: async () => (applied ? { id: 'A' } : null) },
        savedJob: { findUnique: async () => null },
      } as any,
      {} as any,
      {} as any,
    );
    (svc as any).loadCandidate = async () => ({ id: CAND });
    (svc as any).toCard = () => ({ id: 'J' });
    return svc;
  };
  it('anonymous / not-applied users get 404 for PAUSED, CLOSED, DRAFT', async () => {
    for (const status of ['PAUSED', 'CLOSED', 'DRAFT']) {
      await assert.rejects(make(status, false).detail('J'), NotFoundException, status);
      await assert.rejects(make(status, false).detail('J', 'cU'), NotFoundException, status);
    }
  });
  it('EDGE-07: a job the employer just published is visible to anonymous users and candidates', async () => {
    const { svc } = harness();
    const published: any = await svc.createJob('uA', jobDto({ publish: true }) as any);
    const make = (status: string) => {
      const jobs = new JobsService(
        {
          job: { findUnique: async () => ({ ...published, status, benefits: null, employer: {} }) },
          application: { findUnique: async () => null },
          savedJob: { findUnique: async () => null },
        } as any,
        {} as any,
        {} as any,
      );
      (jobs as any).loadCandidate = async () => ({ id: CAND });
      (jobs as any).toCard = (row: Row) => ({ id: row.id });
      return jobs;
    };
    assert.equal((await make(published.status).detail(published.id)).status, 'PUBLISHED');
    assert.equal((await make(published.status).detail(published.id, 'cU')).status, 'PUBLISHED');
    await assert.rejects(make('PENDING_REVIEW').detail(published.id), NotFoundException);
  });
  it('PUBLISHED is visible; an applicant can still open their PAUSED/CLOSED job but not a DRAFT', async () => {
    assert.equal((await make('PUBLISHED', false).detail('J')).status, 'PUBLISHED');
    assert.equal((await make('PAUSED', true).detail('J', 'cU')).status, 'PAUSED');
    assert.equal((await make('CLOSED', true).detail('J', 'cU')).status, 'CLOSED');
    await assert.rejects(make('DRAFT', true).detail('J', 'cU'), NotFoundException);
  });
});

describe('Fix 8 — publish survives an ATS recompute failure', () => {
  it('recompute throws → resumed (previously approved) job persisted, matching FAILED (no 500)', async () => {
    const { svc, calls, db } = harness({ recomputeThrows: true });
    Object.assign(db.jobs.find((j) => j.id === 'JA1')!, { status: 'PAUSED', publishedAt: new Date(1) });
    const res = await svc.setStatus('uA', 'JA1', 'PUBLISHED' as any);
    assert.equal(res.status, 'PUBLISHED');
    assert.equal((res as any).matching.status, 'FAILED');
    assert.match((res as any).matching.message, /job is saved/);
    assert.equal(db.jobs.find((j) => j.id === 'JA1')!.status, 'PUBLISHED');
    assert.equal(calls.recompute, 1);
  });
  it('UT-E11: createJob(publish) is live immediately — PUBLISHED (Active), matching and alerts run, no admin approval', async () => {
    const { svc, calls, db } = harness({ recomputeThrows: true });
    const res: any = await svc.createJob('uA', jobDto({ publish: true }) as any);
    assert.equal(res.status, 'PUBLISHED');
    assert.ok(res.publishedAt instanceof Date);
    assert.equal(res.reviewRequired, undefined);
    assert.equal(res.matching.status, 'FAILED');
    assert.equal(calls.recompute, 1);
    assert.equal(calls.alerts, 1);
    assert.equal(db.jobs.find((j) => j.id === res.id)!.status, 'PUBLISHED');
  });
  it('API-17 / UT-E127: POST /employers/jobs/:id/publish on a never-published draft returns and persists PUBLISHED, never PENDING_REVIEW', async () => {
    const { svc, calls, db } = harness();
    const job = db.jobs.find((j) => j.id === 'JA1')!;
    Object.assign(job, { status: 'DRAFT', publishedAt: null });
    const controller = new EmployersController(svc);
    const res: any = await controller.publish({ id: 'uA' }, 'JA1');
    assert.equal(res.status, 'PUBLISHED');
    assert.equal(res.reviewRequired, undefined);
    assert.equal(res.matching.status, 'COMPUTED');
    assert.equal(job.status, 'PUBLISHED');
    assert.ok(job.publishedAt instanceof Date);
    assert.equal(calls.recompute, 1);
    assert.equal(calls.alerts, 1);
    assert.ok(!calls.jobUpdates.some((u) => u.status === 'PENDING_REVIEW'));
    await assert.rejects(controller.publish({ id: 'uB' }, 'JA1'), NotFoundException);
  });
  it('a job left in the legacy PENDING_REVIEW state is published by the employer without admin approval', async () => {
    const { svc, calls, db } = harness();
    db.settings.push({ key: 'billing.starterActiveJobLimit', value: '1' });
    const job = db.jobs.find((j) => j.id === 'JA1')!;
    Object.assign(job, { status: 'PENDING_REVIEW', publishedAt: null });
    const res: any = await svc.setStatus('uA', 'JA1', 'PUBLISHED' as any);
    assert.equal(res.status, 'PUBLISHED');
    assert.equal(job.status, 'PUBLISHED');
    assert.equal(calls.recompute, 1);
  });
  it('publish still enforces the salary rule; nothing is written', async () => {
    const { svc, calls, db } = harness();
    const job = db.jobs.find((j) => j.id === 'JA1')!;
    Object.assign(job, { status: 'DRAFT', publishedAt: null, salaryMin: null, salaryMax: null });
    await assert.rejects(svc.setStatus('uA', 'JA1', 'PUBLISHED' as any), BadRequestException);
    assert.equal(calls.jobUpdates.length, 0);
    assert.equal(job.status, 'DRAFT');
  });
  it('ST-23: admin approval of a historical PENDING_REVIEW job runs matching and notifies the employer; a failing recompute is reported, not thrown', async () => {
    const { svc, calls, db } = harness({ recomputeThrows: true });
    const job = db.jobs.find((j) => j.id === 'JA1')!;
    job.employer = db.employers.find((e) => e.id === EMP_A);
    const res: any = await svc.completeJobApproval('JA1');
    assert.equal(res.matching.status, 'FAILED');
    assert.equal(calls.recompute, 1);
    assert.ok(calls.notifications.some((n) => n.userId === 'uA' && n.title === 'Job approved'));
  });
  it('successful recompute → COMPUTED; close does not recompute; re-publish works', async () => {
    const { svc, calls } = harness();
    const published: any = await svc.setStatus('uA', 'JA1', 'PUBLISHED' as any);
    assert.equal(published.matching.status, 'COMPUTED');
    const closed: any = await svc.setStatus('uA', 'JA1', 'CLOSED' as any);
    assert.equal(closed.status, 'CLOSED');
    assert.equal(closed.matching, undefined);
    assert.equal(calls.recompute, 1);
    const again: any = await svc.setStatus('uA', 'JA1', 'PUBLISHED' as any);
    assert.equal(again.status, 'PUBLISHED');
    assert.equal(calls.recompute, 2);
  });
  it('closedAtForStatusChange: entering CLOSED stamps, staying CLOSED keeps, leaving CLOSED clears', () => {
    const now = new Date('2026-10-08T06:30:00.000Z');
    for (const from of ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'PAUSED']) {
      assert.equal(closedAtForStatusChange(from, 'CLOSED', now), now, `${from} → CLOSED`);
      assert.equal(closedAtForStatusChange('CLOSED', from, now), null, `CLOSED → ${from}`);
      assert.equal(closedAtForStatusChange(from, 'PUBLISHED', now), undefined, `${from} → PUBLISHED`);
    }
    assert.equal(closedAtForStatusChange('CLOSED', 'CLOSED', now), undefined);
  });
  it('G. employer close (OPEN → CLOSED) records closedAt at the transition', async () => {
    const { svc, db, calls } = harness();
    const job = db.jobs.find((j) => j.id === 'JA1')!;
    assert.equal(job.status, 'PUBLISHED');
    const before = Date.now();
    const closed: any = await svc.setStatus('uA', 'JA1', 'CLOSED' as any);
    assert.equal(closed.status, 'CLOSED');
    assert.ok(closed.closedAt instanceof Date && closed.closedAt.getTime() >= before && closed.closedAt.getTime() <= Date.now());
    assert.equal(job.closedAt, closed.closedAt);
    assert.equal(calls.jobUpdates.at(-1)!.publishedAt, undefined, 'closing keeps the posted date');
  });
  it('H. closing an already CLOSED job, or editing it, leaves closedAt unchanged', async () => {
    const { svc, db } = harness();
    const job = db.jobs.find((j) => j.id === 'JA1')!;
    const original = new Date('2026-10-02T05:00:00.000Z');
    Object.assign(job, { status: 'CLOSED', closedAt: original });
    await svc.setStatus('uA', 'JA1', 'CLOSED' as any);
    assert.equal(job.closedAt, original);
    await svc.updateJob('uA', 'JA1', jobDto({ title: 'Renamed after close' }) as any);
    assert.equal(job.title, 'Renamed after close');
    assert.equal(job.status, 'CLOSED');
    assert.equal(job.closedAt, original);
  });
  it('J. reopening clears closedAt and closing again records the new close; pausing never sets it', async () => {
    const { svc, db } = harness();
    const job = db.jobs.find((j) => j.id === 'JA1')!;
    Object.assign(job, { status: 'CLOSED', closedAt: new Date('2026-10-02T05:00:00.000Z') });
    const reopened: any = await svc.setStatus('uA', 'JA1', 'PUBLISHED' as any);
    assert.equal(reopened.status, 'PUBLISHED');
    assert.equal(job.closedAt, null);
    const paused: any = await svc.setStatus('uA', 'JA1', 'PAUSED' as any);
    assert.equal(paused.status, 'PAUSED');
    assert.equal(job.closedAt, null);
    const before = Date.now();
    const reclosed: any = await svc.setStatus('uA', 'JA1', 'CLOSED' as any);
    assert.ok(reclosed.closedAt instanceof Date && reclosed.closedAt.getTime() >= before);
  });
  it('editing a published job with failing recompute still saves', async () => {
    const { svc } = harness({ recomputeThrows: true });
    const res: any = await svc.updateJob('uA', 'JA1', jobDto() as any);
    assert.equal(res.matching.status, 'FAILED');
  });
});

describe('Fix 9 — application transitions', () => {
  it('HIRED / WITHDRAWN applications cannot be moved; nothing written', async () => {
    const { svc, calls } = harness();
    await assert.rejects(svc.changeStatus('uA', 'APP3', 'SHORTLIST'), (err) => httpStatus(err) === 409);
    await assert.rejects(svc.changeStatus('uA', 'APP4', 'REVIEW'), (err) => httpStatus(err) === 409);
    await assert.rejects(svc.changeStatus('uA', 'APP4', 'HIRE'), (err) => httpStatus(err) === 409);
    assert.equal(calls.appUpdates.length, 0);
  });
  it('same status is a no-op; forward moves still work', async () => {
    const { svc, calls } = harness();
    await svc.changeStatus('uA', 'APP2', 'SHORTLIST');
    assert.equal(calls.appUpdates.length, 0);
    await svc.changeStatus('uA', 'APP1', 'SHORTLIST');
    assert.deepEqual(calls.appUpdates, [{ status: 'SHORTLISTED' }]);
  });
  it('another employer cannot change the application', async () => {
    const { svc } = harness();
    await assert.rejects(svc.changeStatus('uB', 'APP1', 'REJECT'), NotFoundException);
  });
  it('skipping stages is rejected with 409 and nothing is written', async () => {
    const { svc, calls } = harness();
    await assert.rejects(svc.changeStatus('uA', 'APP1', 'HIRE'), (err) => httpStatus(err) === 409);
    await assert.rejects(svc.changeStatus('uA', 'APP1', 'SELECT'), (err) => httpStatus(err) === 409);
    await assert.rejects(svc.changeStatus('uA', 'APP2', 'SELECT'), (err) => httpStatus(err) === 409);
    assert.equal(calls.appUpdates.length, 0);
    assert.equal(calls.notifications.length, 0);
  });
  it('shortlist / hold / reject notify the candidate in-app; reject includes the reason', async () => {
    const { svc, calls } = harness();
    const res: any = await svc.changeStatus('uA', 'APP1', 'SHORTLIST');
    assert.equal(res.status, 'SHORTLISTED');
    assert.equal(calls.notifications.at(-1)?.userId, 'cU');
    assert.equal(calls.notifications.at(-1)?.link, '/applications/APP1');
    await svc.changeStatus('uA', 'APP1', 'HOLD');
    assert.deepEqual(calls.appUpdates.at(-1), { status: 'ON_HOLD' });
    await svc.changeStatus('uA', 'APP1', 'REJECT', 'Looking for more React experience');
    assert.match(String(calls.notifications.at(-1)?.body), /Feedback: Looking for more React experience/);
    assert.equal(calls.notifications.length, 3);
  });
  it('Starter plan: publishing beyond the active-job limit is refused; nothing written', async () => {
    const { svc, calls, db } = harness();
    db.employers.find((e) => e.id === EMP_A)!.verificationStatus = 'KYC_COMPLETE';
    db.jobs.push(
      { id: 'JA4', employerId: EMP_A, title: 'Job A4', status: 'PENDING_REVIEW' },
      { id: 'JA5', employerId: EMP_A, title: 'Job A5', status: 'PUBLISHED' },
      { id: 'JA6', employerId: EMP_A, title: 'Job A6', status: 'DRAFT', salaryMin: 216000, salaryMax: 264000 },
    );
    await assert.rejects(svc.setStatus('uA', 'JA6', 'PUBLISHED' as any), (err) => {
      assert.equal(httpStatus(err), 403);
      assert.match(httpMessage(err), /5 active jobs/);
      return true;
    });
    assert.equal(calls.jobUpdates.length, 0);
    db.settings.push({ key: 'billing.starterActiveJobLimit', value: '0' });
    const res: any = await svc.setStatus('uA', 'JA6', 'PUBLISHED' as any);
    assert.equal(res.status, 'PUBLISHED');
  });
  it('Starter plan: candidate view credits are counted once per candidate per month and enforced', async () => {
    const { svc, db } = harness();
    db.settings.push({ key: 'billing.starterCandidateViewCredits', value: '1' });
    const record = (candidateId: string, applied: boolean) =>
      (svc as any).recordCandidateView(EMP_A, candidateId, 'JA1', applied);
    await record(CAND, false);
    await record(CAND, false);
    assert.equal(db.candidateViews.length, 1);
    await assert.rejects(record(CAND_OTHER, false), (err) => httpStatus(err) === 403);
    await record(CAND_OTHER, true);
    assert.equal(db.candidateViews.length, 2);
  });
  it('hiring outcome cannot revive a WITHDRAWN application', async () => {
    const matching = new MatchingService(
      {
        employer: { findUnique: async () => ({ id: EMP_A, verified: false, verificationStatus: 'KYC_COMPLETE' }) },
        application: { findFirst: async () => ({ id: 'APP4', status: 'WITHDRAWN', jobId: 'JA2', candidateId: CAND_OTHER, job: {} }) },
        $transaction: async () => assert.fail('must not write'),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    await assert.rejects(matching.recordHiringOutcome('uA', 'APP4', 'HIRED'), ConflictException);
  });
  it('ATS recompute/list require KYC and job ownership', async () => {
    const jobs = [{ id: 'JA1', employerId: EMP_A }];
    const employers: Record<string, Row> = {
      uU: { id: EMP_U, verified: false, verificationStatus: 'UNVERIFIED' },
      uB: { id: EMP_B, verified: false, verificationStatus: 'PENDING' },
    };
    const matching = new MatchingService(
      {
        employer: { findUnique: async ({ where }: Row) => employers[where.userId] ?? null },
        job: { findFirst: async ({ where }: Row) => jobs.find((j) => j.id === where.id && j.employerId === where.employerId) ?? null },
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    await assert.rejects(matching.recomputeMatches('uU', 'JA1'), ForbiddenException);
    await assert.rejects(matching.listMatches('uU', 'JA1'), ForbiddenException);
    await assert.rejects(matching.recomputeMatches('uB', 'JA1'), NotFoundException);
  });
});

describe('Fix 10 — interview scheduling', () => {
  const future = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
  const schedule = (extra: Row = {}) => ({
    applicationId: 'APP1',
    scheduledAt: future(48),
    durationMin: 30,
    mode: 'VIDEO',
    location: 'https://meet.google.com/abc-defg-hij',
    ...extra,
  });

  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness();
    h.db.applications.find((a) => a.id === 'APP1')!.status = 'SHORTLISTED';
  });

  it('an application that was never shortlisted cannot be scheduled; nothing written', async () => {
    h.db.applications.find((a) => a.id === 'APP1')!.status = 'APPLIED';
    await assert.rejects(h.svc.scheduleInterview('uA', schedule()), (err) => {
      assert.equal(httpStatus(err), 409);
      assert.match(httpMessage(err), /Shortlist the candidate/);
      return true;
    });
    assert.equal(h.db.interviews.length, 0);
    assert.equal(h.calls.appUpdates.length, 0);
  });
  it('first schedule succeeds, takes the per-candidate lock and reports real delivery state', async () => {
    const res: any = await h.svc.scheduleInterview('uA', schedule());
    assert.equal(res.status, 'SCHEDULED');
    assert.equal(h.calls.advisoryLocks, 1);
    assert.deepEqual(res.delivery, { inApp: 'CREATED', whatsapp: 'QUEUED', email: 'NOT_CONFIGURED' });
    assert.equal(h.calls.emails, 0);
    assert.equal(h.db.interviews[0]?.timezone, 'Asia/Kolkata');
  });
  it('duplicate active interview for the same application → 409', async () => {
    await h.svc.scheduleInterview('uA', schedule());
    await assert.rejects(h.svc.scheduleInterview('uA', schedule({ scheduledAt: future(96) })), (err) => {
      assert.equal(httpStatus(err), 409);
      assert.match(httpMessage(err), /already scheduled/);
      return true;
    });
    assert.equal(h.db.interviews.length, 1);
  });
  it('overlapping slot for the same candidate on another application → 409', async () => {
    const at = future(48);
    await h.svc.scheduleInterview('uA', schedule({ scheduledAt: at }));
    const clash = new Date(new Date(at).getTime() + 10 * 60_000).toISOString();
    await assert.rejects(h.svc.scheduleInterview('uA', schedule({ applicationId: 'APP2', scheduledAt: clash })), (err) => {
      assert.equal(httpStatus(err), 409);
      assert.match(httpMessage(err), /overlaps/);
      return true;
    });
    const later = new Date(new Date(at).getTime() + 60 * 60_000).toISOString();
    await h.svc.scheduleInterview('uA', schedule({ applicationId: 'APP2', scheduledAt: later }));
    assert.equal(h.db.interviews.length, 2);
  });
  it('a cancelled interview no longer blocks a new one', async () => {
    const first: any = await h.svc.scheduleInterview('uA', schedule());
    await h.svc.updateInterviewStatus('uA', first.id, 'cancel');
    await h.svc.scheduleInterview('uA', schedule());
    assert.equal(h.db.interviews.length, 2);
  });
  it('terminal application (HIRED) cannot be scheduled', async () => {
    await assert.rejects(h.svc.scheduleInterview('uA', schedule({ applicationId: 'APP3' })), (err) => httpStatus(err) === 409);
  });
  it('offset-less time is stored as Asia/Kolkata wall-clock', async () => {
    const d = new Date(Date.now() + 5 * 86_400_000);
    const ymd = d.toISOString().slice(0, 10);
    await h.svc.scheduleInterview('uA', schedule({ scheduledAt: `${ymd}T10:00` }));
    assert.equal(h.db.interviews[0]?.scheduledAt.toISOString(), `${ymd}T04:30:00.000Z`);
  });
  it('cancel → complete is rejected; complete twice is a no-op', async () => {
    const iv: any = await h.svc.scheduleInterview('uA', schedule());
    await h.svc.updateInterviewStatus('uA', iv.id, 'cancel');
    await assert.rejects(h.svc.updateInterviewStatus('uA', iv.id, 'complete'), (err) => httpStatus(err) === 409);
    await assert.rejects(h.svc.updateInterviewStatus('uA', iv.id, 'reschedule', { scheduledAt: future(72) }), (err) => httpStatus(err) === 409);

    const h2 = harness();
    h2.db.applications.find((a) => a.id === 'APP1')!.status = 'SHORTLISTED';
    const iv2: any = await h2.svc.scheduleInterview('uA', schedule());
    await h2.svc.updateInterviewStatus('uA', iv2.id, 'complete');
    const again: any = await h2.svc.updateInterviewStatus('uA', iv2.id, 'complete');
    assert.equal(again.status, 'COMPLETED');
    await assert.rejects(h2.svc.updateInterviewStatus('uA', iv2.id, 'cancel'), (err) => httpStatus(err) === 409);
  });
  it('WhatsApp "on" for a candidate without consent is reported as skipped and never enqueued', async () => {
    h.db.candidates[0].whatsappOptIn = false;
    const iv: any = await h.svc.scheduleInterview('uA', schedule());
    assert.equal(iv.delivery.whatsapp, 'SKIPPED_NO_OPT_IN');
    assert.equal(h.db.interviews[0]?.whatsappStatus, 'SKIPPED_NO_PHONE_OR_OPT_IN');
    assert.equal(h.calls.enqueue.length, 0);

    const moved: any = await h.svc.updateInterviewStatus('uA', iv.id, 'reschedule', { scheduledAt: future(72) });
    assert.equal(moved.delivery.whatsapp, 'SKIPPED_NO_OPT_IN');
    assert.equal(h.calls.enqueue.length, 0);
    assert.equal(h.calls.confirmNow.length, 0);
  });
  it('WhatsApp "off" is respected on schedule, reschedule and feedback request', async () => {
    const iv: any = await h.svc.scheduleInterview('uA', schedule({ notifyWhatsApp: false }));
    assert.equal(iv.delivery.whatsapp, 'SKIPPED_BY_EMPLOYER');
    assert.deepEqual(iv.notify, { whatsapp: false, email: true });
    assert.equal(h.calls.enqueue.length, 0);

    const moved: any = await h.svc.updateInterviewStatus('uA', iv.id, 'reschedule', { scheduledAt: future(72), notes: 'New room' });
    assert.equal(moved.delivery.whatsapp, 'SKIPPED_BY_EMPLOYER');
    assert.equal(moved.notes, 'New room');
    assert.deepEqual(moved.notify, { whatsapp: false, email: true });
    assert.equal(h.calls.enqueue.length, 0);

    await h.svc.updateInterviewStatus('uA', iv.id, 'confirm');
    const fb: any = await h.svc.requestInterviewFeedback('uA', iv.id);
    assert.equal(fb.delivery.whatsapp, 'SKIPPED_BY_EMPLOYER');
    assert.equal(h.calls.sendText.length, 0);
  });
  it('employer reschedule queues a "reschedule" invitation and its email carries no old meeting link', async () => {
    const h2 = harness({ smtp: true });
    h2.db.applications.find((a) => a.id === 'APP1')!.status = 'SHORTLISTED';
    const iv: any = await h2.svc.scheduleInterview('uA', schedule({ location: 'https://meet.google.com/old-link' }));
    assert.deepEqual(h2.calls.enqueueKinds, ['initial']);
    await h2.svc.updateInterviewStatus('uA', iv.id, 'reschedule', { scheduledAt: future(72) });
    assert.deepEqual(h2.calls.enqueueKinds, ['initial', 'reschedule']);
    const mail = h2.calls.rescheduleEmails.at(-1)!;
    assert.equal(mail.meetingUrl, null);
    assert.match(String(mail.portalUrl), new RegExp(`/interviews/scheduled/${iv.id}$`));
    assert.doesNotMatch(JSON.stringify(mail), /old-link/);
  });
  it('employer reschedule writes one INTERVIEW_RESCHEDULED audit row without sensitive data', async () => {
    const h2 = h;
    const iv: any = await h2.svc.scheduleInterview('uA', schedule({ location: 'https://meet.google.com/old-link' }));
    await h2.svc.updateInterviewStatus('uA', iv.id, 'confirm');
    await h2.svc.updateInterviewStatus('uA', iv.id, 'notes', { notes: 'bring id' });
    assert.equal(h2.calls.audits.length, 0, 'only reschedules are audited');
    const next = future(72);
    await h2.svc.updateInterviewStatus('uA', iv.id, 'reschedule', {
      scheduledAt: next,
      meetingUrl: 'https://meet.google.com/new-link',
    });
    assert.equal(h2.calls.audits.length, 1);
    const audit = h2.calls.audits[0];
    assert.equal(audit.action, 'INTERVIEW_RESCHEDULED');
    assert.equal(audit.resourceType, 'INTERVIEW');
    assert.equal(audit.resourceId, iv.id);
    assert.equal(audit.userId, 'uA');
    const oldValue = JSON.parse(audit.oldValue);
    const newValue = JSON.parse(audit.newValue);
    assert.equal(oldValue.status, 'CONFIRMED');
    assert.equal(newValue.status, 'SCHEDULED');
    assert.equal(newValue.scheduledAt, new Date(next).toISOString());
    assert.equal(newValue.applicationId, 'APP1');
    assert.equal(newValue.candidateId, CAND);
    assert.equal(newValue.meetingLinkChanged, true);
    assert.doesNotMatch(JSON.stringify(audit), /meet\.google|old-link|new-link|@|\+91/);
  });
  it('a failed reschedule audit write does not fail the reschedule', async () => {
    const h2 = h;
    h2.prisma.auditLog.create = async () => {
      throw new Error('db down');
    };
    const iv: any = await h2.svc.scheduleInterview('uA', schedule());
    const moved: any = await h2.svc.updateInterviewStatus('uA', iv.id, 'reschedule', { scheduledAt: future(72) });
    assert.equal(moved.status, 'SCHEDULED');
  });
  it('a rejected reschedule (past time) writes no audit row', async () => {
    const h2 = h;
    const iv: any = await h2.svc.scheduleInterview('uA', schedule());
    await assert.rejects(
      h2.svc.updateInterviewStatus('uA', iv.id, 'reschedule', { scheduledAt: new Date(Date.now() - 3_600_000).toISOString() }),
      (err) => httpStatus(err) === 400,
    );
    assert.equal(h2.calls.audits.length, 0);
  });
  it('reschedule may replace the meeting link; a non-URL link is rejected', async () => {
    const iv: any = await h.svc.scheduleInterview('uA', schedule({ location: 'https://meet.google.com/old-link' }));
    const moved: any = await h.svc.updateInterviewStatus('uA', iv.id, 'reschedule', {
      scheduledAt: future(72),
      meetingUrl: 'https://meet.google.com/new-link',
    });
    assert.equal(moved.meetingUrl, 'https://meet.google.com/new-link');
    assert.equal(moved.location, 'https://meet.google.com/new-link');
    await assert.rejects(
      h.svc.updateInterviewStatus('uA', iv.id, 'reschedule', { scheduledAt: future(96), meetingUrl: 'not a link' }),
      (err) => httpStatus(err) === 400,
    );
  });
  it('employer cannot "confirm" the old time while the candidate is rescheduling', async () => {
    const iv: any = await h.svc.scheduleInterview('uA', schedule());
    for (const status of ['RESCHEDULE_NEEDED', 'RESCHEDULE_REQUESTED']) {
      h.db.interviews.find((row) => row.id === iv.id)!.status = status;
      await assert.rejects(h.svc.updateInterviewStatus('uA', iv.id, 'confirm'), (err) => httpStatus(err) === 409);
    }
  });
  it('WhatsApp "on": reschedule queues the invitation; feedback reports real send result', async () => {
    const iv: any = await h.svc.scheduleInterview('uA', schedule());
    await h.svc.updateInterviewStatus('uA', iv.id, 'reschedule', { scheduledAt: future(72) });
    assert.equal(h.calls.enqueue.length, 2);
    await h.svc.updateInterviewStatus('uA', iv.id, 'confirm');
    const fb: any = await h.svc.requestInterviewFeedback('uA', iv.id);
    assert.equal(fb.delivery.whatsapp, 'FAILED');
    assert.equal(h.calls.sendText.length, 1);
  });
  it('rescheduling into an overlap with another interview → 409', async () => {
    const at = future(48);
    await h.svc.scheduleInterview('uA', schedule({ scheduledAt: at }));
    const later = new Date(new Date(at).getTime() + 2 * 3_600_000).toISOString();
    const second: any = await h.svc.scheduleInterview('uA', schedule({ applicationId: 'APP2', scheduledAt: later }));
    await assert.rejects(h.svc.updateInterviewStatus('uA', second.id, 'reschedule', { scheduledAt: at }), (err) => httpStatus(err) === 409);
  });
  it('another employer cannot touch the interview', async () => {
    const iv: any = await h.svc.scheduleInterview('uA', schedule());
    await assert.rejects(h.svc.updateInterviewStatus('uB', iv.id, 'cancel'), NotFoundException);
  });
  it('cancelling notifies the candidate in-app and reports the real email state', async () => {
    const iv: any = await h.svc.scheduleInterview('uA', schedule());
    const before = h.calls.notifications.length;
    const res: any = await h.svc.updateInterviewStatus('uA', iv.id, 'cancel', { notes: 'Role on hold' });
    assert.equal(res.status, 'CANCELLED');
    const note = h.calls.notifications.at(-1);
    assert.equal(h.calls.notifications.length, before + 1);
    assert.equal(note?.userId, 'cU');
    assert.equal(note?.title, 'Interview cancelled');
    assert.equal(res.delivery.inApp, 'CREATED');
    assert.equal(res.delivery.email, 'NOT_CONFIGURED');
    assert.equal(res.delivery.whatsapp, 'NOT_SUPPORTED');
  });
});

describe('Fix 12/13 — email and notification state is truthful', () => {
  it('email reported SENT only when SMTP is configured and accepted the message', async () => {
    const h = harness({ smtp: true });
    h.db.applications.find((a) => a.id === 'APP1')!.status = 'SHORTLISTED';
    const iv: any = await h.svc.scheduleInterview('uA', {
      applicationId: 'APP1',
      scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      location: 'https://meet.google.com/abc',
    });
    assert.equal(iv.delivery.email, 'SENT');
    assert.equal(h.calls.emails, 1);
  });
  it('email opt-out → SKIPPED_BY_EMPLOYER, not sent', async () => {
    const h = harness({ smtp: true });
    h.db.applications.find((a) => a.id === 'APP1')!.status = 'SHORTLISTED';
    const iv: any = await h.svc.scheduleInterview('uA', {
      applicationId: 'APP1',
      scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      location: 'https://meet.google.com/abc',
      notifyEmail: false,
    });
    assert.equal(iv.delivery.email, 'SKIPPED_BY_EMPLOYER');
    assert.equal(h.calls.emails, 0);
  });
});

describe('Fix 11 — WhatsApp guards (no Graph calls)', () => {
  it('opt-in required; never falls back to the login phone', () => {
    assert.equal(consentedWhatsAppNumber({ whatsappOptIn: false, whatsappNumber: '+919800000001' }), null);
    assert.equal(consentedWhatsAppNumber({ whatsappOptIn: true, whatsappNumber: null, user: { phone: '+919800000001' } } as any), null);
    assert.equal(consentedWhatsAppNumber({ whatsappOptIn: true, whatsappNumber: '12345' }), null);
    assert.equal(consentedWhatsAppNumber({ whatsappOptIn: true, whatsappNumber: '+919800000001' }), '+919800000001');
  });

  it('refuses to send to the business sender number (Meta #100) without calling Graph', async () => {
    const created: Row[] = [];
    const svc = new WhatsAppService(
      { get: (k: string) => ({ WHATSAPP_DISPLAY_PHONE: '+91 95137 91117', WHATSAPP_PHONE_NUMBER_ID: '1' } as Row)[k] } as any,
      { whatsAppMessage: { create: async ({ data }: Row) => (created.push(data), { id: 'm1' }), update: async () => ({}) } } as any,
    );
    let graphCalls = 0;
    (svc as any).graphPost = async () => {
      graphCalls += 1;
      return { ok: true, data: {} };
    };
    const res = await svc.sendText({ to: '9513791117', body: 'hi' });
    assert.equal(res.ok, false);
    assert.equal(graphCalls, 0);
    assert.equal(created[0]?.status, 'FAILED');
    assert.match(String(created[0]?.errorJson), /RECIPIENT_IS_BUSINESS_NUMBER/);
  });

  it('invitation worker honours the employer WhatsApp preference and closed interviews', async () => {
    const updates: Row[] = [];
    const make = (row: Row) =>
      new InterviewWhatsAppService(
        {
          employerInterview: {
            findUnique: async () => row,
            update: async ({ data }: Row) => updates.push(data),
          },
        } as any,
        { events: { push: () => undefined } } as any,
        { resolveNotifyPhone: () => assert.fail('must not resolve a phone') } as any,
        {} as any,
        { get: () => undefined } as any,
      );
    const reasonOf = (r: unknown) => (r as { reason?: string }).reason;
    const off = await make({ id: 'I', status: 'SCHEDULED', notes: withNotifyPrefs('x', { whatsapp: false, email: true }) }).sendInvitationNow('I');
    assert.equal(reasonOf(off), 'skipped_by_employer');
    assert.equal(updates.at(-1)?.whatsappStatus, 'SKIPPED_BY_EMPLOYER');
    const closed = await make({ id: 'I', status: 'CANCELLED', notes: null }).sendInvitationNow('I');
    assert.equal(reasonOf(closed), 'interview_closed');
    const confirmOff = await make({ id: 'I', status: 'CONFIRMED', notes: withNotifyPrefs(null, { whatsapp: false, email: true }) }).sendConfirmationNow('I');
    assert.equal(reasonOf(confirmOff), 'skipped_by_employer');
  });

  it('initial invitation is followed by the meeting link; a reschedule invitation never is', async () => {
    const texts: Row[] = [];
    const invites: Row[] = [];
    const row = {
      id: 'I',
      status: 'SCHEDULED',
      notes: null,
      location: 'https://meet.google.com/old-link',
      meetingUrl: 'https://meet.google.com/old-link',
      scheduledAt: new Date('2026-10-03T09:30:00.000Z'),
      durationMin: 30,
      timezone: 'Asia/Kolkata',
      candidateId: CAND,
      application: { candidate: { firstName: 'A' }, job: { title: 'Role' } },
    };
    const svc = new InterviewWhatsAppService(
      { employerInterview: { findUnique: async () => row, update: async () => row } } as any,
      {
        events: { push: () => undefined },
        sendInterviewInvitation: async (input: Row) => (invites.push(input), { ok: true }),
        sendText: async (input: Row) => (texts.push(input), { ok: true }),
      } as any,
      { resolveNotifyPhone: () => '+919800000001' } as any,
      {} as any,
      { get: () => undefined } as any,
    );
    await svc.sendInvitationNow('I', 'initial');
    assert.equal(invites.length, 1);
    assert.match(String(texts[0]?.body), /Meeting link: https:\/\/meet\.google\.com\/old-link/);
    await svc.sendInvitationNow('I', 'reschedule');
    assert.equal(invites.length, 2);
    assert.equal(texts.length, 1, 'reschedule must not resend the meeting link');
  });

  it('WhatsApp "Choose Another Time": RESCHEDULE_NEEDED once, CareerBridge link once, no slots; confirm is blocked meanwhile', async () => {
    const row: Row = {
      id: 'I',
      status: 'CONFIRMED',
      candidateId: CAND,
      candidateRescheduleRequestedAt: null,
      employer: { userId: 'uEmp' },
      application: {
        candidate: { id: CAND, userId: 'uCand', firstName: 'Asha', whatsappOptIn: true, whatsappNumber: '+919800000001' },
        job: { title: 'Role' },
      },
    };
    const outbound: Row[] = [];
    const notes: Row[] = [];
    const links: Row[] = [];
    const prisma = {
      employerInterview: {
        updateMany: async ({ where, data }: Row) => {
          if (row.id !== where.id || !where.status.in.includes(row.status)) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        },
        findUnique: async () => row,
        findUniqueOrThrow: async () => row,
      },
      whatsAppMessage: {
        findFirst: async ({ where }: Row) =>
          outbound.find((m) => m.interviewId === where.interviewId && m.messageType === where.messageType) ?? null,
      },
    };
    const whatsapp = {
      events: { push: () => undefined },
      parseInteractivePayload: (raw: string) => ({ action: raw.split(':')[0], interviewId: raw.split(':')[1], raw }),
      sendRescheduleRequestLink: async (input: Row) => {
        links.push(input);
        outbound.push({ interviewId: input.interviewId, messageType: 'interview_reschedule_link' });
        return { ok: true };
      },
      sendText: async () => ({ ok: true }),
      sendInterviewConfirmation: async () => assert.fail('must not confirm while rescheduling'),
    };
    const svc = new WhatsAppWebhookService(
      prisma as any,
      whatsapp as any,
      { get: (k: string) => (k === 'PUBLIC_WEB_URL' ? 'https://web.example' : undefined) } as any,
      {} as any,
      { create: async (n: Row) => notes.push(n) } as any,
    );
    const tap = (payload: string) => svc.applyInteractiveAction({ from: 'simulator', payload, skipOwnership: true });

    const first: any = await tap('RESCHEDULE:I');
    assert.equal(row.status, 'RESCHEDULE_NEEDED');
    assert.equal(first.link, 'sent');
    assert.equal(links[0].url, 'https://web.example/interviews/reschedule/I');
    assert.deepEqual(notes.map((n) => n.userId).sort(), ['uCand', 'uEmp']);

    const second: any = await tap('RESCHEDULE:I');
    assert.equal(second.link, 'already_sent');
    assert.equal(links.length, 1);
    assert.equal(notes.length, 2, 'no duplicate notifications');

    const legacySlot: any = await tap('SLOT:I');
    assert.equal(legacySlot.link, 'already_sent');
    assert.equal(row.status, 'RESCHEDULE_NEEDED', 'old slot buttons no longer book a time');

    const confirm: any = await tap('CONFIRM:I');
    assert.equal(confirm.reason, 'reschedule_pending');
    assert.equal(row.status, 'RESCHEDULE_NEEDED');
  });

  it('inbound action without a sender id is not treated as the candidate', async () => {
    const svc = new WhatsAppWebhookService(
      {
        employerInterview: {
          findUnique: async () => ({
            id: 'I',
            application: { candidate: { id: CAND, whatsappNumber: '+919800000001', user: { phone: null } } },
          }),
        },
      } as any,
      {} as any,
      { get: () => undefined } as any,
      {} as any,
    );
    const res = await (svc as any).assertCandidateOwnsInterview({ interviewId: 'I', from: 'unknown' });
    assert.deepEqual(res, { ok: false, reason: 'unauthorized_candidate' });
    const sim = await (svc as any).assertCandidateOwnsInterview({ interviewId: 'I', from: 'simulator' });
    assert.equal(sim.ok, true);
  });
});
