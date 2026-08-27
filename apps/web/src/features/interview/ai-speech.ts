export type AvatarMood = 'neutral' | 'speaking' | 'listening' | 'thinking' | 'welcoming';

type SpeechState = {
  speaking: boolean;
  thinking: boolean;
  mood: AvatarMood;
  text: string;
  startedAt: number;
};

type SpeechListener = (state: SpeechState) => void;

const listeners = new Set<SpeechListener>();
let last: SpeechState = {
  speaking: false,
  thinking: false,
  mood: 'neutral',
  text: '',
  startedAt: 0,
};

function emit() {
  listeners.forEach((listener) => listener(last));
}

export function subscribeAiSpeech(listener: SpeechListener) {
  listeners.add(listener);
  listener(last);
  return () => {
    listeners.delete(listener);
  };
}

export function startAiSpeech(text: string, mood: AvatarMood = 'speaking') {
  last = { speaking: true, thinking: false, mood, text, startedAt: performance.now() };
  emit();
}

export function stopAiSpeech(mood: AvatarMood = 'listening') {
  last = { speaking: false, thinking: false, mood, text: last.text, startedAt: last.startedAt };
  emit();
}

export function setAiThinking(on: boolean) {
  last = {
    ...last,
    speaking: false,
    thinking: on,
    mood: on ? 'thinking' : 'listening',
    startedAt: on ? performance.now() : last.startedAt,
  };
  emit();
}

export function setAvatarMood(mood: AvatarMood) {
  if (last.speaking) return;
  last = { ...last, mood, thinking: mood === 'thinking' };
  emit();
}

const LETTER_VISEME: Record<string, string> = {
  a: 'viseme_aa',
  e: 'viseme_E',
  i: 'viseme_I',
  o: 'viseme_O',
  u: 'viseme_U',
  y: 'viseme_I',
  p: 'viseme_PP',
  b: 'viseme_PP',
  m: 'viseme_PP',
  f: 'viseme_FF',
  v: 'viseme_FF',
  t: 'viseme_DD',
  d: 'viseme_DD',
  k: 'viseme_kk',
  g: 'viseme_kk',
  c: 'viseme_kk',
  s: 'viseme_SS',
  z: 'viseme_SS',
  r: 'viseme_RR',
  n: 'viseme_nn',
  l: 'viseme_nn',
  w: 'viseme_U',
  q: 'viseme_kk',
  x: 'viseme_SS',
  h: 'viseme_aa',
  j: 'viseme_CH',
};

export type VisemeCue = { at: number; name: string; open: number };

export function visemesFromText(text: string, rate = 0.95): VisemeCue[] {
  const cues: VisemeCue[] = [{ at: 0, name: 'viseme_sil', open: 0.02 }];
  let at = 0.05;
  const words = text.toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);
  const letterMs = 0.068 / rate;
  for (const word of words) {
    for (let i = 0; i < word.length; i += 1) {
      const pair = word.slice(i, i + 2);
      let name = LETTER_VISEME[word[i]] || 'viseme_aa';
      if (pair === 'th') {
        name = 'viseme_TH';
        i += 1;
      } else if (pair === 'ch' || pair === 'sh') {
        name = 'viseme_CH';
        i += 1;
      }
      const open =
        name === 'viseme_aa' || name === 'viseme_O'
          ? 0.78
          : name === 'viseme_PP' || name === 'viseme_sil'
            ? 0.06
            : 0.38;
      cues.push({ at, name, open });
      at += letterMs;
    }
    cues.push({ at, name: 'viseme_sil', open: 0.02 });
    at += 0.055 / rate;
  }
  return cues;
}

export function visemeAt(cues: VisemeCue[], elapsedSec: number) {
  if (!cues.length) return { name: 'viseme_sil', open: 0.02 };
  let current = cues[0];
  for (const cue of cues) {
    if (cue.at <= elapsedSec) current = cue;
    else break;
  }
  return current;
}

export function greetingForHour(hour = new Date().getHours()) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function pickFemaleVoice() {
  const voices = window.speechSynthesis?.getVoices() || [];
  const preferred = [
    /neerja/i,
    /sonia/i,
    /heera/i,
    /nirmala/i,
    /google.*(india|uk english female)/i,
    /microsoft.*(zira|aria)/i,
    /female/i,
  ];
  for (const re of preferred) {
    const hit = voices.find((item) => re.test(item.name) && /en/i.test(item.lang));
    if (hit) return hit;
  }
  return voices.find((item) => /en-IN/i.test(item.lang)) || voices.find((item) => /en-/i.test(item.lang)) || null;
}
