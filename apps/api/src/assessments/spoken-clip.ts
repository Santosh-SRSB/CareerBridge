export type SpokenClipAnalysis = {
  hasVideo: boolean;
  hasAudio: boolean;
  durationMs: number;
  byteLength: number;
};

const MIN_CLIP_BYTES = 40_000;
const MIN_DURATION_MS = 8000;

export function analyzeSpokenClip(buffer: Buffer, claimedDurationMs = 0): SpokenClipAnalysis {
  const head = buffer.subarray(0, Math.min(buffer.length, 256 * 1024));
  const text = head.toString('latin1');
  const isWebm = buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45;
  const isMp4 = text.includes('ftyp');
  const hasVideo = /V_VP8|V_VP9|V_AV1/.test(text) || /avc1|vp09|hev1|av01/.test(text);
  const hasAudio = /A_OPUS|A_VORBIS/.test(text) || /mp4a|Opus/.test(text);
  const parsedDuration = isWebm ? readWebmDurationMs(buffer) : 0;

  return {
    hasVideo: hasVideo || ((isWebm || isMp4) && /V_/.test(text)),
    hasAudio,
    durationMs: parsedDuration || claimedDurationMs,
    byteLength: buffer.length,
  };
}

export function spokenClipPassed(analysis: SpokenClipAnalysis, hasVoice: boolean) {
  return (
    analysis.hasVideo &&
    analysis.hasAudio &&
    analysis.durationMs >= MIN_DURATION_MS &&
    analysis.byteLength >= MIN_CLIP_BYTES &&
    hasVoice
  );
}

function readWebmDurationMs(buffer: Buffer) {
  const limit = Math.min(buffer.length - 12, 8192);
  for (let i = 0; i < limit; i++) {
    if (buffer[i] !== 0x44 || buffer[i + 1] !== 0x89) continue;
    const size = readVint(buffer, i + 2);
    if (!size || (size.value !== 4 && size.value !== 8)) continue;
    const start = i + 2 + size.size;
    if (start + size.value > buffer.length) continue;
    const raw = size.value === 4 ? buffer.readFloatBE(start) : buffer.readDoubleBE(start);
    const ms = durationToMs(raw);
    if (ms >= MIN_DURATION_MS && ms <= 30_000) return ms;
  }
  return 0;
}

function durationToMs(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 5_000 && value <= 30_000) return Math.round(value);
  if (value >= 5 && value <= 30) return Math.round(value * 1000);
  if (value >= 5_000_000_000 && value <= 30_000_000_000) return Math.round(value / 1_000_000);
  return 0;
}

function readVint(buffer: Buffer, offset: number) {
  if (offset >= buffer.length) return null;
  const first = buffer[offset];
  let size = 1;
  let mask = 0x80;
  while (size <= 8 && (first & mask) === 0) {
    size += 1;
    mask >>= 1;
  }
  if (size > 8 || offset + size > buffer.length) return null;
  let value = first & (mask - 1);
  for (let i = 1; i < size; i++) value = (value << 8) + buffer[offset + i];
  return { value, size };
}
