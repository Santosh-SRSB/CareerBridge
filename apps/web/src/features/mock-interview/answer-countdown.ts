import type { GuidedPhase } from './guided-states';

/** Answer window for each mock-interview question, started when answering begins. */
export const ANSWER_LIMIT_SEC = 60;

export type AnswerBarColor = 'blue' | 'orange' | 'red';

/** Brand blue, then amber, then red. Text uses darker companions for contrast. */
export const ANSWER_BAR_COLORS: Record<AnswerBarColor, string> = {
  blue: '#1A1FC4',
  orange: '#f59e0b',
  red: '#dc2626',
};

export const ANSWER_TIME_COLORS: Record<AnswerBarColor, string> = {
  blue: '#1A1FC4',
  orange: '#c2410c',
  red: '#b91c1c',
};

export type AnswerTimerSnapshot = {
  questionIndex: number;
  /** Absolute `performance.now()` deadline. Null until the answer phase starts. */
  deadlineMs: number | null;
};

export type AnswerCountdown = {
  remainingMs: number;
  remainingSec: number;
  elapsedSec: number;
  /** 1 when the bar is full, 0 when time is up. */
  progress: number;
  color: AnswerBarColor;
  expired: boolean;
  label: string;
};

const START_PHASES = new Set<GuidedPhase>(['RECORDING_ACTIVE', 'TYPING_ACTIVE']);

export function isAnswerPhase(phase: GuidedPhase) {
  return phase === 'RECORDING_COUNTDOWN' || phase === 'RECORDING_ACTIVE' || phase === 'TYPING_ACTIVE';
}

/**
 * Color from elapsed answer time.
 * Blue through 29s, orange from 30s, red from 45s.
 */
export function answerBarColor(elapsedSec: number): AnswerBarColor {
  if (elapsedSec >= 45) return 'red';
  if (elapsedSec >= 30) return 'orange';
  return 'blue';
}

export function formatAnswerClock(totalSec: number) {
  const clamped = Math.max(0, Math.floor(totalSec));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Remaining time is derived from a deadline so hidden tabs cannot stretch the clock. */
export function answerCountdown(nowMs: number, deadlineMs: number, limitSec = ANSWER_LIMIT_SEC): AnswerCountdown {
  const totalMs = limitSec * 1000;
  const remainingMs = Math.max(0, deadlineMs - nowMs);
  const elapsedMs = Math.min(totalMs, Math.max(0, totalMs - remainingMs));
  const elapsedSec = elapsedMs / 1000;
  const remainingSec = remainingMs <= 0 ? 0 : Math.ceil(remainingMs / 1000);
  return {
    remainingMs,
    remainingSec,
    elapsedSec,
    progress: totalMs === 0 ? 0 : remainingMs / totalMs,
    color: answerBarColor(elapsedSec),
    expired: remainingMs <= 0,
    label: formatAnswerClock(remainingSec),
  };
}

/**
 * One deadline per question. Recording, typing, and "Record again" keep it.
 * A new question index clears it. Thinking and the first get-ready intro do not start it.
 */
export function syncAnswerTimer(
  timer: AnswerTimerSnapshot | null,
  questionIndex: number,
  phase: GuidedPhase,
  nowMs: number,
  limitSec = ANSWER_LIMIT_SEC,
): AnswerTimerSnapshot {
  const sameQuestion = timer != null && timer.questionIndex === questionIndex;
  const base: AnswerTimerSnapshot = sameQuestion ? timer : { questionIndex, deadlineMs: null };
  if (base.deadlineMs != null) return base;
  if (!START_PHASES.has(phase)) return base;
  return { questionIndex, deadlineMs: nowMs + limitSec * 1000 };
}

export function answerClockShouldRun(phase: GuidedPhase, deadlineMs: number | null) {
  return deadlineMs != null && isAnswerPhase(phase);
}

export type AdvanceGate = {
  inFlight: boolean;
  /** Question whose automatic expiry submit has already been consumed. */
  expiryQuestion: number | null;
};

export function createAdvanceGate(): AdvanceGate {
  return { inFlight: false, expiryQuestion: null };
}

export function beginManualAdvance(gate: AdvanceGate): { gate: AdvanceGate; accepted: boolean } {
  if (gate.inFlight) return { gate, accepted: false };
  return { gate: { ...gate, inFlight: true }, accepted: true };
}

/**
 * Automatic advance runs once per question.
 * If a manual submit is already in flight, expiry is consumed so it cannot submit again later.
 */
export function beginExpiryAdvance(
  gate: AdvanceGate,
  questionIndex: number,
): { gate: AdvanceGate; accepted: boolean } {
  if (gate.expiryQuestion === questionIndex) return { gate, accepted: false };
  if (gate.inFlight) {
    return { gate: { ...gate, expiryQuestion: questionIndex }, accepted: false };
  }
  return {
    gate: { inFlight: true, expiryQuestion: questionIndex },
    accepted: true,
  };
}

export function releaseAdvance(gate: AdvanceGate): AdvanceGate {
  return { ...gate, inFlight: false };
}

/**
 * A submit that fails once time is up already stood in for the automatic advance.
 * Consuming expiry stops the same rejected answer from being re-sent as soon as the answer screen returns.
 */
export function releaseAfterFailedSubmit(
  gate: AdvanceGate,
  questionIndex: number,
  nowMs: number,
  deadlineMs: number | null,
): AdvanceGate {
  const released = releaseAdvance(gate);
  if (deadlineMs != null && nowMs >= deadlineMs) return { ...released, expiryQuestion: questionIndex };
  return released;
}

export function resetAdvanceGate(): AdvanceGate {
  return createAdvanceGate();
}

/**
 * A valid answer always submits. A too-short answer shows the validation message when the
 * candidate advances, but is closed as skipped when time runs out so the interview keeps moving.
 */
export function advanceAction(source: 'manual' | 'expiry', submissionOk: boolean) {
  if (submissionOk) return 'submit' as const;
  return source === 'expiry' ? ('skip' as const) : ('showError' as const);
}

export function isLastMockQuestion(questionNumber: number, totalQuestions: number) {
  return questionNumber >= totalQuestions;
}

/** After a successful save, the last question goes to the existing report flow. */
export function phaseAfterSavedAnswer(session: { status: string; conductTerminated?: boolean | null }) {
  if (session.status === 'COMPLETED' || session.conductTerminated) return 'FINAL_PROCESSING' as const;
  return 'QUESTION_DISPLAY' as const;
}
