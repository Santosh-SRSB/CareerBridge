/** Wrap raw PCM (16-bit LE mono) in a WAV container for browser playback. */
export function pcmToWav(
  pcm: Buffer,
  sampleRate = 24000,
  channels = 1,
  bitsPerSample = 16,
): Buffer {
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** True when bytes already look like a RIFF/WAVE file. */
export function looksLikeWav(buf: Buffer): boolean {
  return buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE';
}

/**
 * Normalize Gemini TTS output to audio/wav base64.
 * Unary Gemini TTS may return WAV or raw L16 PCM (24 kHz mono).
 */
export function normalizeTtsAudio(
  data: Buffer,
  mimeType?: string | null,
): { wav: Buffer; mimeType: 'audio/wav' } {
  const mime = (mimeType || '').toLowerCase();
  if (looksLikeWav(data) || mime.includes('wav') || mime.includes('x-wav')) {
    return { wav: data, mimeType: 'audio/wav' };
  }
  // audio/L16;rate=24000 or bare PCM
  const rateMatch = /rate=(\d+)/i.exec(mime);
  const sampleRate = rateMatch ? Number(rateMatch[1]) : 24000;
  return { wav: pcmToWav(data, Number.isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 24000), mimeType: 'audio/wav' };
}
