export const aiConfig = () => ({
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
  /** Must match the vector(N) column. Sent to Gemini as outputDimensionality. */
  embeddingDimensions: Number(process.env.EMBEDDING_DIMENSIONS || 768),
  /** Optional: enrich top matches with Gemini after rules+vector (cost control). */
  matchAiEnrich: process.env.AI_MATCH_ENRICH === 'true',
  /**
   * Interview TTS — fixed cloud female Indian-English voice (same on every laptop).
   * Uses GEMINI_API_KEY. Kore = firm prebuilt voice; language en-IN.
   */
  geminiTtsModel: process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts',
  geminiTtsVoice: process.env.GEMINI_TTS_VOICE || 'Kore',
  geminiTtsLanguage: process.env.GEMINI_TTS_LANGUAGE || 'en-IN',
  geminiTtsTimeoutMs: Number(process.env.GEMINI_TTS_TIMEOUT_MS || 25000),
});
