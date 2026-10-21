import type { AuthSession, VerifyOtpResult } from '@careerbridge/shared';
import { POST_REGISTRATION_PATH } from './onboarding-flow';
import { postAuthPath } from './phone';

export const CANDIDATE_REGISTERED_TOAST = 'Account created. You are signed in.';

export type PostOtpAuthAction =
  | { type: 'authenticated'; session: AuthSession; path: string; toast?: string }
  | { type: 'sign-in-required'; path: string }
  | { type: 'invalid' };

export function isAuthSession(result: VerifyOtpResult | null | undefined): result is AuthSession {
  return Boolean(
    result &&
      typeof result === 'object' &&
      'accessToken' in result &&
      typeof result.accessToken === 'string' &&
      result.accessToken &&
      'refreshToken' in result &&
      typeof result.refreshToken === 'string' &&
      result.refreshToken &&
      'user' in result &&
      result.user,
  );
}

/**
 * Decide where OTP verification should send the user.
 * Candidate registration must reuse the issued session (no second password prompt).
 * Employer registration still requires a separate sign-in.
 */
export function resolvePostOtpAuthAction(
  result: VerifyOtpResult | null | undefined,
  purpose: 'LOGIN' | 'REGISTER' | 'RESET_PASSWORD',
  accountType?: 'CANDIDATE' | 'EMPLOYER',
): PostOtpAuthAction {
  if (result && typeof result === 'object' && 'signInRequired' in result && result.signInRequired) {
    const role = accountType === 'CANDIDATE' ? 'candidate' : 'employer';
    return { type: 'sign-in-required', path: `/login?registered=1&role=${role}` };
  }
  if (!isAuthSession(result)) {
    return { type: 'invalid' };
  }
  if (purpose === 'REGISTER') {
    if (
      accountType === 'EMPLOYER' ||
      result.user.role === 'EMPLOYER_ADMIN' ||
      result.user.role === 'EMPLOYER_RECRUITER'
    ) {
      return { type: 'authenticated', session: result, path: '/employer' };
    }
    return {
      type: 'authenticated',
      session: result,
      path: POST_REGISTRATION_PATH,
      toast: CANDIDATE_REGISTERED_TOAST,
    };
  }
  return {
    type: 'authenticated',
    session: result,
    path: postAuthPath(result.user),
  };
}
