import type { LiveInterviewQuestion } from '@careerbridge/shared';

const AUDIO_PLACEHOLDER_RE =
  /\(audio answer recorded|audio answer recorded|please type a summary for better ai feedback\)/i;

export function isAudioPlaceholderAnswer(answer: string) {
  return AUDIO_PLACEHOLDER_RE.test(answer.trim());
}

/** Closed questions: answered by text or audio, or skipped. */
export function isAnsweredQuestion(item: LiveInterviewQuestion) {
  if (item.answerMode === 'AUDIO' || item.answerMode === 'SKIPPED') return true;
  return Boolean(item.answer?.trim());
}

export function countAnsweredQuestions(questions: LiveInterviewQuestion[]) {
  return questions.filter(isAnsweredQuestion).length;
}

export function evaluableTextAnswer(item: LiveInterviewQuestion) {
  if (item.answerMode === 'AUDIO' || item.answerMode === 'SKIPPED') return '';
  const text = (item.answer || '').trim();
  if (!text || isAudioPlaceholderAnswer(text)) return '';
  return text;
}
