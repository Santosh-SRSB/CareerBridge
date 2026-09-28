import type { ApiError } from '@/lib/api';

export type InterviewLoadErrorKind = 'unauthenticated' | 'forbidden' | 'not_found' | 'network' | 'unknown';

export type InterviewLoadError = { kind: InterviewLoadErrorKind; message: string };

/** Map a failed interview fetch to a user-facing state. Permanent errors (401/403/404) must not be retried. */
export function classifyInterviewLoadError(err: unknown): InterviewLoadError {
  const error = (err || {}) as Partial<ApiError>;
  const status = error.status;
  const code = error.code;
  if (status === 401 || code === 'UNAUTHORIZED') {
    return { kind: 'unauthenticated', message: 'Your session has expired. Please log in again to view this interview.' };
  }
  if (status === 403 || code === 'FORBIDDEN') {
    return { kind: 'forbidden', message: 'You do not have access to this interview.' };
  }
  if (status === 404 || status === 400 || code === 'RESOURCE_NOT_FOUND' || code === 'VALIDATION_ERROR') {
    return {
      kind: 'not_found',
      message: 'We could not find this interview. The link may be incorrect or the interview is no longer available.',
    };
  }
  if (status == null && error.message && /cannot reach/i.test(error.message)) {
    return { kind: 'network', message: 'We could not reach CareerBridge. Check your connection and try again.' };
  }
  return { kind: 'unknown', message: error.message || 'Could not load this interview. Please try again.' };
}

export function isPermanentInterviewLoadError(err: unknown) {
  const kind = classifyInterviewLoadError(err).kind;
  return kind === 'unauthenticated' || kind === 'forbidden' || kind === 'not_found';
}
