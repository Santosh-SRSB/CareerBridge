import { synthesizeInterviewSpeech } from '@/lib/api';
import {
  type AvatarMood,
  pickFemaleVoice,
  startAiSpeech,
  stopAiSpeech,
} from '@/features/interview/ai-speech';
import {
  createInterviewTtsCache,
  normalizeInterviewLine,
} from '@/features/interview/interview-tts-cache';

let speakGeneration = 0;
let activeAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;
let activeSource: AudioBufferSourceNode | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let audioCtx: AudioContext | null = null;
let htmlUnlock: HTMLAudioElement | null = null;

const ttsCache = createInterviewTtsCache((text) => synthesizeInterviewSpeech(text));

/** 1-sample silent WAV — unlocks the media pipeline on a user gesture. */
const SILENCE_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

function audioContextCtor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  const win = window as Window & { webkitAudioContext?: typeof AudioContext };
  return window.AudioContext || win.webkitAudioContext;
}

function getAudioContext() {
  const Ctor = audioContextCtor();
  if (!Ctor) return null;
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new Ctor();
  }
  return audioCtx;
}

function warmBrowserVoices() {
  try {
    window.speechSynthesis?.getVoices();
  } catch {
    // ignore
  }
}

/**
 * Must run in the click/tap that starts the interview so the first clip is not
 * blocked or delayed by autoplay / a cold audio graph.
 */
export function unlockInterviewAudio() {
  if (typeof window === 'undefined') return;
  warmBrowserVoices();
  try {
    const ctx = getAudioContext();
    if (ctx) {
      void ctx.resume();
      const buffer = ctx.createBuffer(1, 1, ctx.sampleRate || 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);
    }
  } catch {
    // ignore
  }
  try {
    if (!htmlUnlock) {
      htmlUnlock = new Audio(SILENCE_WAV);
      htmlUnlock.preload = 'auto';
      htmlUnlock.muted = true;
    }
    void htmlUnlock.play().then(() => {
      try {
        htmlUnlock?.pause();
      } catch {
        // ignore
      }
    });
  } catch {
    // ignore
  }
}

function stopActiveSource() {
  if (activeSource) {
    try {
      activeSource.onended = null;
      activeSource.stop();
    } catch {
      // ignore
    }
    try {
      activeSource.disconnect();
    } catch {
      // ignore
    }
    activeSource = null;
  }
}

function stopActiveAudio() {
  stopActiveSource();
  if (activeAudio) {
    activeAudio.onended = null;
    activeAudio.onerror = null;
    activeAudio.onplaying = null;
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

function bytesFromBase64(audioBase64: string) {
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function resumeContext(ctx: AudioContext) {
  if (ctx.state === 'running') return Promise.resolve();
  return Promise.race([
    ctx.resume(),
    new Promise<void>((_, reject) => {
      window.setTimeout(() => reject(new Error('AudioContext resume timed out')), 400);
    }),
  ]);
}

function playWithAudioContext(
  bytes: Uint8Array,
  onStart: () => void,
  isCurrent: () => boolean,
): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return Promise.reject(new Error('No AudioContext'));

  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);

  return resumeContext(ctx).then(() => ctx.decodeAudioData(copy)).then((buffer) => {
    if (!isCurrent()) return;
    return new Promise<void>((resolve, reject) => {
      try {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        activeSource = source;
        source.onended = () => {
          if (activeSource === source) activeSource = null;
          resolve();
        };
        source.start(0);
        onStart();
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Audio playback failed'));
      }
    });
  });
}

function playWithHtmlAudio(
  bytes: Uint8Array,
  mimeType: string,
  onStart: () => void,
  isCurrent: () => boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const blob = new Blob([bytes], { type: mimeType || 'audio/wav' });
      const url = URL.createObjectURL(blob);
      activeObjectUrl = url;
      const audio = new Audio();
      audio.preload = 'auto';
      activeAudio = audio;
      let started = false;
      let playRequested = false;
      let bufferTimer = 0;
      let playingTimer = 0;
      const clearTimers = () => {
        window.clearTimeout(bufferTimer);
        window.clearTimeout(playingTimer);
      };
      const markStart = () => {
        if (started) return;
        started = true;
        clearTimers();
        onStart();
      };
      audio.onplaying = markStart;
      audio.onended = () => {
        clearTimers();
        stopActiveAudio();
        resolve();
      };
      audio.onerror = () => {
        clearTimers();
        stopActiveAudio();
        reject(new Error('Audio playback failed'));
      };
      const tryPlay = () => {
        if (playRequested) return;
        playRequested = true;
        if (!isCurrent()) {
          clearTimers();
          stopActiveAudio();
          resolve();
          return;
        }
        void audio.play().then(() => {
          playingTimer = window.setTimeout(markStart, 80);
        }).catch((err) => {
          clearTimers();
          stopActiveAudio();
          reject(err instanceof Error ? err : new Error('Audio playback failed'));
        });
      };
      audio.oncanplaythrough = () => {
        audio.oncanplaythrough = null;
        tryPlay();
      };
      audio.src = url;
      audio.load();
      bufferTimer = window.setTimeout(() => {
        if (audio.readyState >= 2) tryPlay();
      }, 280);
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Audio decode failed'));
    }
  });
}

