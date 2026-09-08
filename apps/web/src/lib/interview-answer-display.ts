import type { LiveInterviewQuestion } from '@careerbridge/shared';

const AUDIO_PLACEHOLDER_RE =
  /\(audio answer recorded|audio answer recorded|please type a summary for better ai feedback\)/i;

export function formatInterviewAnswerDisplay(item: LiveInterviewQuestion) {
  if (item.answerMode === 'AUDIO') {
    const seconds = item.answerDurationSec ? ` (${item.answerDurationSec}s)` : '';
    return `Audio answer submitted${seconds}.`;
  }
  const text = (item.answer || '').trim();
  if (!text || AUDIO_PLACEHOLDER_RE.test(text)) {
    return 'Audio answer submitted.';
  }
  return text;
}

export function shouldShowBetterAnswer(item: LiveInterviewQuestion) {
  if (item.answerMode === 'AUDIO') return false;
  const improved = (item.improvedAnswer || '').trim();
  if (!improved) return false;
  return !AUDIO_PLACEHOLDER_RE.test(improved);
}

export function isAnsweredInterviewQuestion(item: LiveInterviewQuestion) {
  if (item.answerMode === 'AUDIO') return true;
  const text = (item.answer || '').trim();
  return Boolean(text) && !AUDIO_PLACEHOLDER_RE.test(text);
}
