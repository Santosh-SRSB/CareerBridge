import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ResumesService } from './resumes.service';

type GatewayStub = {
  isConfigured: () => boolean;
  improveResumeSummaryWithStatus: (...args: unknown[]) => Promise<{
    data: { improvedSummary: string } | null;
    unavailableReason?: string;
  }>;
};

function build(gateway: GatewayStub) {
  const calls: unknown[][] = [];
  const wrapped = {
    ...gateway,
    improveResumeSummaryWithStatus: async (...args: unknown[]) => {
      calls.push(args);
      return gateway.improveResumeSummaryWithStatus(...args);
    },
  };
  const service = new ResumesService(
    {} as never,
    {} as never,
    {} as never,
    wrapped as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, calls };
}

describe('ResumesService.improveSummary', () => {
  it('returns the AI suggestion without saving anything', async () => {
    const { service, calls } = build({
      isConfigured: () => true,
      improveResumeSummaryWithStatus: async () => ({
        data: { improvedSummary: '  Customer support associate with strong Malayalam and English communication.  ' },
      }),
    });
    const result = await service.improveSummary('user-1', { summary: 'i am good in talking', targetRole: 'Customer Support' });
    assert.deepEqual(result, {
      aiAvailable: true,
      improvedSummary: 'Customer support associate with strong Malayalam and English communication.',
    });
    assert.equal(calls.length, 1);
    assert.equal((calls[0][1] as { userId: string }).userId, 'user-1');
  });

  it('reports NOT_CONFIGURED instead of inventing a summary when Gemini is not set up', async () => {
    const { service, calls } = build({
      isConfigured: () => false,
      improveResumeSummaryWithStatus: async () => ({ data: { improvedSummary: 'should not be used' } }),
    });
    const result = await service.improveSummary('user-1', { summary: 'draft' });
    assert.deepEqual(result, { aiAvailable: false, aiUnavailableReason: 'NOT_CONFIGURED' });
    assert.equal(calls.length, 0);
  });

  it('passes through quota and upstream reasons from the gateway', async () => {
    const { service } = build({
      isConfigured: () => true,
      improveResumeSummaryWithStatus: async () => ({ data: null, unavailableReason: 'DAILY_REQUEST_LIMIT' }),
    });
    assert.deepEqual(await service.improveSummary('user-1', { summary: 'draft' }), {
      aiAvailable: false,
      aiUnavailableReason: 'DAILY_REQUEST_LIMIT',
    });
  });

  it('rejects an over-long AI answer that cannot end on a full sentence', async () => {
    const { service } = build({
      isConfigured: () => true,
      improveResumeSummaryWithStatus: async () => ({ data: { improvedSummary: 'word '.repeat(200) } }),
    });
    assert.deepEqual(await service.improveSummary('user-1', { summary: 'draft' }), {
      aiAvailable: false,
      aiUnavailableReason: 'FAILED',
    });
  });

  it('Try again sends the earlier suggestions to the AI and returns a different wording', async () => {
    const { service, calls } = build({
      isConfigured: () => true,
      improveResumeSummaryWithStatus: async () => ({ data: { improvedSummary: 'Bilingual support associate who resolves customer queries.' } }),
    });
    const result = await service.improveSummary('user-1', { summary: 'draft', avoid: ['Customer support associate with strong communication.'] });
    assert.deepEqual(result, { aiAvailable: true, improvedSummary: 'Bilingual support associate who resolves customer queries.' });
    assert.deepEqual((calls[0][0] as { avoidSuggestions: string[] }).avoidSuggestions, ['Customer support associate with strong communication.']);
  });

  it('Try again does not present a repeated suggestion as new', async () => {
    const { service } = build({
      isConfigured: () => true,
      improveResumeSummaryWithStatus: async () => ({ data: { improvedSummary: 'Customer support associate with strong communication.' } }),
    });
    assert.deepEqual(await service.improveSummary('user-1', { summary: 'draft', avoid: ['customer support associate with strong communication'] }), {
      aiAvailable: false,
      aiUnavailableReason: 'FAILED',
    });
  });

  it('requires a draft or profile facts', async () => {
    const { service, calls } = build({
      isConfigured: () => true,
      improveResumeSummaryWithStatus: async () => ({ data: null }),
    });
    await assert.rejects(() => service.improveSummary('user-1', { summary: '   ' }), /draft summary/);
    assert.equal(calls.length, 0);
  });
});

