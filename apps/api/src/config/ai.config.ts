export const aiConfig = () => ({
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004',
  /** Must match the vector(N) column. text-embedding-004 defaults to 768. */
  embeddingDimensions: Number(process.env.EMBEDDING_DIMENSIONS || 768),
  /** Optional: enrich top matches with Gemini after rules+vector (cost control). */
  matchAiEnrich: process.env.AI_MATCH_ENRICH === 'true',
});
