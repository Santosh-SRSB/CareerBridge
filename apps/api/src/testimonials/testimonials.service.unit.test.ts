/**
 * Feedback prompt scheduling (one prompt per user per 360 hours) with an in-memory Prisma double and a
 * fixed clock. The double proves the service logic only; database-level atomicity of the window claim is
 * covered by testimonials.prompt-schedule.integration.test.ts against a disposable Postgres.
 * Run: npm.cmd run test:testimonials -w api
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import {
  FEEDBACK_PROMPT_INTERVAL_MS,
  TestimonialsService,
} from './testimonials.service';

const HOUR = 60 * 60 * 1000;
const T0 = Date.parse('2026-10-01T09:00:00.000Z');

const CANDIDATE_A = 'cand-a';
const CANDIDATE_B = 'cand-b';
const EMPLOYER_A = 'emp-a';
const RECRUITER_A = 'rec-a';
const ADMIN = 'admin-1';

type PromptRow = {
  id: string;
  userId: string;
  source: string;
  status: 'ELIGIBLE' | 'DISMISSED' | 'SUBMITTED';
  eligibleAt: Date;
  dismissedAt: Date | null;
  submittedAt: Date | null;
};

type ScheduleRow = { userId: string; lastShownAt: Date | null };

function uniqueViolation() {
  return Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
}

function makeDb() {
  const users = new Map<string, { id: string; userType: string; candidate: unknown; employer: unknown }>([
    [CANDIDATE_A, { id: CANDIDATE_A, userType: 'CANDIDATE', candidate: { firstName: 'Asha', lastName: 'K', careerInterests: null }, employer: null }],
    [CANDIDATE_B, { id: CANDIDATE_B, userType: 'CANDIDATE', candidate: { firstName: 'Ravi', lastName: null, careerInterests: null }, employer: null }],
    [EMPLOYER_A, { id: EMPLOYER_A, userType: 'EMPLOYER_ADMIN', candidate: null, employer: { contactName: 'Meera', companyName: 'Acme', designation: null } }],
    [RECRUITER_A, { id: RECRUITER_A, userType: 'EMPLOYER_RECRUITER', candidate: null, employer: { contactName: 'Vik', companyName: 'Acme', designation: null } }],
    [ADMIN, { id: ADMIN, userType: 'SUPER_ADMIN', candidate: null, employer: null }],
  ]);
  const schedules = new Map<string, ScheduleRow>();
  const prompts: PromptRow[] = [];
  const testimonials: Array<Record<string, unknown>> = [];
  let seq = 0;
  const findPrompt = (userId: string, source: string) =>
    prompts.find((row) => row.userId === userId && row.source === source);

  const prisma = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => users.get(where.id) ?? null,
      findMany: async () => [],
    },
    testimonialPromptSchedule: {
      findUnique: async ({ where }: { where: { userId: string } }) => {
        const row = schedules.get(where.userId);
        return row ? { ...row } : null;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { userId: string; OR: [{ lastShownAt: null }, { lastShownAt: { lte: Date } }] };
        data: { lastShownAt: Date };
      }) => {
        const row = schedules.get(where.userId);
        const cutoff = where.OR[1].lastShownAt.lte;
        if (!row || (row.lastShownAt && row.lastShownAt.getTime() > cutoff.getTime())) return { count: 0 };
        row.lastShownAt = data.lastShownAt;
        return { count: 1 };
      },
      create: async ({ data }: { data: ScheduleRow }) => {
        if (schedules.has(data.userId)) throw uniqueViolation();
        schedules.set(data.userId, { ...data });
        return { ...data };
      },
    },
    testimonialPrompt: {
      findUnique: async ({ where }: { where: { userId_source: { userId: string; source: string } } }) => {
        const row = findPrompt(where.userId_source.userId, where.userId_source.source);
        return row ? { ...row } : null;
      },
      findMany: async ({ where }: { where: { userId: string; status: string; source: { in: string[] } } }) =>
        prompts
          .filter(
            (row) =>
              row.userId === where.userId && row.status === where.status && where.source.in.includes(row.source),
          )
          .map((row) => ({ source: row.source })),
      create: async ({ data }: { data: Omit<PromptRow, 'id' | 'dismissedAt' | 'submittedAt'> }) => {
        if (findPrompt(data.userId, data.source)) throw uniqueViolation();
        const row: PromptRow = { id: `p${++seq}`, dismissedAt: null, submittedAt: null, ...data };
        prompts.push(row);
        return { ...row };
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { userId_source: { userId: string; source: string } };
        create: Partial<PromptRow> & { userId: string; source: string };
        update: Partial<PromptRow>;
      }) => {
        const existing = findPrompt(where.userId_source.userId, where.userId_source.source);
        if (existing) {
          Object.assign(existing, update);
          return { ...existing };
        }
        const row: PromptRow = {
          id: `p${++seq}`,
          status: 'ELIGIBLE',
          eligibleAt: new Date(T0),
          dismissedAt: null,
          submittedAt: null,
          ...create,
        };
        prompts.push(row);
        return { ...row };
      },
      updateMany: async ({ where, data }: { where: { id: string; status: string }; data: Partial<PromptRow> }) => {
        const row = prompts.find((item) => item.id === where.id && item.status === where.status);
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    testimonial: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `t${++seq}`, ...data };
        testimonials.push(row);
        return { ...row };
      },
    },
  };
  return { prisma, schedules, prompts, testimonials };
}

let db: ReturnType<typeof makeDb>;
let notifications: Array<{ userId: string; type: string; link: string }>;
let clock: number;
let service: TestimonialsService;

function setClock(ms: number) {
  clock = ms;
}

function promptRow(userId: string, source: string) {
  return db.prompts.find((row) => row.userId === userId && row.source === source);
}

function lastShown(userId: string) {
  return db.schedules.get(userId)?.lastShownAt?.toISOString() ?? null;
}

const validQuote = 'CareerBridge made my job search far more structured.';

beforeEach(() => {
  db = makeDb();
  notifications = [];
  clock = T0;
  const notificationsService = {
    create: async (input: { userId: string; type: string; link: string }) => {
      notifications.push(input);
      return input;
    },
  };
  service = new TestimonialsService(db.prisma as never, notificationsService as never);
  service.now = () => new Date(clock);
});

describe('first dashboard visit', () => {
  it('shows a candidate the generic dashboard prompt and records when it was shown', async () => {
    const prompt = await service.getActivePrompt(CANDIDATE_A);
    assert.equal(prompt?.source, 'DASHBOARD_SOFT_PROMPT');
    assert.equal(prompt?.audience, 'CANDIDATE');
    assert.ok(prompt?.title);
    assert.equal(lastShown(CANDIDATE_A), new Date(T0).toISOString());
    assert.equal(promptRow(CANDIDATE_A, 'DASHBOARD_SOFT_PROMPT')?.status, 'ELIGIBLE');
  });

  it('shows an employer the employer dashboard prompt with no job activity', async () => {
    const prompt = await service.getActivePrompt(EMPLOYER_A);
    assert.equal(prompt?.source, 'EMPLOYER_DASHBOARD_SOFT_PROMPT');
    assert.equal(prompt?.audience, 'EMPLOYER');
    assert.equal(lastShown(EMPLOYER_A), new Date(T0).toISOString());
  });

  it('treats employer recruiters as employers', async () => {
    const prompt = await service.getActivePrompt(RECRUITER_A);
    assert.equal(prompt?.source, 'EMPLOYER_DASHBOARD_SOFT_PROMPT');
    assert.equal(prompt?.audience, 'EMPLOYER');
  });

  it('claims a schedule row whose lastShownAt is null', async () => {
    db.schedules.set(CANDIDATE_A, { userId: CANDIDATE_A, lastShownAt: null });
    const prompt = await service.getActivePrompt(CANDIDATE_A);
    assert.equal(prompt?.source, 'DASHBOARD_SOFT_PROMPT');
    assert.equal(lastShown(CANDIDATE_A), new Date(T0).toISOString());
  });
});

describe('360-hour window', () => {
  beforeEach(async () => {
    assert.ok(await service.getActivePrompt(CANDIDATE_A));
  });

  it('returns no prompt on a refresh one minute later', async () => {
    setClock(T0 + 60_000);
    assert.equal(await service.getActivePrompt(CANDIDATE_A), null);
    assert.equal(lastShown(CANDIDATE_A), new Date(T0).toISOString());
  });

  it('returns no prompt at 14 days 23 hours', async () => {
    setClock(T0 + 14 * 24 * HOUR + 23 * HOUR);
    assert.equal(await service.getActivePrompt(CANDIDATE_A), null);
  });

  it('returns no prompt one millisecond before 360 hours', async () => {
    setClock(T0 + FEEDBACK_PROMPT_INTERVAL_MS - 1);
    assert.equal(await service.getActivePrompt(CANDIDATE_A), null);
  });

  it('prompts again at exactly 360 hours and starts the next window from that display', async () => {
    assert.equal(FEEDBACK_PROMPT_INTERVAL_MS, 360 * HOUR);
    const due = T0 + FEEDBACK_PROMPT_INTERVAL_MS;
    setClock(due);
    assert.equal((await service.getActivePrompt(CANDIDATE_A))?.source, 'DASHBOARD_SOFT_PROMPT');
    assert.equal(lastShown(CANDIDATE_A), new Date(due).toISOString());

    setClock(due + 60_000);
    assert.equal(await service.getActivePrompt(CANDIDATE_A), null);
    setClock(due + FEEDBACK_PROMPT_INTERVAL_MS);
    assert.ok(await service.getActivePrompt(CANDIDATE_A));
  });

  it('lets only one of two overlapping requests claim the window (service logic only)', async () => {
    const results = await Promise.all([
      service.getActivePrompt(CANDIDATE_B),
      service.getActivePrompt(CANDIDATE_B),
    ]);
    assert.equal(results.filter(Boolean).length, 1);
  });
});

describe('milestone sources share the same window', () => {
  it('does not let a milestone reached during the window show a prompt', async () => {
    assert.ok(await service.getActivePrompt(CANDIDATE_A));
    setClock(T0 + HOUR);
    await service.markEligible(CANDIDATE_A, 'AFTER_5_APPLICATIONS');
    assert.equal(promptRow(CANDIDATE_A, 'AFTER_5_APPLICATIONS')?.status, 'ELIGIBLE');
    assert.equal(await service.getActivePrompt(CANDIDATE_A), null);

    setClock(T0 + FEEDBACK_PROMPT_INTERVAL_MS);
    assert.equal((await service.getActivePrompt(CANDIDATE_A))?.source, 'AFTER_5_APPLICATIONS');
  });

  it('does not show a different eligible source after the current prompt is dismissed', async () => {
    await service.markEligible(CANDIDATE_A, 'PROFILE_80_COMPLETE');
    await service.markEligible(CANDIDATE_A, 'AFTER_FIRST_MOCK_INTERVIEW');
    await service.markEligible(CANDIDATE_A, 'AFTER_5_APPLICATIONS');

    const first = await service.getActivePrompt(CANDIDATE_A);
    assert.equal(first?.source, 'AFTER_5_APPLICATIONS');
    await service.dismissPrompt(CANDIDATE_A, 'AFTER_5_APPLICATIONS');
    assert.equal(promptRow(CANDIDATE_A, 'AFTER_5_APPLICATIONS')?.status, 'DISMISSED');

    for (const offset of [1_000, HOUR, 24 * HOUR, FEEDBACK_PROMPT_INTERVAL_MS - 1]) {
      setClock(T0 + offset);
      assert.equal(await service.getActivePrompt(CANDIDATE_A), null);
    }
  });

  it('picks milestones in documented priority order, one per window', async () => {
    await service.markEligible(EMPLOYER_A, 'FIRST_JOB_PUBLISHED');
    await service.markEligible(EMPLOYER_A, 'AFTER_SHORTLIST_OR_INTERVIEW');
    await service.markEligible(EMPLOYER_A, 'AFTER_HIRE_OR_SELECT');

    const seen: string[] = [];
    for (let cycle = 0; cycle < 4; cycle += 1) {
      setClock(T0 + cycle * FEEDBACK_PROMPT_INTERVAL_MS);
      const prompt = await service.getActivePrompt(EMPLOYER_A);
      assert.ok(prompt);
      seen.push(prompt.source);
      await service.dismissPrompt(EMPLOYER_A, prompt.source);
      setClock(T0 + cycle * FEEDBACK_PROMPT_INTERVAL_MS + HOUR);
      assert.equal(await service.getActivePrompt(EMPLOYER_A), null);
    }
    assert.deepEqual(seen, [
      'AFTER_HIRE_OR_SELECT',
      'AFTER_SHORTLIST_OR_INTERVIEW',
      'FIRST_JOB_PUBLISHED',
      'EMPLOYER_DASHBOARD_SOFT_PROMPT',
    ]);
  });

  it('shows an ignored prompt again in the next window instead of a lower-priority one', async () => {
    await service.markEligible(CANDIDATE_A, 'PROFILE_80_COMPLETE');
    await service.markEligible(CANDIDATE_A, 'AFTER_FIRST_MOCK_INTERVIEW');
    assert.equal((await service.getActivePrompt(CANDIDATE_A))?.source, 'AFTER_FIRST_MOCK_INTERVIEW');
    setClock(T0 + FEEDBACK_PROMPT_INTERVAL_MS);
    assert.equal((await service.getActivePrompt(CANDIDATE_A))?.source, 'AFTER_FIRST_MOCK_INTERVIEW');
  });

  it('never offers a source from the other audience', async () => {
    await service.markEligible(CANDIDATE_A, 'AFTER_HIRE_OR_SELECT');
    assert.equal((await service.getActivePrompt(CANDIDATE_A))?.source, 'DASHBOARD_SOFT_PROMPT');
  });
});

describe('repeated eligibility triggers', () => {
  it('notifies once when a milestone is first reached and not on repeats', async () => {
    await service.markEligible(CANDIDATE_A, 'AFTER_5_APPLICATIONS');
    await service.markEligible(CANDIDATE_A, 'AFTER_5_APPLICATIONS');
    await service.markEligible(CANDIDATE_A, 'AFTER_5_APPLICATIONS');
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].type, 'TESTIMONIAL_PROMPT');
    assert.equal(notifications[0].link, '/feedback?source=AFTER_5_APPLICATIONS');
  });

  it('still notifies when a milestone is first reached inside the window', async () => {
    assert.ok(await service.getActivePrompt(EMPLOYER_A));
    setClock(T0 + HOUR);
    await service.markEligible(EMPLOYER_A, 'FIRST_JOB_PUBLISHED');
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].link, '/feedback?source=FIRST_JOB_PUBLISHED');
    assert.equal(await service.getActivePrompt(EMPLOYER_A), null);
  });

  it('notifies once when two triggers race to create the same milestone', async () => {
    await Promise.all([
      service.markEligible(EMPLOYER_A, 'FIRST_JOB_PUBLISHED'),
      service.markEligible(EMPLOYER_A, 'FIRST_JOB_PUBLISHED'),
    ]);
    assert.equal(db.prompts.filter((row) => row.source === 'FIRST_JOB_PUBLISHED').length, 1);
    assert.equal(notifications.length, 1);
  });

  it('respects notifyUser = false', async () => {
    await service.markEligible(CANDIDATE_A, 'PROFILE_80_COMPLETE', false);
    assert.equal(promptRow(CANDIDATE_A, 'PROFILE_80_COMPLETE')?.status, 'ELIGIBLE');
    assert.equal(notifications.length, 0);
  });

  it('does not re-arm a dismissed milestone or notify inside the window', async () => {
    await service.markEligible(EMPLOYER_A, 'AFTER_SHORTLIST_OR_INTERVIEW');
    assert.equal((await service.getActivePrompt(EMPLOYER_A))?.source, 'AFTER_SHORTLIST_OR_INTERVIEW');
    await service.dismissPrompt(EMPLOYER_A, 'AFTER_SHORTLIST_OR_INTERVIEW');
    const notified = notifications.length;

    for (const offset of [HOUR, 48 * HOUR, FEEDBACK_PROMPT_INTERVAL_MS - 1]) {
      setClock(T0 + offset);
      await service.markEligible(EMPLOYER_A, 'AFTER_SHORTLIST_OR_INTERVIEW');
      assert.equal(promptRow(EMPLOYER_A, 'AFTER_SHORTLIST_OR_INTERVIEW')?.status, 'DISMISSED');
      assert.equal(await service.getActivePrompt(EMPLOYER_A), null);
    }
    assert.equal(notifications.length, notified);
  });

  it('re-arms a dismissed milestone once after the window, with one notification', async () => {
    await service.markEligible(EMPLOYER_A, 'AFTER_SHORTLIST_OR_INTERVIEW');
    await service.getActivePrompt(EMPLOYER_A);
    await service.dismissPrompt(EMPLOYER_A, 'AFTER_SHORTLIST_OR_INTERVIEW');
    const notified = notifications.length;

    setClock(T0 + FEEDBACK_PROMPT_INTERVAL_MS + HOUR);
    await service.markEligible(EMPLOYER_A, 'AFTER_SHORTLIST_OR_INTERVIEW');
    await service.markEligible(EMPLOYER_A, 'AFTER_SHORTLIST_OR_INTERVIEW');
    assert.equal(promptRow(EMPLOYER_A, 'AFTER_SHORTLIST_OR_INTERVIEW')?.status, 'ELIGIBLE');
    assert.equal(notifications.length, notified + 1);
    assert.equal((await service.getActivePrompt(EMPLOYER_A))?.source, 'AFTER_SHORTLIST_OR_INTERVIEW');
  });

  it('never re-arms a submitted milestone, even after the window', async () => {
    await service.markEligible(CANDIDATE_A, 'AFTER_5_APPLICATIONS');
    await service.getActivePrompt(CANDIDATE_A);
    await service.submit(CANDIDATE_A, { rating: 5, quote: validQuote, source: 'AFTER_5_APPLICATIONS' });
    const notified = notifications.length;

    setClock(T0 + 3 * FEEDBACK_PROMPT_INTERVAL_MS);
    await service.markEligible(CANDIDATE_A, 'AFTER_5_APPLICATIONS');
    assert.equal(promptRow(CANDIDATE_A, 'AFTER_5_APPLICATIONS')?.status, 'SUBMITTED');
    assert.equal(notifications.length, notified);
    assert.equal((await service.getActivePrompt(CANDIDATE_A))?.source, 'DASHBOARD_SOFT_PROMPT');
  });
});

describe('dismissal and submission', () => {
  it('Not now keeps the prompt hidden until the window ends', async () => {
    const prompt = await service.getActivePrompt(CANDIDATE_A);
    assert.ok(prompt);
    setClock(T0 + 5_000);
    assert.deepEqual(await service.dismissPrompt(CANDIDATE_A, prompt.source), { dismissed: true });
    assert.equal(promptRow(CANDIDATE_A, 'DASHBOARD_SOFT_PROMPT')?.status, 'DISMISSED');
    assert.equal(lastShown(CANDIDATE_A), new Date(T0).toISOString());

    setClock(T0 + 10 * 24 * HOUR);
    assert.equal(await service.getActivePrompt(CANDIDATE_A), null);
    setClock(T0 + FEEDBACK_PROMPT_INTERVAL_MS);
    assert.equal((await service.getActivePrompt(CANDIDATE_A))?.source, 'DASHBOARD_SOFT_PROMPT');
  });

  it('measures the window from the display, not from a later dismissal', async () => {
    await service.getActivePrompt(CANDIDATE_A);
    setClock(T0 + 100 * HOUR);
    await service.dismissPrompt(CANDIDATE_A, 'DASHBOARD_SOFT_PROMPT');
    setClock(T0 + FEEDBACK_PROMPT_INTERVAL_MS);
    assert.ok(await service.getActivePrompt(CANDIDATE_A));
  });

  it('saves a submission and still prompts again after the window', async () => {
    const prompt = await service.getActivePrompt(EMPLOYER_A);
    assert.ok(prompt);
    setClock(T0 + 30_000);
    const result = await service.submit(EMPLOYER_A, { rating: 4, quote: validQuote, source: prompt.source });
    assert.equal(result.status, 'PENDING');
    assert.equal(result.message, 'Thanks! Your feedback was sent for admin review.');
    assert.equal(db.testimonials.length, 1);
    assert.equal(db.testimonials[0].audience, 'EMPLOYER');
    assert.equal(db.testimonials[0].source, 'EMPLOYER_DASHBOARD_SOFT_PROMPT');
    assert.equal(promptRow(EMPLOYER_A, 'EMPLOYER_DASHBOARD_SOFT_PROMPT')?.status, 'SUBMITTED');

    setClock(T0 + HOUR);
    assert.equal(await service.getActivePrompt(EMPLOYER_A), null);
    setClock(T0 + FEEDBACK_PROMPT_INTERVAL_MS);
    assert.equal((await service.getActivePrompt(EMPLOYER_A))?.source, 'EMPLOYER_DASHBOARD_SOFT_PROMPT');
  });

  it('keeps earlier submissions untouched across later prompt cycles', async () => {
    await service.getActivePrompt(CANDIDATE_A);
    await service.submit(CANDIDATE_A, { rating: 5, quote: validQuote, source: 'DASHBOARD_SOFT_PROMPT' });
    const before = JSON.stringify(db.testimonials);

    for (let cycle = 1; cycle <= 3; cycle += 1) {
      setClock(T0 + cycle * FEEDBACK_PROMPT_INTERVAL_MS);
      const prompt = await service.getActivePrompt(CANDIDATE_A);
      assert.ok(prompt);
      await service.dismissPrompt(CANDIDATE_A, prompt.source);
    }
    assert.equal(JSON.stringify(db.testimonials), before);
    assert.equal(db.prompts.filter((row) => row.userId === CANDIDATE_A).length, 1);
  });

  it('rejects an employer submitting with a candidate-only source', async () => {
    await assert.rejects(
      service.submit(EMPLOYER_A, { rating: 5, quote: validQuote, source: 'AFTER_5_APPLICATIONS' }),
      /not available for your account type/,
    );
    assert.equal(db.testimonials.length, 0);
  });
});

describe('isolation between accounts', () => {
  it('keeps candidate and employer schedules independent', async () => {
    assert.ok(await service.getActivePrompt(CANDIDATE_A));
    setClock(T0 + HOUR);
    assert.equal((await service.getActivePrompt(EMPLOYER_A))?.source, 'EMPLOYER_DASHBOARD_SOFT_PROMPT');
    assert.equal(await service.getActivePrompt(CANDIDATE_A), null);
    assert.equal(await service.getActivePrompt(EMPLOYER_A), null);
    assert.equal(lastShown(CANDIDATE_A), new Date(T0).toISOString());
    assert.equal(lastShown(EMPLOYER_A), new Date(T0 + HOUR).toISOString());
  });

  it('keeps users of the same role independent', async () => {
    assert.ok(await service.getActivePrompt(CANDIDATE_A));
    await service.dismissPrompt(CANDIDATE_A, 'DASHBOARD_SOFT_PROMPT');
    await service.markEligible(CANDIDATE_A, 'AFTER_5_APPLICATIONS');

    assert.equal((await service.getActivePrompt(CANDIDATE_B))?.source, 'DASHBOARD_SOFT_PROMPT');
    assert.equal(promptRow(CANDIDATE_B, 'AFTER_5_APPLICATIONS'), undefined);
    assert.equal(promptRow(CANDIDATE_A, 'DASHBOARD_SOFT_PROMPT')?.status, 'DISMISSED');
  });

  it('keeps employer accounts of the same company independent', async () => {
    assert.ok(await service.getActivePrompt(EMPLOYER_A));
    assert.ok(await service.getActivePrompt(RECRUITER_A));
  });
});

describe('missing or invalid data', () => {
  it('returns no prompt and writes nothing for an unknown user', async () => {
    assert.equal(await service.getActivePrompt('missing-user'), null);
    assert.equal(db.schedules.size, 0);
    assert.equal(db.prompts.length, 0);
  });

  it('returns no prompt for platform admins', async () => {
    assert.equal(await service.getActivePrompt(ADMIN), null);
    assert.equal(db.schedules.size, 0);
  });

  it('rejects dismissing an unknown source without writing', async () => {
    await assert.rejects(service.dismissPrompt(CANDIDATE_A, 'NOT_A_SOURCE' as never), BadRequestException);
    assert.equal(db.prompts.length, 0);
  });

  it('rejects submitting with an unknown source without saving', async () => {
    await assert.rejects(
      service.submit(CANDIDATE_A, { rating: 5, quote: validQuote, source: 'NOT_A_SOURCE' as never }),
      BadRequestException,
    );
    assert.equal(db.testimonials.length, 0);
  });

  it('still defaults a submission without a source to MANUAL', async () => {
    await service.submit(CANDIDATE_A, { rating: 3, quote: validQuote });
    assert.equal(db.testimonials[0].source, 'MANUAL');
  });
});
