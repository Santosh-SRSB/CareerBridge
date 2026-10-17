/** Keys that must never be copied from untrusted resume JSON into application objects. */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Parse resume contentJson without carrying prototype-pollution vectors into the result.
 * Own properties named __proto__/constructor/prototype are dropped at every object level.
 */
export function parseResumeContentJson(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return scrubDangerousKeys(parsed as Record<string, unknown>);
  } catch {
    return {};
  }
}

export function scrubDangerousKeys(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(input)) {
    if (DANGEROUS_KEYS.has(key)) continue;
    const value = input[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = scrubDangerousKeys(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? scrubDangerousKeys(item as Record<string, unknown>)
          : item,
      );
    } else {
      out[key] = value;
    }
  }
  return out;
}
