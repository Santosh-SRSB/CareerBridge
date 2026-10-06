import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConflictException } from '@nestjs/common';
import type { LiveInterviewQuestion } from '@careerbridge/shared';
import {
  InterviewAiService,
  emergencyProfileQuestion,
  normalizeQuestionText,
  scoreClarity,
  scoreRelevance,
  zeroAnswerReport,
  type InterviewProfile,
} from './interview-ai.service';
import { localAnalyzeCategoryAware, questionLead, questionTypeFromCategory } from './interview-evaluation.util';
import { InterviewsService } from './interviews.service';

const profile: InterviewProfile = {
  fullName: 'Test Candidate',
  skills: ['Python', 'SQL', 'Excel'],
  education: ['B.Sc Computer Science · Test College'],
  experiences: ['Project: Inventory Tracker — built a stock dashboard', 'Support Intern — Acme — handled tickets'],
  summary: 'Entry-level analyst.',
  jobRole: 'Data Analyst',
  focusStacks: [],
  experienceYears: 0,
};

const integrity = { tabSwitches: 0, faceMissing: 0, multipleFaces: 0, micIssues: 0, abuseWarnings: 0, nonsenseWarnings: 0 };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* ---------------- fallback questions ---------------- */

test('fallback questions never repeat, even after every template is used', () => {
  for (const kind of ['MIXED', 'TECHNICAL', 'HR', 'SITUATIONAL', 'RESUME']) {
    const asked: string[] = [];
    for (let i = 0; i < 40; i += 1) {
      const next = emergencyProfileQuestion(profile, kind, asked);
      assert.ok(next.text.length > 12);
      assert.ok(
        !asked.some((item) => normalizeQuestionText(item) === normalizeQuestionText(next.text)),
        `${kind}: question ${i + 1} repeated: ${next.text}`,
      );
      asked.push(next.text);
    }
  }
});

test('fallback treats punctuation/case variants of an asked question as already asked', () => {
  const first = emergencyProfileQuestion(profile, 'MIXED', []);
  const variant = `  ${first.text.toUpperCase().replace(/\?$/, '')}  `;
  const next = emergencyProfileQuestion(profile, 'MIXED', [variant]);
  assert.notEqual(normalizeQuestionText(next.text), normalizeQuestionText(first.text));
});

test('question generation without AI uses the non-repeating fallback (no quota)', async () => {
  let calls = 0;
  const gateway = { isConfigured: () => false, generate: async () => { calls += 1; return { data: null }; } };
  const ai = new InterviewAiService(gateway as never, {} as never);
  const asked: string[] = [];
  for (let i = 0; i < 25; i += 1) {
    const next = await ai.nextQuestion(profile, 'MIXED', 'Beginner', asked);
    assert.ok(!asked.includes(next.text));
    asked.push(next.text);
  }
  assert.equal(calls, 0);
});

/* ---------------- zero-answer report ---------------- */

test('zero-answer report makes no AI call and has no artificial minimum scores', async () => {
  let calls = 0;
  const gateway = {
    isConfigured: () => true,
    generate: async () => {
      calls += 1;
      return { data: { summary: 'should not be used' } };
    },
  };
  const ai = new InterviewAiService(gateway as never, {} as never);
  const unanswered: LiveInterviewQuestion[] = [
    { id: 'q1', number: 1, text: 'Tell me about yourself.', category: 'INTRO', difficulty: 'Beginner', askedAt: new Date().toISOString() },
  ];
  const report = await ai.report(profile, unanswered, 60, integrity, 5);
  assert.equal(calls, 0);
  assert.equal(report.overallScore, 0);
  assert.equal(report.communication, 0);
  assert.equal(report.behaviour, 0);
  assert.equal(report.listening, 0);
  assert.equal(report.roleReadiness, 0);
  assert.equal(report.relevance, 0);
  assert.equal(report.clarity, 0);
  assert.equal(report.technicalKnowledge, null);
  assert.equal(report.problemSolving, null);
  assert.equal(report.answeredCount, 0);
  assert.equal(report.totalPlanned, 5);
  assert.deepEqual(report.strengths, []);
  assert.equal(report.recommendation, 'Not Recommended');
  assert.match(report.summary, /No answers were submitted out of 5/);
});

test('zero-answer report stays deterministic and reflects integrity warnings', () => {
  const a = zeroAnswerReport(profile, { ...integrity, abuseWarnings: 1 }, 7);
  const b = zeroAnswerReport(profile, { ...integrity, abuseWarnings: 1 }, 7);
  assert.deepEqual(a, b);
  assert.equal(a.recommendation, 'Not Ready');
  assert.equal(a.overallScore, 0);
});

