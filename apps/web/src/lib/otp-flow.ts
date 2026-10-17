import type { AuthPurpose, OtpChannel, RegistrationDraft } from '@careerbridge/shared';

const KEY = 'cb_otp_flow';

export type OtpFlow = {
  requestId: string;
  phone: string;
  email?: string;
  channel: OtpChannel;
  purpose: AuthPurpose;
  expiresAt: number;
  registration?: RegistrationDraft;
};

export function saveOtpFlow(flow: OtpFlow) {
  sessionStorage.setItem(KEY, JSON.stringify(flow));
}

export function getOtpFlow(): OtpFlow | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OtpFlow;
  } catch {
    return null;
  }
}

export function clearOtpFlow() {
  sessionStorage.removeItem(KEY);
}
