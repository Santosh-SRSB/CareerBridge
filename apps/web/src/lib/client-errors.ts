export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';
export const NETWORK_ERROR_MESSAGE = 'Unable to connect. Please check your connection and try again.';
export const LOAD_ERROR_MESSAGE = "Something went wrong. We couldn't load the information.";

type ErrorLike = { message?: unknown; code?: unknown; status?: unknown } | null | undefined;

function asErrorLike(err: unknown): ErrorLike {
  return err && typeof err === 'object' ? (err as ErrorLike) : null;
}

export function errorStatus(err: unknown): number | undefined {
  const status = asErrorLike(err)?.status;
  return typeof status === 'number' ? status : undefined;
}

export function errorCode(err: unknown): string {
  const code = asErrorLike(err)?.code;
  return typeof code === 'string' ? code : '';
}

export function isNetworkError(err: unknown) {
  return errorCode(err) === 'NETWORK_ERROR';
}

export function isServerError(err: unknown) {
  const status = errorStatus(err);
  return errorCode(err) === 'SERVER_ERROR' || (typeof status === 'number' && status >= 500);
}

export function isUnauthorizedError(err: unknown) {
  return errorStatus(err) === 401;
}

/**
 * Message safe to show to users. Validation / business-rule messages (4xx) come from the API
 * and are already user-facing; server and network failures get a fixed message, optionally
 * naming the action ("Unable to schedule interview. Please try again.").
 */
export function userFacingError(err: unknown, action?: string): string {
  if (isNetworkError(err)) return NETWORK_ERROR_MESSAGE;
  if (isServerError(err) || !asErrorLike(err)?.message) {
    return action ? `Unable to ${action}. Please try again.` : GENERIC_ERROR_MESSAGE;
  }
  const message = String(asErrorLike(err)?.message || '').trim();
  if (!message || /internal server error|prisma|stack trace|ECONN|NEXT_PUBLIC_|cannot read propert/i.test(message)) {
    return action ? `Unable to ${action}. Please try again.` : GENERIC_ERROR_MESSAGE;
  }
  return message;
}

/** ERR-YYYYMMDD-XXXXXX — unique per incident, safe to show, searchable in API logs. */
export function makeErrorId(now = new Date()): string {
  const ymd = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  const bytes = new Uint8Array(6);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  for (const b of bytes) suffix += alphabet[b % alphabet.length];
  return `ERR-${ymd}-${suffix}`;
}

export function reportClientError(apiBase: string, report: { errorId: string; message?: string; digest?: string }) {
  if (!apiBase || typeof window === 'undefined') return;
  const body = JSON.stringify({
    errorId: report.errorId,
    message: (report.message || '').slice(0, 500),
    digest: (report.digest || '').slice(0, 200),
    path: window.location.pathname.slice(0, 300),
  });
  try {
    void fetch(`${apiBase}/platform/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Reporting is best effort; the id is still shown to the user and logged in the console.
  }
}