/* ---------------- category-aware fallback wording ---------------- */

test('stored question category drives the fallback wording', () => {
  assert.equal(questionTypeFromCategory('SCENARIO'), 'SITUATIONAL');
  assert.equal(questionTypeFromCategory('BEHAVIOURAL'), 'BEHAVIOURAL');
  assert.equal(questionTypeFromCategory('EDUCATION'), 'EDUCATION');
  assert.equal(questionTypeFromCategory('RESUME'), 'EXPERIENCE');
  assert.equal(questionTypeFromCategory('SKILLS'), 'TECHNICAL');
  assert.equal(questionTypeFromCategory('MIXED'), null);
  assert.equal(questionLead('SITUATIONAL'), 'For this scenario-based question');
  assert.equal(questionLead('GENERAL'), 'For this question');

  const answer = 'I would first talk to the customer and understand the issue, then fix it.';
  const scenario = localAnalyzeCategoryAware(
    'Your dashboard shows wrong numbers before a meeting. What do you do?',
    answer,
    profile,
    questionTypeFromCategory('SCENARIO'),
  );
  assert.match(scenario.analysis, /^For this scenario-based question/);
  assert.doesNotMatch(scenario.analysis, /general question/);
});

test('analyzeAnswer without AI uses the stored category for its wording (no quota)', async () => {
  const gateway = { isConfigured: () => false };
  const ai = new InterviewAiService(gateway as never, {} as never);
  const result = await ai.analyzeAnswer(profile, 'What would you do if two deadlines clashed?', 'I would ask my lead which one matters more.', {
    category: 'SCENARIO',
  });
  assert.match(result.analysis, /scenario-based question/);
});

/* ---------------- concurrency ---------------- */

type Row = Record<string, unknown> & { id: string; questionsJson: string };

function harness(options: { questionLimit?: number; aiDelayMs?: number } = {}) {
  const now = new Date();
  const row: Row = {
    id: 'iv-1',
    candidateId: 'cand-a',
    jobRole: 'Data Analyst',
    interviewType: 'MIXED',
    status: 'IN_PROGRESS',
    questionIndex: 0,
    questionsJson: JSON.stringify([
      { id: 'q1', number: 1, text: 'Tell me about yourself.', category: 'INTRO', difficulty: 'Beginner', askedAt: now.toISOString() },
    ]),
    answersJson: '[]',
    score: null,
    feedbackJson: null,
    mode: 'LIVE_AI',
    source: 'PASSPORT',
    startAt: now,
    endAt: null,
    durationSec: null,
    durationLimitMin: 30,
    difficulty: 'Beginner',
    profileJson: JSON.stringify({ fullName: 'Test Candidate', skills: ['Python'], education: [], experiences: [], questionLimit: options.questionLimit ?? 5 }),
    transcriptJson: '[]',
    warningsJson: '[]',
    reportJson: null,
    communicationScore: null,
    behaviourScore: null,
    listeningScore: null,
    createdAt: now,
    updatedAt: now,
  };
  const counts = { nextQuestion: 0, analyze: 0, report: 0, updates: 0 };
  const interview = {
    findFirst: async ({ where }: { where: { id: string; candidateId: string } }) =>
      where.id === row.id && where.candidateId === row.candidateId ? { ...row } : null,
    findUnique: async () => ({ ...row }),
    findUniqueOrThrow: async () => ({ ...row }),
    update: async ({ data }: { data: Record<string, unknown> }) => {
      counts.updates += 1;
      Object.assign(row, data, { updatedAt: new Date() });
      return { ...row };
    },
  };
  // Serializes transactions the way SELECT ... FOR UPDATE serializes lockers of the same row.
  let lock: Promise<void> = Promise.resolve();
  const tx = { $queryRaw: async () => [], interview };
  const prisma = {
    candidate: { findUnique: async () => ({ id: 'cand-a', userId: 'user-a' }) },
    interview,
    $transaction: async <T>(fn: (client: typeof tx) => Promise<T>) => {
      const previous = lock;
      let release!: () => void;
      lock = new Promise<void>((resolve) => (release = resolve));
      await previous;
      try {
        return await fn(tx);
      } finally {
        release();
      }
    },
  };
  const ai = {
    nextQuestion: async (_p: unknown, _t: string, _d: string, asked: string[]) => {
      counts.nextQuestion += 1;
      await sleep(options.aiDelayMs ?? 25);
      return { text: `Generated question ${asked.length + 1}?`, category: 'TECHNICAL', thinkSeconds: 0 };
    },
    analyzeAnswer: async () => {
      counts.analyze += 1;
      await sleep(5);
      return { analysis: 'Scored.', score: 60, strengths: [], weaknesses: [], whatWasGood: [], whatWasMissing: [] };
    },
    report: async () => {
      counts.report += 1;
      await sleep(25);
      return { ...zeroAnswerReport(profile, integrity, 5), overallScore: 60, communication: 6, behaviour: 6, listening: 6 };
    },
  };
  const service = new InterviewsService(
    prisma as never,
    {} as never,
    ai as never,
    { markEligible: async () => undefined } as never,
  );
  const questions = () => JSON.parse(row.questionsJson) as LiveInterviewQuestion[];
  const settle = () => (service as unknown as { awaitPendingScores(id: string): Promise<void> }).awaitPendingScores(row.id);
  return { service, row, counts, questions, settle };
}

