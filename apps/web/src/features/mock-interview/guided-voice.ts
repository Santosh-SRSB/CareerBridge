import { cancelInterviewSpeech, speakInterviewLine } from '@/features/interview/cloud-speak';

/** Cancel any in-flight guided speech. */
export function cancelGuidedSpeech() {
  cancelInterviewSpeech('listening');
}

/**
 * Speak a predefined guided message. Resolves when speech ends (or immediately if TTS unavailable).
 * Uses the same cloud Indian-English female voice as live interviews.
 */
export async function speakGuided(message: string, opts?: { rate?: number }): Promise<void> {
  const text = message.trim();
  if (!text) return;
  await speakInterviewLine(text, { mood: 'speaking', rate: opts?.rate ?? 0.95 });
}
