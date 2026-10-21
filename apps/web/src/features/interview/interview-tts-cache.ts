export type InterviewTtsAudio = {
  audioBase64: string;
  mimeType: string;
};

export function normalizeInterviewLine(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Dedupes in-flight TTS requests and remembers successful clips so the first
 * spoken line is not synthesized twice (setup prefetch + interview start).
 */
export function createInterviewTtsCache(
  fetchAudio: (text: string) => Promise<InterviewTtsAudio>,
) {
  const cache = new Map<string, InterviewTtsAudio>();
  const inflight = new Map<string, Promise<InterviewTtsAudio>>();

  async function load(text: string): Promise<InterviewTtsAudio> {
    const key = normalizeInterviewLine(text);
    if (!key) {
      throw new Error('Speech text is required.');
    }
    const hit = cache.get(key);
    if (hit) return hit;
    const pending = inflight.get(key);
    if (pending) return pending;

    const job = fetchAudio(key).then(
      (audio) => {
        cache.set(key, audio);
        inflight.delete(key);
        return audio;
      },
      (err) => {
        inflight.delete(key);
        throw err;
      },
    );
    inflight.set(key, job);
    return job;
  }

  function peek(text: string) {
    return cache.get(normalizeInterviewLine(text));
  }

  function reset() {
    cache.clear();
    inflight.clear();
  }

  return { load, peek, reset };
}
