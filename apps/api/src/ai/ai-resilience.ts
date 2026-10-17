import type { AiUnavailableReason } from '@careerbridge/shared';

export type AiErrorKind = 'UPSTREAM_UNAVAILABLE' | 'TIMEOUT' | 'INVALID_OUTPUT' | 'FAILED';

export function classifyAiError(err: unknown): AiErrorKind {
  const status = (err as { status?: number; code?: number })?.status ?? (err as { code?: number })?.code;
  const name = (err as { name?: string })?.name || '';
  const message = err instanceof Error ? err.message : String(err ?? '');
  if (name === 'AbortError' || name === 'TimeoutError' || /\babort(ed)?\b|timed? ?out/i.test(message)) {
    return 'TIMEOUT';
  }
  if (
    status === 503 ||
    status === 429 ||
    /\b503\b|\b429\b|UNAVAILABLE|high demand|overloaded|RESOURCE_EXHAUSTED|rate limit/i.test(message)
  ) {
    return 'UPSTREAM_UNAVAILABLE';
  }
  if (/invalid JSON|truncated/i.test(message)) return 'INVALID_OUTPUT';
  return 'FAILED';
}

export function unavailableReasonFor(kind: AiErrorKind): AiUnavailableReason {
  if (kind === 'UPSTREAM_UNAVAILABLE') return 'UPSTREAM_UNAVAILABLE';
  if (kind === 'TIMEOUT') return 'TIMEOUT';
  return 'FAILED';
}

/**
 * After the provider reports an outage (503 / 429) or times out, stop calling it for a cooldown
 * window so a known outage is not retried on every request.
 */
export class AiCircuitBreaker {
  private openUntil = 0;
  private reason: AiUnavailableReason | null = null;

  constructor(
    private readonly cooldownMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  open(reason: AiUnavailableReason): void {
    this.openUntil = this.now() + this.cooldownMs;
    this.reason = reason;
  }

  close(): void {
    this.openUntil = 0;
    this.reason = null;
  }

  /** The reason while open, otherwise null. */
  current(): AiUnavailableReason | null {
    if (this.openUntil && this.now() < this.openUntil) return this.reason;
    if (this.openUntil) this.close();
    return null;
  }
}

/** A signal that aborts when the parent aborts or the timeout elapses. Call dispose() when done. */
export function linkedAbort(parent: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const onParentAbort = () => controller.abort(parent?.reason ?? new Error('AI request aborted'));
  if (parent?.aborted) onParentAbort();
  else parent?.addEventListener('abort', onParentAbort, { once: true });
  const timer =
    timeoutMs > 0
      ? setTimeout(() => {
          const err = new Error(`AI request timed out after ${timeoutMs} ms`);
          err.name = 'TimeoutError';
          controller.abort(err);
        }, timeoutMs)
      : null;
  return {
    signal: controller.signal,
    dispose: () => {
      if (timer) clearTimeout(timer);
      parent?.removeEventListener('abort', onParentAbort);
    },
  };
}

/** Rejects with the abort reason as soon as the signal aborts, even if the SDK ignores the signal. */
export function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError(signal));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError(signal));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      },
    );
  });
}

function abortError(signal: AbortSignal): Error {
  const reason = signal.reason;
  if (reason instanceof Error) return reason;
  const err = new Error('AI request aborted');
  err.name = 'AbortError';
  return err;
}
