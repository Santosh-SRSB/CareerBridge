import { synthesizeInterviewSpeech } from '@/lib/api';
import {
  type AvatarMood,
  pickFemaleVoice,
  startAiSpeech,
  stopAiSpeech,
} from '@/features/interview/ai-speech';

let speakGeneration = 0;
let activeAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;

function stopActiveAudio() {
  if (activeAudio) {
    activeAudio.onended = null;
    activeAudio.onerror = null;
    try {
      activeAudio.pause();
    } catch {
      // ignore
    }
    activeAudio.src = '';
    activeAudio = null;
  }
  if (activeObjectUrl) {
    try {
      URL.revokeObjectURL(activeObjectUrl);
    } catch {
      // ignore
    }
    activeObjectUrl = null;
  }
}

function stopBrowserSpeech() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // ignore
  }
  activeUtterance = null;
}

/** Cancel any in-flight cloud or browser speech. */
export function cancelInterviewSpeech(mood: AvatarMood = 'listening') {
  speakGeneration += 1;
  stopActiveAudio();
  stopBrowserSpeech();
  stopAiSpeech(mood);
}

function playWavBase64(audioBase64: string, mimeType: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const binary = atob(audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mimeType || 'audio/wav' });
      const url = URL.createObjectURL(blob);
      activeObjectUrl = url;
      const audio = new Audio(url);
      activeAudio = audio;
      audio.onended = () => {
        stopActiveAudio();
        resolve();
      };
      audio.onerror = () => {
        stopActiveAudio();
        reject(new Error('Audio playback failed'));
      };
      void audio.play().catch((err) => {
        stopActiveAudio();
        reject(err instanceof Error ? err : new Error('Audio playback failed'));
      });
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Audio decode failed'));
    }
  });
}

function speakBrowserFallback(
  text: string,
  mood: AvatarMood,
  rate: number,
): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      window.setTimeout(resolve, Math.min(8000, 600 + text.length * 45));
      return;
    }
    const synth = window.speechSynthesis;
    synth.resume();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = rate;
    utter.pitch = 1.05;
    utter.lang = 'en-IN';
    const voice = pickFemaleVoice();
    if (voice) utter.voice = voice;
    activeUtterance = utter;
    const finish = () => {
      if (activeUtterance === utter) activeUtterance = null;
      resolve();
    };
    utter.onend = finish;
    utter.onerror = finish;
    try {
      synth.speak(utter);
    } catch {
      finish();
    }
  });
}

/**
 * Speak interview / guided lines with the fixed cloud Indian-English female voice.
 * Falls back to browser TTS only if the API is unavailable.
 */
export async function speakInterviewLine(
  text: string,
  opts?: { mood?: 'speaking' | 'welcoming'; rate?: number },
): Promise<void> {
  const line = text.replace(/\n+/g, ' ').trim();
  if (!line) return;

  const myGen = ++speakGeneration;
  stopActiveAudio();
  stopBrowserSpeech();

  const mood = opts?.mood ?? 'speaking';
  const rate = opts?.rate ?? 0.94;
  startAiSpeech(line, mood);

  const finishIfCurrent = () => {
    if (myGen === speakGeneration) stopAiSpeech('listening');
  };

  try {
    const audio = await synthesizeInterviewSpeech(line);
    if (myGen !== speakGeneration) return;
    await playWavBase64(audio.audioBase64, audio.mimeType);
  } catch {
    if (myGen !== speakGeneration) return;
    await speakBrowserFallback(line, mood, rate);
  } finally {
    finishIfCurrent();
  }
}
