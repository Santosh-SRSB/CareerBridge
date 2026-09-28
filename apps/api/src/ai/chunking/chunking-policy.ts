/** Central chunking policy for Career Bridge RAG v1. Do not copy these numbers elsewhere. */
export const CHUNKING_POLICY = {
  semanticMaxTokens: 600,
  fallbackChunkSize: 450,
  fallbackOverlap: 50,
  /** An entity (role, project, degree…) at least this large gets its own vector. */
  entityStandaloneTokens: 60,
  /** Smaller entities of the same section are packed together up to this size. */
  entityPackMaxTokens: 300,
  /** Pieces smaller than this are merged into a neighbour of the same section. */
  minChunkChars: 80,
  version: 'v2',
} as const;

/** Same estimate the embedding gateway uses (about 4 characters per token). */
export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 4));
}
