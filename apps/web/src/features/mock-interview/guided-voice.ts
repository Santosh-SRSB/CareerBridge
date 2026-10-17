import { pickFemaleVoice, startAiSpeech, stopAiSpeech } from '@/features/interview/ai-speech';

let activeUtterance: SpeechSynthesisUtterance | null = null;
let voicesReady: Promise<void> | null = null;

function ensureVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return Promise.resolve();
  }
  if (window.speechSynthesis.getVoices().length > 0) return Promise.resolve();
  if (voicesReady) return voicesReady;
  voicesReady = new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', done);
      resolve();
    };
    window.speechSynthesis.addEventListener('voiceschanged', done);
    // Fallback if voiceschanged never fires.
    window.setTimeout(done, 800);
  });
  return voicesReady;
}

/** Cancel any in-flight guided speech. */
export function cancelGuidedSpeech() {
  if (typeof window === 'undefined') return;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // ignore
  }
  activeUtterance = null;
  stopAiSpeech('listening');
}

/**
 * Speak a predefined guided message. Resolves when speech ends (or immediately if TTS unavailable).
 * Does not generate conversational replies — scripts only.
 */
export async function speakGuided(message: string, opts?: { rate?: number }): Promise<void> {
  const text = message.trim();
  if (!text) return;

  if (typeof window === 'undefined' || !window.speechSynthesis) {
    startAiSpeech(text, 'speaking');
    await new Promise((r) => setTimeout(r, Math.min(4200, 600 + text.length * 45)));
    stopAiSpeech('listening');
    return;
  }

  cancelGuidedSpeech();
  await ensureVoices();

  return new Promise((resolve) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = opts?.rate ?? 0.95;
    utter.pitch = 1;
    const voice = pickFemaleVoice();
    if (voice) utter.voice = voice;
    activeUtterance = utter;
    startAiSpeech(text, 'speaking');

    const finish = () => {
      if (activeUtterance === utter) activeUtterance = null;
      stopAiSpeech('listening');
      resolve();
    };

    utter.onend = finish;
    utter.onerror = finish;

    try {
      window.speechSynthesis.speak(utter);
    } catch {
      finish();
    }
  });
}
