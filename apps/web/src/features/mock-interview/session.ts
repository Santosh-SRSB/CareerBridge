import { buildMockInterviewQuestions } from './questions';
import type {
  MockInterviewAnswer,
  MockInterviewResult,
  MockInterviewSession,
  MockInterviewType,
} from './types';

const STORAGE_PREFIX = 'cb-mock-interview-';

function storageKey(id: string) {
  return `${STORAGE_PREFIX}${id}`;
}

function readSession(id: string): MockInterviewSession | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(storageKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MockInterviewSession;
  } catch {
    return null;
  }
}

function writeSession(session: MockInterviewSession) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(storageKey(session.id), JSON.stringify(session));
}

export function createMockInterviewSession(payload: {
  jobRole: string;
  interviewType: MockInterviewType;
  questionCount: number;
}): MockInterviewSession {
  const id = `mock-${Date.now()}`;
  const questions = buildMockInterviewQuestions(
    payload.jobRole,
    payload.interviewType,
    payload.questionCount,
  );

  const session: MockInterviewSession = {
    id,
    jobRole: payload.jobRole,
    interviewType: payload.interviewType,
    questionCount: questions.length,
    questions,
    currentIndex: 0,
    answers: [],
    completed: false,
    createdAt: new Date().toISOString(),
  };

  writeSession(session);
  return session;
}

export function getMockInterviewSession(id: string): MockInterviewSession | null {
  return readSession(id);
}

export function submitMockInterviewAnswer(
  id: string,
  answer: Omit<MockInterviewAnswer, 'questionIndex'>,
): MockInterviewSession {
  const session = readSession(id);
  if (!session) throw new Error('Interview session not found');
  if (session.completed) return session;

  const entry: MockInterviewAnswer = {
    questionIndex: session.currentIndex,
    text: answer.text.trim(),
    hasAudio: answer.hasAudio,
    audioDurationSec: answer.audioDurationSec,
  };

  session.answers = [...session.answers.filter((item) => item.questionIndex !== entry.questionIndex), entry];
  session.currentIndex += 1;

  if (session.currentIndex >= session.questions.length) {
    session.completed = true;
  }

  writeSession(session);
  return session;
}

function scoreAnswer(answer: MockInterviewAnswer): number {
  const text = answer.text.toLowerCase();
  let score = 62;

  if (answer.text.trim().length >= 40) score += 8;
  if (answer.text.trim().length >= 120) score += 6;
  if (answer.hasAudio) score += 4;
  if (/\b(customer|client|team|example|resolved|helped|listened)\b/.test(text)) score += 8;
  if (/\b(i|we)\b/.test(text)) score += 3;

  return Math.min(95, score);
}

export function buildMockInterviewResult(session: MockInterviewSession): MockInterviewResult {
  const answerScores = session.answers.map(scoreAnswer);
  const average =
    answerScores.length > 0
      ? Math.round(answerScores.reduce((sum, value) => sum + value, 0) / answerScores.length)
      : 70;

  const communication = Math.min(95, average + 1);
  const relevance = Math.min(95, average + 7);
  const clarity = Math.max(60, average - 2);
  const confidence = Math.max(58, average - 5);
  const overall = Math.round((communication + relevance + clarity + confidence) / 4);

  const strengths = [
    'Good understanding of the question',
    'Relevant examples',
  ];

  const improvements = [
    'Keep answers shorter',
    'Use specific examples',
  ];

  if (session.answers.every((item) => !item.hasAudio)) {
    improvements.push('Try recording one answer to practise speaking clearly');
  }

  return {
    overall,
    communication,
    relevance,
    clarity,
    confidence,
    strengths,
    improvements,
  };
}

export function getMockInterviewResult(id: string): MockInterviewResult | null {
  const session = readSession(id);
  if (!session || !session.completed) return null;
  return buildMockInterviewResult(session);
}
