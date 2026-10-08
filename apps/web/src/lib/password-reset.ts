import type { LoginAccountType } from '@careerbridge/shared';
import { resetPassword } from './api';

/** The sign-in page shows "Password updated" for `reset=1`. */
export function passwordResetDoneHref(role: LoginAccountType) {
  return `/login?role=${role.toLowerCase()}&reset=1`;
}

/**
 * Sets the new password with the emailed OTP and returns where to go next. A 2xx is the success signal;
 * the response body (`{ message }`) is informational and is not read, so a body-shape change cannot turn a
 * completed reset into an error after the password has already been changed.
 */
export async function submitPasswordReset(payload: Parameters<typeof resetPassword>[0]) {
  await resetPassword(payload);
  return passwordResetDoneHref(payload.accountType);
}
