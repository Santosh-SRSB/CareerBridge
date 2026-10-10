import type { AnswerMethod } from './guided-states';

export const AUDIO_ANSWER_PLACEHOLDER = '(audio answer recorded)';
/** Shortest speech transcript worth sending as words to score. */
export const SPOKEN_TRANSCRIPT_MIN = 8;

type RecordingEnv = { getUserMedia?: unknown; MediaRecorder?: unknown };

export function browserRecordingEnv(): RecordingEnv {
  if (typeof window === 'undefined') return {};
  return {
    getUserMedia: navigator.mediaDevices?.getUserMedia,
    MediaRecorder: typeof MediaRecorder === 'undefined' ? undefined : MediaRecorder,
  };
}

/** Insecure origins and older browsers expose no getUserMedia or MediaRecorder. */
export function canRecordAudio(env: RecordingEnv = browserRecordingEnv()) {
  return typeof env.getUserMedia === 'function' && typeof env.MediaRecorder === 'function';
}

export function defaultAnswerMethod(recordingSupported: boolean): AnswerMethod {
  return recordingSupported ? 'recording' : 'typing';
}

export type AnswerDraft = { text: string; hasAudio: boolean; audioDurationSec?: number };

export type AnswerSubmission =
  | { ok: true; answer: string; answerMode: 'TEXT' | 'AUDIO'; durationSec?: number }
  | { ok: false; error: string };

/**
 * The payload for the chosen answer method. A recording with a usable transcript goes as TEXT
 * because the API discards the words of an AUDIO answer and scores it as audio-only.
 */
export function buildAnswerSubmission(method: AnswerMethod, draft: AnswerDraft, minChars: number): AnswerSubmission {
  const text = draft.text.trim();
  if (method === 'typing') {
    if (text.length < minChars) {
      return { ok: false, error: `Type your answer before continuing (minimum ${minChars} characters).` };
    }
    return { ok: true, answer: text, answerMode: 'TEXT' };
  }

  const recorded = draft.hasAudio || Boolean(draft.audioDurationSec);
  if (!recorded && text.length < minChars) {
    return { ok: false, error: 'Record your answer before continuing, or type it instead.' };
  }
  const durationSec = draft.audioDurationSec;
  if (text.length >= SPOKEN_TRANSCRIPT_MIN) return { ok: true, answer: text, answerMode: 'TEXT', durationSec };
  return { ok: true, answer: AUDIO_ANSWER_PLACEHOLDER, answerMode: 'AUDIO', durationSec };
}
