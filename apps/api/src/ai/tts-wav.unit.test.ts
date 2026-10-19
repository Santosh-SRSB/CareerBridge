import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { looksLikeWav, normalizeTtsAudio, pcmToWav } from './tts-wav';

describe('tts-wav', () => {
  it('wraps PCM in a valid WAV header', () => {
    const pcm = Buffer.alloc(4800, 0);
    const wav = pcmToWav(pcm, 24000);
    assert.equal(looksLikeWav(wav), true);
    assert.equal(wav.length, 44 + pcm.length);
    assert.equal(wav.readUInt32LE(24), 24000);
    assert.equal(wav.readUInt16LE(22), 1);
  });

  it('passes through existing WAV bytes', () => {
    const pcm = Buffer.alloc(100, 1);
    const wav = pcmToWav(pcm);
    const out = normalizeTtsAudio(wav, 'audio/wav');
    assert.equal(out.mimeType, 'audio/wav');
    assert.equal(out.wav.equals(wav), true);
  });

  it('wraps L16 PCM using rate from mime', () => {
    const pcm = Buffer.alloc(200, 2);
    const out = normalizeTtsAudio(pcm, 'audio/L16;rate=16000');
    assert.equal(out.mimeType, 'audio/wav');
    assert.equal(looksLikeWav(out.wav), true);
    assert.equal(out.wav.readUInt32LE(24), 16000);
  });
});
