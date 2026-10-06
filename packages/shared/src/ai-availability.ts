export const AI_UNAVAILABLE_REASONS = [
  'NOT_CONFIGURED',
  'DISABLED',
  'DAILY_REQUEST_LIMIT',
  'DAILY_TOKEN_LIMIT',
  'UPSTREAM_UNAVAILABLE',
  'TIMEOUT',
  'FAILED',
] as const;

export type AiUnavailableReason = (typeof AI_UNAVAILABLE_REASONS)[number];

export const AI_SUGGESTIONS_UNAVAILABLE_MESSAGE =
  'AI suggestions are temporarily unavailable. You can continue editing manually.';

export const AI_ANALYSIS_FAILED_MESSAGE =
  'Unable to analyze your resume with AI. Please try again. You can continue editing manually.';

export const AI_INTERVIEW_QUESTION_FALLBACK_MESSAGE =
  'AI questions are temporarily unavailable, so this question was prepared from your profile.';

export const AI_INTERVIEW_SCORING_FALLBACK_MESSAGE =
  'AI feedback was temporarily unavailable, so some answers were scored with our standard rubric.';

export function isAiUnavailableReason(value: unknown): value is AiUnavailableReason {
  return typeof value === 'string' && (AI_UNAVAILABLE_REASONS as readonly string[]).includes(value);
}

export function aiSuggestionsUnavailableMessage(reason?: AiUnavailableReason | null): string {
  if (reason === 'DISABLED') {
    return 'AI suggestions are currently turned off. You can continue editing manually.';
  }
  if (reason === 'DAILY_REQUEST_LIMIT' || reason === 'DAILY_TOKEN_LIMIT') {
    return "AI suggestions have reached today's usage limit. You can continue editing manually.";
  }
  return AI_SUGGESTIONS_UNAVAILABLE_MESSAGE;
}

export const AI_SETTING_DEFAULTS = {
  'ai.enabled': 'true',
  'ai.dailyRequestLimit': '50000',
  'ai.tokenLimit': '2000000',
} as const;

export type AiSettingKey = keyof typeof AI_SETTING_DEFAULTS;

export type AiLimits = { enabled: boolean; dailyRequestLimit: number; dailyTokenLimit: number };

export function parseAiSettings(values: Partial<Record<string, string | null | undefined>>): AiLimits {
  const read = (key: AiSettingKey) => {
    const raw = values[key];
    return raw == null || String(raw).trim() === '' ? AI_SETTING_DEFAULTS[key] : String(raw).trim();
  };
  const limit = (key: AiSettingKey) => {
    const n = Number(read(key));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  };
  return {
    enabled: read('ai.enabled').toLowerCase() !== 'false',
    dailyRequestLimit: limit('ai.dailyRequestLimit'),
    dailyTokenLimit: limit('ai.tokenLimit'),
  };
}

const IST_OFFSET_MS = 330 * 60 * 1000;

/** Daily AI limits reset at midnight India time. */
export function aiUsageDayStart(now: Date = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const midnightIst = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  return new Date(midnightIst - IST_OFFSET_MS);
}

export type AiBudgetInput = {
  enabled: boolean;
  dailyRequestLimit: number;
  dailyTokenLimit: number;
  requestsToday: number;
  tokensToday: number;
};

export type AiBudgetStatus = {
  status: 'OK' | 'WARNING' | 'LIMIT_REACHED' | 'DISABLED';
  requestsToday: number;
  tokensToday: number;
  dailyRequestLimit: number;
  dailyTokenLimit: number;
};

export function aiBudgetStatus(input: AiBudgetInput): AiBudgetStatus {
  const blocked = evaluateAiBudget(input);
  const ratio = Math.max(
    input.dailyRequestLimit > 0 ? input.requestsToday / input.dailyRequestLimit : 0,
    input.dailyTokenLimit > 0 ? input.tokensToday / input.dailyTokenLimit : 0,
  );
  return {
    status: blocked === 'DISABLED' ? 'DISABLED' : blocked ? 'LIMIT_REACHED' : ratio >= 0.8 ? 'WARNING' : 'OK',
    requestsToday: input.requestsToday,
    tokensToday: input.tokensToday,
    dailyRequestLimit: input.dailyRequestLimit,
    dailyTokenLimit: input.dailyTokenLimit,
  };
}

/** Returns why a new AI request must not be sent, or null when it is within budget. Limits <= 0 mean unlimited. */
export function evaluateAiBudget(input: AiBudgetInput): AiUnavailableReason | null {
  if (!input.enabled) return 'DISABLED';
  if (input.dailyRequestLimit > 0 && input.requestsToday >= input.dailyRequestLimit) {
    return 'DAILY_REQUEST_LIMIT';
  }
  if (input.dailyTokenLimit > 0 && input.tokensToday >= input.dailyTokenLimit) {
    return 'DAILY_TOKEN_LIMIT';
  }
  return null;
}