async function playWavBase64(
  audioBase64: string,
  mimeType: string,
  onStart: () => void,
  isCurrent: () => boolean,
): Promise<void> {
  const bytes = bytesFromBase64(audioBase64);
  try {
    await playWithAudioContext(bytes, onStart, isCurrent);
  } catch {
    if (!isCurrent()) return;
    await playWithHtmlAudio(bytes, mimeType, onStart, isCurrent);
  }
}

function speakBrowserFallback(
  text: string,
  mood: AvatarMood,
  rate: number,
  onStart: () => void,
): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      onStart();
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
    utter.onstart = () => onStart();
    utter.onend = finish;
    utter.onerror = finish;
    try {
      synth.speak(utter);
      window.setTimeout(onStart, 60);
    } catch {
      onStart();
      finish();
    }
  });
}

/** Fetch and cache a line so the first speak does not wait on a cold TTS call. */
export async function prefetchInterviewSpeech(text: string): Promise<void> {
  const line = normalizeInterviewLine(text);
  if (!line) return;
  try {
    await ttsCache.load(line);
  } catch {
    // Best-effort — speak() will retry.
  }
}

/**
 * Speak interview / guided lines with the fixed cloud Indian-English female voice.
 * Falls back to browser TTS only if the API is unavailable.
 * Caption / mouth-sync should wait for `onStart` (actual playback), not the call.
 */
export async function speakInterviewLine(
  text: string,
  opts?: { mood?: 'speaking' | 'welcoming'; rate?: number; onStart?: () => void },
): Promise<void> {
  const line = normalizeInterviewLine(text);
  if (!line) return;

  const myGen = ++speakGeneration;
  stopActiveAudio();
  stopBrowserSpeech();

  const mood = opts?.mood ?? 'speaking';
  const rate = opts?.rate ?? 0.94;
  const isCurrent = () => myGen === speakGeneration;
  let started = false;
  const markStart = () => {
    if (!isCurrent() || started) return;
    started = true;
    startAiSpeech(line, mood);
    opts?.onStart?.();
  };

  const finishIfCurrent = () => {
    if (isCurrent()) stopAiSpeech('listening');
  };

  try {
    const audio = await ttsCache.load(line);
    if (!isCurrent()) return;
    await playWavBase64(audio.audioBase64, audio.mimeType, markStart, isCurrent);
  } catch {
    if (!isCurrent()) return;
    await speakBrowserFallback(line, mood, rate, markStart);
  } finally {
    finishIfCurrent();
  }
}
