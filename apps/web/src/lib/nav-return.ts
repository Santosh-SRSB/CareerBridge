/**
 * App-wide "return to previous screen" helper.
 * When navigating X → Y, call rememberReturnTo(X). On Y's Back, goToReturnTo(fallback).
 */
const RETURN_STACK_KEY = 'cb.navReturnStack';
const MAX_STACK = 12;

function readStack(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(RETURN_STACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string' && x.startsWith('/')) : [];
  } catch {
    return [];
  }
}

function writeStack(stack: string[]) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(RETURN_STACK_KEY, JSON.stringify(stack.slice(-MAX_STACK)));
  } catch {
    // ignore quota
  }
}

/** Remember the page the user is leaving so Back on the next page can return here. */
export function rememberReturnTo(path?: string | null) {
  if (typeof window === 'undefined') return;
  const next =
    (path && path.startsWith('/') ? path : null) ||
    `${window.location.pathname}${window.location.search || ''}`;
  if (!next.startsWith('/')) return;
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
  router.push(path || fallback);
}

/** Clear the entire return stack (e.g. after finishing a flow to dashboard). */
export function clearReturnStack() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(RETURN_STACK_KEY);
}
