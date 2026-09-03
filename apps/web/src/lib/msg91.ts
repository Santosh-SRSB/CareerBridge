import { isDevOtpEnabled } from './firebase';

/** Mobile OTP is delivered by MSG91 SMS from the API (not Firebase). */
export function isMsg91MobileOtpEnabled() {
  return process.env.NEXT_PUBLIC_MSG91_OTP === 'true';
}

/** Verify mobile OTP with the CareerBridge API (4-digit MSG91 code), not Firebase idToken. */
export function usesServerMobileOtp() {
  return isDevOtpEnabled() || isMsg91MobileOtpEnabled();
}
