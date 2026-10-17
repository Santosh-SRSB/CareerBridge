/**
 * App-wide "return to previous screen" helper.
 * When navigating X → Y, call rememberReturnTo(X). On Y's Back, goToReturnTo(fallback).
 * SEC-FE-007: only same-origin relative app paths are stored / navigated
 * (rules aligned with safeNotificationLink — keep in sync).
 */
const RETURN_STACK_KEY = 'cb.navReturnStack';
const MAX_STACK = 12;

/** Same-origin relative path only; rejects absolute, protocol-relative, and scheme-bearing values. */
export function sanitizeReturnPath(path: unknown): string | null {
  if (typeof path !== 'string') return null;
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith('/')) return null;
  if (trimmed.startsWith('//')) return null;
  if (trimmed.includes('\\')) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed.slice(1))) return null;
  return trimmed;
}

function readStack(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(RETURN_STACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((x) => sanitizeReturnPath(x)).filter((x): x is string => Boolean(x))
      : [];
  } catch {
    return [];
  }
}

function writeStack(stack: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(RETURN_STACK_KEY, JSON.stringify(stack.slice(-MAX_STACK)));
  } catch {
    // ignore quota
  }
}

/** Remember the page the user is leaving so Back on the next page can return here. */
export function rememberReturnTo(path?: string | null) {
  if (typeof window === 'undefined') return;
  const fromArg = sanitizeReturnPath(path);
  const fromLocation = sanitizeReturnPath(
    `${window.location.pathname}${window.location.search || ''}`,
  );
  const next = fromArg || fromLocation;
  if (!next) return;
  const stack = readStack();
  if (stack[stack.length - 1] === next) return;
  stack.push(next);
  writeStack(stack);
}

/** Peek without removing. */
export function peekReturnTo(): string | null {
  const stack = readStack();
  return stack.length ? stack[stack.length - 1] : null;
}

/** Pop and return the previous path (or null). */
export function consumeReturnTo(): string | null {
  const stack = readStack();
  if (!stack.length) return null;
  const path = stack.pop() || null;
  writeStack(stack);
  return path;
}

/** Navigate to remembered return path, else fallback. */
export function goToReturnTo(
  router: { push: (href: string) => void },
  fallback = '/dashboard',
) {
  const path = consumeReturnTo();
  const dest = sanitizeReturnPath(path) || sanitizeReturnPath(fallback) || '/dashboard';
  router.push(dest);
}

/** Clear the entire return stack (e.g. after finishing a flow to dashboard). */
export function clearReturnStack() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(RETURN_STACK_KEY);
}
