import type { LiveInterviewQuestion } from '@careerbridge/shared';

const AUDIO_PLACEHOLDER_RE =
  /\(audio answer recorded|audio answer recorded|please type a summary for better ai feedback\)/i;

export function formatInterviewAnswerDisplay(item: LiveInterviewQuestion) {
  if (item.answerMode === 'SKIPPED') return 'Question skipped.';
  const text = (item.answer || '').trim();
  const hasText = Boolean(text) && !AUDIO_PLACEHOLDER_RE.test(text);
  const seconds = item.answerDurationSec;
  const audioSuffix =
    typeof seconds === 'number' && seconds > 0 ? ` (audio ${seconds}s)` : item.answerMode === 'AUDIO' ? ' (audio)' : '';

  if (hasText) {
    return `${text}${audioSuffix}`;
  }
  if (item.answerMode === 'AUDIO' || audioSuffix) {
    return `Audio answer submitted${audioSuffix} — transcript unavailable.`;
  }
  return text || 'No answer recorded.';
}

export function shouldShowBetterAnswer(item: LiveInterviewQuestion) {
  const improved = (item.improvedAnswer || '').trim();
  if (!improved) return false;
  return !AUDIO_PLACEHOLDER_RE.test(improved);
}

export function isAnsweredInterviewQuestion(item: LiveInterviewQuestion) {
  if (item.answerMode === 'AUDIO' || item.answerMode === 'SKIPPED') return true;
  const text = (item.answer || '').trim();
  return Boolean(text) && !AUDIO_PLACEHOLDER_RE.test(text);
}
