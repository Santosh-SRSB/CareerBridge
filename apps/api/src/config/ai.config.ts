export const aiConfig = () => ({
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004',
  /** Optional: enrich top matches with Gemini after rules+vector (cost control). */
  matchAiEnrich: process.env.AI_MATCH_ENRICH === 'true',
});
