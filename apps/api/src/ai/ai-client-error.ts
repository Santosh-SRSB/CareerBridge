/**
 * Strip credential-like material from AI errors / structured outputs before clients see them.
 * Keep messages short and non-sensitive; never echo API keys or PEM blocks.
 */
const SENSITIVE =
  /AIza[0-9A-Za-z_-]{10,}|sk-[0-9A-Za-z]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|GEMINI_API_KEY\s*[=:]\s*\S+|GOOGLE_API_KEY\s*[=:]\s*\S+|api[_-]?key\s*[=:]\s*['"]?[^\s'"]+/i;

export function containsSensitiveAiMaterial(text: string | null | undefined): boolean {
  return Boolean(text && SENSITIVE.test(text));
}

export function sanitizeAiClientError(message: string | null | undefined): string {
  const raw = (message || '').trim();
  if (!raw) return 'AI request failed.';
  if (SENSITIVE.test(raw)) return 'AI request failed.';
  return raw.slice(0, 240);
}

/** Deep-scrub string leaves in structured AI JSON so prompt-injection bait cannot exfiltrate keys. */
export function scrubSensitiveAiValue<T>(value: T): T {
  if (typeof value === 'string') {
    return (SENSITIVE.test(value) ? '[REDACTED]' : value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubSensitiveAiValue(item)) as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = scrubSensitiveAiValue(child);
    }
    return out as T;
  }
  return value;
}
