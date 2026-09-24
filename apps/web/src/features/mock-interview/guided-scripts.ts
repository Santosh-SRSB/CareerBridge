import { greetingForHour } from '@/features/interview/ai-speech';

export function firstNameFromFullName(fullName: string | null | undefined) {
  const raw = (fullName || '').trim();
  if (!raw) return 'there';
  const first = raw.split(/\s+/)[0];
  return first || 'there';
}

export function buildGreetingLine(candidateName: string | null | undefined) {
  const name = firstNameFromFullName(candidateName);
  const greeting = greetingForHour().toLowerCase();
  return `Hi ${name}, ${greeting}!`;
}

export function buildIntroPlanLine(questionCount = 5) {
  return `I'll create and take you through the best ${questionCount} interview questions based on your profile.`;
}

export function buildIntroStartLine() {
  return "Let's start with your first question.";
}

export function buildThinkLine() {
  return 'Take a moment to think, then choose how you want to answer — by recording or by typing.';
}

export function buildThinkSpokenLine() {
  return 'Take a moment to think about your answer. Then choose whether you want to record or type your answer.';
}

export function buildRecordStartLine() {
  return 'Your recording will start now. Please start speaking.';
}

export function buildQuestionCompletedLines(
  candidateName: string | null | undefined,
  questionNumber: number,
  totalQuestions: number,
) {
  const name = firstNameFromFullName(candidateName);
  if (questionNumber >= totalQuestions) {
    return {
      primary: `Excellent! You have completed all ${totalQuestions} interview questions.`,
      secondary: 'Analyzing your interview...',
    };
  }
  const ordinal =
    questionNumber === 1 ? 'first' : questionNumber === 2 ? 'second' : questionNumber === 3 ? 'third' : `${questionNumber}th`;
  return {
    primary: `Well done, ${name}! You have completed your ${ordinal} question.`,
    secondary: "Let's move on to the next question.",
  };
}

export function buildAnalyzingLine() {
  return 'Analyzing your interview...';
}
