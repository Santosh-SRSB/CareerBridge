/** Central chunking policy for Career Bridge RAG v1. Do not copy these numbers elsewhere. */
export const CHUNKING_POLICY = {
  semanticMaxTokens: 600,
  fallbackChunkSize: 450,
  fallbackOverlap: 50,
  version: 'v1',
} as const;

/** Same estimate the embedding gateway uses (about 4 characters per token). */
export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 4));
}
