/**
 * SEC-LOG-008 — scrub credential-like material from client-error intake before logging.
 * Keeps diagnostics useful while preventing pasted Bearer/JWT/API keys from landing in logs.
 */

const REDACTED = '[REDACTED]';

/** Authorization header forms and standalone Bearer tokens. */
const BEARER =
  /\b(?:Authorization\s*[:=]\s*)?Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;

/** Compact JWT-shaped strings (three base64url segments). */
const JWT =
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;

/** Common API key / secret assignment patterns pasted into error reports. */
const API_KEYISH =
  /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|private[_-]?key)\s*[:=]\s*['"]?[^\s'"]+/gi;

const GOOGLE_OR_OPENAI =
  /\b(?:AIza[0-9A-Za-z_-]{10,}|sk-[0-9A-Za-z]{10,})\b/g;

const PEM_BLOCK = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;

export function sanitizeClientErrorField(value?: string | null, maxLen = 500): string {
  let out = (value || '').replace(/[\r\n]+/g, ' ').trim();
  if (!out) return '';
  out = out.replace(PEM_BLOCK, REDACTED);
  out = out.replace(BEARER, `Bearer ${REDACTED}`);
  out = out.replace(JWT, REDACTED);
  out = out.replace(GOOGLE_OR_OPENAI, REDACTED);
  out = out.replace(API_KEYISH, REDACTED);
  if (out.length > maxLen) out = out.slice(0, maxLen);
  return out;
}

export function formatClientErrorLogLine(input: {
  errorId: string;
  path?: string;
  digest?: string;
  message?: string;
}): string {
  return (
    `errorId=${input.errorId}` +
    ` path=${sanitizeClientErrorField(input.path, 300)}` +
    ` digest=${sanitizeClientErrorField(input.digest, 200)}` +
    ` message=${sanitizeClientErrorField(input.message, 500)}`
  );
}
