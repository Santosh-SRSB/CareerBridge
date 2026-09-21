export type GuidedPhase =
  | 'BOOTING'
  | 'INTRO_GREETING'
  | 'INTRODUCTION'
  | 'INTRO_START'
  | 'QUESTION_DISPLAY'
  | 'QUESTION_THINKING'
  | 'RECORDING_COUNTDOWN'
  | 'RECORDING_ACTIVE'
  | 'TYPING_ACTIVE'
  | 'ANSWER_SUBMITTING'
  | 'QUESTION_COMPLETED'
  | 'FINAL_PROCESSING'
  | 'ERROR';

export const GUIDED_PHASE_LABELS: Record<GuidedPhase, string> = {
  BOOTING: 'Loading',
  INTRO_GREETING: 'Introduction',
  INTRODUCTION: 'Introduction',
  INTRO_START: 'Introduction',
  QUESTION_DISPLAY: 'Question',
  QUESTION_THINKING: 'Think',
  RECORDING_COUNTDOWN: 'Record',
  RECORDING_ACTIVE: 'Record',
  TYPING_ACTIVE: 'Type',
  ANSWER_SUBMITTING: 'Next',
  QUESTION_COMPLETED: 'Next Question',
  FINAL_PROCESSING: 'Result',
  ERROR: 'Error',
};

export const THINK_SECONDS = 15;

export type AnswerMethod = 'recording' | 'typing';

export function progressSteps(phase: GuidedPhase): Array<{ id: string; label: string; active: boolean; done: boolean }> {
  const order = ['Introduction', 'Question', 'Think', 'Answer', 'Next', 'Next Question'] as const;
  let index = 0;
  if (phase === 'INTRO_GREETING' || phase === 'INTRODUCTION' || phase === 'INTRO_START' || phase === 'BOOTING') {
    index = 0;
  } else if (phase === 'QUESTION_DISPLAY') {
    index = 1;
  } else if (phase === 'QUESTION_THINKING') {
    index = 2;
  } else if (
    phase === 'RECORDING_COUNTDOWN' ||
    phase === 'RECORDING_ACTIVE' ||
    phase === 'TYPING_ACTIVE'
  ) {
    index = 3;
  } else if (phase === 'ANSWER_SUBMITTING') {
    index = 4;
  } else if (phase === 'QUESTION_COMPLETED' || phase === 'FINAL_PROCESSING') {
    index = 5;
  }
  return order.map((label, i) => ({
    id: label,
    label,
    active: i === index,
    done: i < index,
  }));
}