test('concurrent answers: one claims the question, the other gets 409 and no extra Gemini call', async () => {
  const h = harness();
  const results = await Promise.allSettled([
    h.service.answerLive('user-a', 'iv-1', 'First answer about my background and projects.'),
    h.service.answerLive('user-a', 'iv-1', 'Second answer about my background and projects.'),
  ]);
  await h.settle();
  const ok = results.filter((item) => item.status === 'fulfilled');
  const failed = results.filter((item) => item.status === 'rejected') as PromiseRejectedResult[];
  assert.equal(ok.length, 1);
  assert.equal(failed.length, 1);
  assert.ok(failed[0].reason instanceof ConflictException);
  assert.equal(h.counts.nextQuestion, 1);
  assert.equal(h.counts.analyze, 1);
  const qs = h.questions();
  assert.equal(qs.length, 2);
  assert.equal(qs[0].answer, 'First answer about my background and projects.');
  assert.equal(qs[0].score, 60, 'background score must not be lost by the next-question write');
  assert.equal(qs[1].text, 'Generated question 2?');
  assert.equal(h.row.questionIndex, 1);
  const transcript = JSON.parse(h.row.transcriptJson as string) as Array<{ role: string }>;
  assert.deepEqual(transcript.map((turn) => turn.role), ['candidate', 'ai']);
});

test('a stale questionIndex is rejected instead of answering the next question', async () => {
  const h = harness();
  await h.service.answerLive('user-a', 'iv-1', 'Answer to question one with enough detail.', 0, 'TEXT', 0);
  await assert.rejects(
    h.service.answerLive('user-a', 'iv-1', 'Answer to question one with enough detail.', 0, 'TEXT', 0),
    (err: unknown) => err instanceof ConflictException,
  );
  await h.settle();
  const qs = h.questions();
  assert.equal(qs.length, 2);
  assert.equal(qs[1].answer, undefined);
  assert.equal(h.counts.nextQuestion, 1);
});

test('audio answers count as answered for currentQuestion and the claim', async () => {
  const h = harness();
  const session = await h.service.answerLive('user-a', 'iv-1', '', 42, 'AUDIO');
  await h.settle();
  assert.equal(session.currentQuestion?.index, 1);
  assert.equal(h.questions()[0].answerMode, 'AUDIO');
  // Re-point to the answered audio question: it must not be offered again.
  h.row.questionIndex = 0;
  const view = await h.service.get('user-a', 'iv-1');
  assert.equal(view.currentQuestion, null);
  await assert.rejects(h.service.answerLive('user-a', 'iv-1', '', 10, 'AUDIO'), (err: unknown) => err instanceof ConflictException);
});

test('concurrent end requests generate the report once', async () => {
  const h = harness();
  await h.service.answerLive('user-a', 'iv-1', 'An answer with enough words to be scored properly.');
  await h.settle();
  const [a, b, c] = await Promise.all([
    h.service.endLive('user-a', 'iv-1'),
    h.service.endLive('user-a', 'iv-1'),
    h.service.endLive('user-a', 'iv-1'),
  ]);
  assert.equal(h.counts.report, 1);
  assert.equal(a.status, 'COMPLETED');
  assert.equal(b.report?.overallScore, a.report?.overallScore);
  assert.equal(c.status, 'COMPLETED');
  await assert.rejects(h.service.answerLive('user-a', 'iv-1', 'late answer after end'), /already ended/);
});

