import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ResumeContent } from '@careerbridge/shared';
import { CHUNKING_POLICY, estimateTokens } from './chunking-policy';
import { chunkResumeContent, splitFixed } from './resume-chunking';

function words(count: number, label = 'word') {
  return Array.from({ length: count }, (_, index) => `${label}${index}`).join(' ');
}

function base(partial: Partial<ResumeContent> = {}): ResumeContent {
  return {
    fullName: 'Asha',
    city: 'Pune',
    phone: null,
    summary: '',
    skills: [],
    education: [],
    experiences: [],
    languages: [],
    ...partial,
  };
}

describe('resume chunking v1', () => {
  it('keeps a short section as one chunk under the semantic max', () => {
    const chunks = chunkResumeContent(base({ summary: 'Backend engineer who builds APIs.' }));
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].section, 'Summary');
    assert.ok(chunks[0].tokenCount <= CHUNKING_POLICY.semanticMaxTokens);
    assert.equal(chunks[0].chunkIndex, 0);
  });

  it('keeps a coherent role together when the experience section is under 600 tokens', () => {
    const description = words(80, 'duty');
    assert.ok(estimateTokens(description) < 600);
    const chunks = chunkResumeContent(
      base({
        experiences: [
          { company: 'ABC Technologies', jobTitle: 'Software Engineer', description, isInternship: false },
        ],
      }),
    );
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].section, 'Experience');
    assert.match(chunks[0].content, /ABC Technologies/);
    assert.match(chunks[0].content, /duty79/);
  });

  it('splits experience by role when the section exceeds 600 tokens', () => {
    const description = words(400, 'task');
    const chunks = chunkResumeContent(
      base({
        experiences: [
          { company: 'ABC Technologies', jobTitle: 'Software Engineer', description, isInternship: false },
          { company: 'XYZ Solutions', jobTitle: 'Full Stack Developer', description: words(400, 'build'), isInternship: false },
        ],
      }),
    );
    assert.ok(chunks.length >= 2);
    assert.ok(chunks.some((chunk) => chunk.metadata.companyName === 'ABC Technologies'));
    assert.ok(chunks.some((chunk) => chunk.metadata.companyName === 'XYZ Solutions'));
    assert.ok(chunks.every((chunk) => chunk.tokenCount <= CHUNKING_POLICY.semanticMaxTokens));
  });

  it('uses fixed overlap when one role is still over 600 tokens and keeps the tail', () => {
    const description = words(1200, 'detail');
    const chunks = chunkResumeContent(
      base({
        experiences: [
          { company: 'ABC Technologies', jobTitle: 'Software Engineer', description, isInternship: false },
        ],
      }),
    );
    assert.ok(chunks.length >= 2);
    assert.ok(chunks.every((chunk) => chunk.tokenCount <= CHUNKING_POLICY.semanticMaxTokens));
    const joined = chunks.map((chunk) => chunk.content).join(' ');
    assert.match(joined, /detail0/);
    assert.match(joined, /detail1199/);
    const parts = splitFixed(description);
    assert.ok(parts.length >= 2);
    const overlapProbe = parts[0].split(/\s+/).slice(-5);
    assert.ok(overlapProbe.some((word) => parts[1].includes(word)));
  });

  it('omits empty sections and still indexes the rest', () => {
    const chunks = chunkResumeContent(
      base({
        summary: '   ',
        skills: ['NestJS', 'PostgreSQL'],
        experiences: [],
      }),
    );
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].section, 'Skills');
    assert.match(chunks[0].content, /NestJS/);
  });

  it('assigns deterministic chunk indexes', () => {
    const content = base({
      summary: 'Summary line',
      skills: ['SQL'],
      education: [{ qualification: 'B.Tech', institution: 'SPPU', yearCompleted: 2022 }],
    });
    const first = chunkResumeContent(content).map((chunk) => chunk.chunkIndex);
    const second = chunkResumeContent(content).map((chunk) => chunk.chunkIndex);
    assert.deepEqual(first, second);
    assert.deepEqual(first, first.map((_, index) => index));
  });
});
