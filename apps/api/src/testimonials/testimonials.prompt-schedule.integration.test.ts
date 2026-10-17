/**
 * Optional Postgres-backed check that concurrent dashboard requests claim at most one feedback prompt per
 * user window. Skipped unless TESTIMONIALS_IT_DATABASE_URL points at a DISPOSABLE database that already has
 * every migration applied (prisma migrate deploy). It creates and deletes only its own users; never point it
 * at a shared DEV/UAT/PROD database. The target must be on a loopback host AND have a database name ending in
 * `_it` or `_test`; a Cloud SQL proxy tunnel is also loopback, so the host check alone is not enough.
 *
 * Run: $env:TESTIMONIALS_IT_DATABASE_URL='postgresql://...'; npm.cmd run test:testimonials:integration -w api
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { PrismaClient } from '../prisma/client';
import { FEEDBACK_PROMPT_INTERVAL_MS, TestimonialsService } from './testimonials.service';

const databaseUrl = process.env.TESTIMONIALS_IT_DATABASE_URL || '';
const CONCURRENT_REQUESTS = 12;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const DISPOSABLE_DATABASE_NAME = /_(it|test)$/i;

function assertDisposableTarget(url: string) {
  const target = new URL(url);
  const database = decodeURIComponent(target.pathname.replace(/^\//, ''));
  if (!LOOPBACK_HOSTS.has(target.hostname) || !DISPOSABLE_DATABASE_NAME.test(database)) {
    throw new Error(
      'TESTIMONIALS_IT_DATABASE_URL must name a disposable database (loopback host, name ending in _it or _test).',
    );
  }
}

describe('feedback prompt window claim on Postgres', { skip: !databaseUrl }, () => {
  let prisma: PrismaClient;
  const userIds: string[] = [];

  const notifications = { create: async () => undefined };

  async function createUser(userType: 'CANDIDATE' | 'EMPLOYER_ADMIN') {
    const id = randomUUID();
    await prisma.user.create({
      data: {
        id,
        externalAuthId: `it-feedback-${id}`,
        phone: `+9100${id.replace(/\D/g, '').slice(0, 8).padEnd(8, '0')}`,
        userType,
      },
    });
    userIds.push(id);
    return id;
  }

  /**
   * Fires CONCURRENT_REQUESTS prompt requests at once, each with its own distinct clock value, and returns
   * the claim time of every request that received a prompt. Any rejected request fails the test: losers must
   * get the normal null response, not an error.
   */
  async function raceForPrompt(userId: string, baseMs = Date.now()) {
    const attempts = Array.from({ length: CONCURRENT_REQUESTS }, (_, index) => {
      const service = new TestimonialsService(prisma as never, notifications as never);
      const claimAt = new Date(baseMs + index);
      service.now = () => claimAt;
      return service.getActivePrompt(userId).then((prompt) => ({ prompt, claimAt }));
    });
    const settled = await Promise.allSettled(attempts);
    const rejected = settled.filter((result) => result.status === 'rejected');
    assert.deepEqual(rejected, [], 'a losing request must return null, not throw');
    return settled
      .map((result) => (result as PromiseFulfilledResult<Awaited<(typeof attempts)[number]>>).value)
      .filter((result) => result.prompt !== null);
  }

  async function storedLastShownAt(userId: string) {
    const schedule = await prisma.testimonialPromptSchedule.findUnique({ where: { userId } });
    return schedule?.lastShownAt?.toISOString() ?? null;
  }

  before(async () => {
    assertDisposableTarget(databaseUrl);
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
  });

  after(async () => {
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma?.$disconnect();
  });

  it('lets exactly one of many concurrent first visits claim the prompt', async () => {
    const userId = await createUser('CANDIDATE');
    const winners = await raceForPrompt(userId);
    assert.equal(winners.length, 1);
    assert.equal(winners[0].prompt?.source, 'DASHBOARD_SOFT_PROMPT');
    assert.equal(await storedLastShownAt(userId), winners[0].claimAt.toISOString());
  });

  it('lets exactly one concurrent request claim an expired window', async () => {
    const userId = await createUser('EMPLOYER_ADMIN');
    const first = await raceForPrompt(userId);
    assert.equal(first.length, 1);
    assert.equal((await raceForPrompt(userId)).length, 0);
    assert.equal(await storedLastShownAt(userId), first[0].claimAt.toISOString());

    const expiredAt = new Date(Date.now() - FEEDBACK_PROMPT_INTERVAL_MS - 60_000);
    await prisma.testimonialPromptSchedule.update({ where: { userId }, data: { lastShownAt: expiredAt } });
    const winners = await raceForPrompt(userId);
    assert.equal(winners.length, 1);
    assert.equal(winners[0].prompt?.source, 'EMPLOYER_DASHBOARD_SOFT_PROMPT');
    assert.equal(await storedLastShownAt(userId), winners[0].claimAt.toISOString());
  });

  it('lets different users claim independently while racing at the same time', async () => {
    const candidateId = await createUser('CANDIDATE');
    const employerId = await createUser('EMPLOYER_ADMIN');
    const [candidateWinners, employerWinners] = await Promise.all([
      raceForPrompt(candidateId),
      raceForPrompt(employerId),
    ]);
    assert.equal(candidateWinners.length, 1);
    assert.equal(employerWinners.length, 1);
    assert.equal(candidateWinners[0].prompt?.audience, 'CANDIDATE');
    assert.equal(employerWinners[0].prompt?.audience, 'EMPLOYER');
    assert.equal(await storedLastShownAt(candidateId), candidateWinners[0].claimAt.toISOString());
    assert.equal(await storedLastShownAt(employerId), employerWinners[0].claimAt.toISOString());
  });
});
