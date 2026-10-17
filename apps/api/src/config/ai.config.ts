export const aiConfig = () => ({
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
  /** Must match the vector(N) column. Sent to Gemini as outputDimensionality. */
  embeddingDimensions: Number(process.env.EMBEDDING_DIMENSIONS || 768),
  /** Optional: enrich top matches with Gemini after rules+vector (cost control). */
  matchAiEnrich: process.env.AI_MATCH_ENRICH === 'true',
});
