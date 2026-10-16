import { randomUUID } from 'crypto';

/** RFC 4122 UUID shape used for HTTP correlation ids (opaque, non-sensitive). */
const REQUEST_ID_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Resolves a correlation id from an optional client `x-request-id` value.
 * Accepts only a single well-formed UUID; otherwise generates a server UUID.
 * Rejects arrays, CR/LF, whitespace, and over-length values so they cannot
 * spoof logs or response correlation fields.
 */
export function resolveRequestId(raw: unknown): string {
  const candidate = firstHeaderValue(raw);
  if (candidate && REQUEST_ID_UUID.test(candidate)) {
    return candidate.toLowerCase();
  }
  return randomUUID();
}

/**
 * Correlation id for optional persistence (AI interactions, etc.).
 * Absent/empty → null (do not invent an id). Present → same rules as resolveRequestId
 * so hostile/malformed values cannot be stored or logged as-is.
 */
export function sanitizePersistedRequestId(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === 'string' && raw.trim() === '') return null;
  if (Array.isArray(raw) && raw.length === 0) return null;
  return resolveRequestId(raw);
}

function firstHeaderValue(raw: unknown): string | null {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0];
  return null;
}
