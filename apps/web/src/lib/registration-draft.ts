/**
 * Registration form fields kept for "Change mobile number" on the OTP page, in this tab only.
 * Never holds the password, the OTP code or any auth token: only the fields listed in the type are written.
 */
const KEY = 'cb_registration_draft';
export const REGISTRATION_DRAFT_TTL_MS = 30 * 60 * 1000;

export type RegistrationFormDraft = {
  accountType: 'CANDIDATE' | 'EMPLOYER';
  fullName: string;
  email: string;
  dial: string;
  national: string;
  otpChannel: 'MOBILE' | 'EMAIL' | null;
  agreedToTerms: boolean;
  /** Candidate: "State|City" option value. */
  location?: string;
  /** Candidate: WhatsApp interview-notification consent. */
  whatsappOptIn?: boolean;
  /** Employer: company name as typed. */
  companyName?: string;
  /** The OTP request a resubmission replaces, so the server stops accepting a code for the old number. */
  pendingRequestId?: string;
};

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function sessionStore(): DraftStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '');

/** Copies only the allow-listed fields; anything else passed in (password, otp, tokens) is dropped. */
export function sanitizeRegistrationDraft(input: unknown): RegistrationFormDraft | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  if (raw.accountType !== 'CANDIDATE' && raw.accountType !== 'EMPLOYER') return null;
  const draft: RegistrationFormDraft = {
    accountType: raw.accountType,
    fullName: text(raw.fullName, 120),
    email: text(raw.email, 254),
    dial: text(raw.dial, 6),
    national: text(raw.national, 15).replace(/\D/g, ''),
    otpChannel: raw.otpChannel === 'MOBILE' || raw.otpChannel === 'EMAIL' ? raw.otpChannel : null,
    agreedToTerms: raw.agreedToTerms === true,
  };
  if (raw.accountType === 'CANDIDATE') {
    draft.location = text(raw.location, 120);
    draft.whatsappOptIn = raw.whatsappOptIn === true;
  } else {
    draft.companyName = text(raw.companyName, 200);
  }
  const requestId = text(raw.pendingRequestId, 64);
  if (requestId) draft.pendingRequestId = requestId;
  return draft;
}

export function saveRegistrationDraft(
  draft: RegistrationFormDraft,
  storage: DraftStorage | null = sessionStore(),
  now = Date.now(),
) {
  const safe = sanitizeRegistrationDraft(draft);
  if (!storage || !safe) return;
  try {
    storage.setItem(KEY, JSON.stringify({ ...safe, savedAt: now }));
  } catch {
    /* storage full or blocked: the form simply starts empty next time */
  }
}

/** The saved draft for this account type, or null when missing, malformed or older than the TTL. */
export function loadRegistrationDraft(
  accountType: RegistrationFormDraft['accountType'],
  storage: DraftStorage | null = sessionStore(),
  now = Date.now(),
): RegistrationFormDraft | null {
  if (!storage) return null;
  const raw = storage.getItem(KEY);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    storage.removeItem(KEY);
    return null;
  }
  const savedAt = (parsed as { savedAt?: unknown })?.savedAt;
  const draft = sanitizeRegistrationDraft(parsed);
  if (!draft || typeof savedAt !== 'number' || now - savedAt > REGISTRATION_DRAFT_TTL_MS || savedAt > now + 60_000) {
    storage.removeItem(KEY);
    return null;
  }
  return draft.accountType === accountType ? draft : null;
}

/** Records the OTP request being abandoned when the user goes back to change their number. */
export function markRegistrationDraftForChange(
  requestId: string,
  storage: DraftStorage | null = sessionStore(),
  now = Date.now(),
) {
  if (!storage) return;
  const raw = storage.getItem(KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as { accountType?: RegistrationFormDraft['accountType'] };
    const draft = parsed.accountType ? loadRegistrationDraft(parsed.accountType, storage, now) : null;
    if (draft) saveRegistrationDraft({ ...draft, pendingRequestId: requestId }, storage, now);
  } catch {
    storage.removeItem(KEY);
  }
}

export function clearRegistrationDraft(storage: DraftStorage | null = sessionStore()) {
  try {
    storage?.removeItem(KEY);
  } catch {
    /* nothing stored */
  }
}