describe('ResumesService.improveExperience', () => {
  function buildExperience(gateway: {
    isConfigured: () => boolean;
    improveExperienceBulletsWithStatus: (...args: unknown[]) => Promise<{
      data: { improvedBullets: string[] } | null;
      unavailableReason?: string;
    }>;
  }) {
    const calls: unknown[][] = [];
    const wrapped = {
      ...gateway,
      improveExperienceBulletsWithStatus: async (...args: unknown[]) => {
        calls.push(args);
        return gateway.improveExperienceBulletsWithStatus(...args);
      },
    };
    const service = new ResumesService(
      {} as never,
      {} as never,
      {} as never,
      wrapped as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, calls };
  }

  it('returns suggested bullets for the entry without saving anything', async () => {
    const { service, calls } = buildExperience({
      isConfigured: () => true,
      improveExperienceBulletsWithStatus: async () => ({
        data: { improvedBullets: ['Resolved customer billing queries by phone and email.'] },
      }),
    });
    const result = await service.improveExperience('user-1', {
      role: 'Customer Support Associate',
      company: 'Acme',
      bullets: ['  answered calls ', ''],
    });
    assert.deepEqual(result, {
      aiAvailable: true,
      improvedBullets: ['Resolved customer billing queries by phone and email.'],
    });
    const [input, options] = calls[0] as [{ bullets: string[] }, { userId: string }];
    assert.deepEqual(input.bullets, ['answered calls']);
    assert.equal(options.userId, 'user-1');
  });

  it('reports NOT_CONFIGURED without calling Gemini', async () => {
    const { service, calls } = buildExperience({
      isConfigured: () => false,
      improveExperienceBulletsWithStatus: async () => ({ data: { improvedBullets: ['unused'] } }),
    });
    assert.deepEqual(await service.improveExperience('user-1', { role: 'Clerk' }), {
      aiAvailable: false,
      aiUnavailableReason: 'NOT_CONFIGURED',
    });
    assert.equal(calls.length, 0);
  });

  it('passes through quota reasons from the gateway', async () => {
    const { service } = buildExperience({
      isConfigured: () => true,
      improveExperienceBulletsWithStatus: async () => ({ data: null, unavailableReason: 'DAILY_REQUEST_LIMIT' }),
    });
    assert.deepEqual(await service.improveExperience('user-1', { role: 'Clerk', bullets: ['filed papers'] }), {
      aiAvailable: false,
      aiUnavailableReason: 'DAILY_REQUEST_LIMIT',
    });
  });

  it('Try again passes earlier bullets and rejects an identical answer', async () => {
    const prev = ['Resolved customer billing queries by phone and email.'];
    const { service, calls } = buildExperience({
      isConfigured: () => true,
      improveExperienceBulletsWithStatus: async () => ({ data: { improvedBullets: [...prev] } }),
    });
    assert.deepEqual(await service.improveExperience('user-1', { role: 'Clerk', bullets: ['answered calls'], avoid: [prev.join('\n')] }), {
      aiAvailable: false,
      aiUnavailableReason: 'FAILED',
    });
    assert.deepEqual((calls[0][0] as { avoidSuggestions: string[] }).avoidSuggestions, [prev.join('\n')]);
  });

  it('requires a job title', async () => {
    const { service, calls } = buildExperience({
      isConfigured: () => true,
      improveExperienceBulletsWithStatus: async () => ({ data: null }),
    });
    await assert.rejects(() => service.improveExperience('user-1', { role: '  ' }), /job title/);
    assert.equal(calls.length, 0);
  });
});