test('last answer ends the interview without generating another question', async () => {
  const h = harness({ questionLimit: 3 });
  const q = h.questions();
  q[0].answer = 'a';
  q[0].answerMode = 'TEXT';
  q[0].score = 50;
  q[0].analysis = 'ok';
  q.push({ id: 'q2', number: 2, text: 'Q2?', category: 'TECHNICAL', difficulty: 'Beginner', askedAt: new Date().toISOString(), answer: 'b', answerMode: 'TEXT', score: 50, analysis: 'ok' });
  q.push({ id: 'q3', number: 3, text: 'Q3?', category: 'SCENARIO', difficulty: 'Beginner', askedAt: new Date().toISOString() });
  h.row.questionsJson = JSON.stringify(q);
  h.row.questionIndex = 2;
  const session = await h.service.answerLive('user-a', 'iv-1', 'Final answer with a concrete example.');
  assert.equal(session.status, 'COMPLETED');
  assert.equal(h.counts.nextQuestion, 0);
  assert.equal(h.counts.report, 1);
  assert.equal(h.questions()[2].score, 60);
});

/* ---------------- skip ---------------- */

test('skip marks the question SKIPPED with score 0, makes no evaluation call and loads the next question', async () => {
  const h = harness();
  const session = await h.service.skipLive('user-a', 'iv-1', 0);
  await h.settle();
  const qs = h.questions();
  assert.equal(qs[0].answerMode, 'SKIPPED');
  assert.equal(qs[0].score, 0);
  assert.equal(h.counts.analyze, 0);
  assert.equal(h.counts.nextQuestion, 1);
  assert.equal(session.currentQuestion?.index, 1);
  await assert.rejects(h.service.skipLive('user-a', 'iv-1', 0), (err: unknown) => err instanceof ConflictException);
});

test('skipping the last question ends the interview', async () => {
  const h = harness({ questionLimit: 3 });
  const at = new Date().toISOString();
  const q = h.questions();
  Object.assign(q[0], { answer: 'a', answerMode: 'TEXT', score: 50, analysis: 'ok' });
  q.push({ id: 'q2', number: 2, text: 'Q2?', category: 'TECHNICAL', difficulty: 'Beginner', askedAt: at, answer: 'b', answerMode: 'TEXT', score: 50, analysis: 'ok' });
  q.push({ id: 'q3', number: 3, text: 'Q3?', category: 'SCENARIO', difficulty: 'Beginner', askedAt: at });
  h.row.questionsJson = JSON.stringify(q);
  h.row.questionIndex = 2;
  const session = await h.service.skipLive('user-a', 'iv-1', 2);
  assert.equal(session.status, 'COMPLETED');
  assert.equal(h.counts.nextQuestion, 0);
  assert.equal(h.counts.analyze, 0);
  assert.equal(h.questions()[2].answerMode, 'SKIPPED');
});

test('report counts skipped questions as 0 in the overall score', async () => {
  const gateway = { isConfigured: () => false };
  const ai = new InterviewAiService(gateway as never, {} as never);
  const at = new Date().toISOString();
  const questions: LiveInterviewQuestion[] = [
    { id: 'q1', number: 1, text: 'Q1?', category: 'TECHNICAL', difficulty: 'Beginner', askedAt: at, answer: 'A detailed answer about SQL joins.', answerMode: 'TEXT', score: 80, analysis: 'ok' },
    { id: 'q2', number: 2, text: 'Q2?', category: 'TECHNICAL', difficulty: 'Beginner', askedAt: at, answer: '', answerMode: 'SKIPPED', score: 0, analysis: 'skipped' },
  ];
  const report = await ai.report(profile, questions, 60, integrity, 2);
  assert.equal(report.overallScore, 40);
  assert.equal(typeof report.relevance, 'number');
  assert.equal(typeof report.clarity, 'number');
});

test('relevance rewards on-topic, well-scored answers; clarity penalises fragments and filler', () => {
  const at = new Date().toISOString();
  const q = (text: string, answer: string, score: number): LiveInterviewQuestion => ({
    id: text, number: 1, text, category: 'BEHAVIOURAL', difficulty: 'Beginner', askedAt: at, answer, answerMode: 'TEXT', score,
  });
  const onTopic = [q('Describe handling an upset customer complaint.', 'When a customer complaint came in about a late refund, I listened, apologised and escalated the refund to finance. The customer confirmed the fix the same day.', 85)];
  const offTopic = [q('Describe handling an upset customer complaint.', 'I like cricket and watching movies on weekends with my friends.', 20)];
  assert.ok(scoreRelevance(onTopic) > scoreRelevance(offTopic));
  const clear = [q('Why this role?', 'I enjoy solving customer problems. My last internship gave me daily practice with support tickets, and I want to grow that skill in a full-time role.', 70)];
  const fragment = [q('Why this role?', 'um like basically yes', 70)];
  assert.ok(scoreClarity(clear) > scoreClarity(fragment));
  assert.equal(scoreRelevance([]), 0);
  assert.equal(scoreClarity([]), 0);
});
