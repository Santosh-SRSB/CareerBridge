const RESUME_WIZARD_DRAFT_KEY = 'cb.resumeWizardDraft';
export const RESUME_WIZARD_DRAFT_VERSION = 4;

export type ResumeWizardFlowPhase = 'choose' | 'wizard' | 'preview' | 'finish';

export interface ResumeWizardDraft {
  version?: number;
  flowPhase: ResumeWizardFlowPhase;
  wizardIndex: number;
  fullName: string;
  location: string;
  email: string;
  phone: string;
  summary: string;
  skills: string[];
  educationList: unknown[];
  experienceList: unknown[];
  projectList: unknown[];
  certificationList: unknown[];
  achievementList: unknown[];
  linkedin?: string;
  github?: string;
  projectUrl?: string;
  portfolio?: string;
  gapReason?: string;
  languages: string[];
  availableLanguages: string[];
  preferredRole: string;
  preferredLocation: string;
  expectedSalary: string;
  savedAt: number;
}

function readDraftRaw(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    // Prefer localStorage so Back / reload keeps the resume until the user clears it.
    const local = localStorage.getItem(RESUME_WIZARD_DRAFT_KEY);
    if (local) return local;
    const session = sessionStorage.getItem(RESUME_WIZARD_DRAFT_KEY);
    if (session) {
      localStorage.setItem(RESUME_WIZARD_DRAFT_KEY, session);
      sessionStorage.removeItem(RESUME_WIZARD_DRAFT_KEY);
      return session;
    }
    return null;
  } catch {
    return null;
  }
}

export function loadResumeWizardDraft(): ResumeWizardDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = readDraftRaw();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ResumeWizardDraft;
    if (!parsed || typeof parsed !== 'object') return null;
    if ((parsed.version ?? 0) < RESUME_WIZARD_DRAFT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveResumeWizardDraft(draft: Omit<ResumeWizardDraft, 'savedAt' | 'version'>) {
  if (typeof window === 'undefined') return;
  try {
    const payload: ResumeWizardDraft = {
      ...draft,
      version: RESUME_WIZARD_DRAFT_VERSION,
      savedAt: Date.now(),
    };
    const raw = JSON.stringify(payload);
    localStorage.setItem(RESUME_WIZARD_DRAFT_KEY, raw);
    // Keep session copy in sync for older code paths.
    sessionStorage.setItem(RESUME_WIZARD_DRAFT_KEY, raw);
  } catch {
    // Ignore quota errors
  }
}

/** Explicit clear only — e.g. user starts a brand-new upload that replaces everything. */
export function clearResumeWizardDraft() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(RESUME_WIZARD_DRAFT_KEY);
    sessionStorage.removeItem(RESUME_WIZARD_DRAFT_KEY);
  } catch {
    // ignore
  }
}

const AUTOFILL_SEED_KEY = 'cb.resumeAutofillSeed';
const AUTOFILL_FLAG_KEY = 'cb.resumeFromAutofill';
const BUILD_FLAG_KEY = 'cb.resumeFromBuild';

export function markResumeSeedFromProfile() {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('cb.resumeFromProfile', '1');
}

export function peekResumeSeedFromProfile() {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem('cb.resumeFromProfile') === '1';
}

export function consumeResumeSeedFromProfile() {
  if (typeof window === 'undefined') return false;
  const flagged = sessionStorage.getItem('cb.resumeFromProfile') === '1';
  if (flagged) {
    sessionStorage.removeItem('cb.resumeFromProfile');
  }
  return flagged;
}

/** Seed from profile and open the wizard (skip Upload vs Build choose). Path B — Build Resume. */
export function markResumeStartWizardFromProfile() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(AUTOFILL_SEED_KEY);
  sessionStorage.removeItem(AUTOFILL_FLAG_KEY);
  sessionStorage.setItem('cb.resumeFromProfile', '1');
  sessionStorage.setItem('cb.resumeStartWizard', '1');
  sessionStorage.setItem(BUILD_FLAG_KEY, '1');
}

export function peekResumeStartWizard() {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem('cb.resumeStartWizard') === '1';
}

export function consumeResumeStartWizard() {
  if (typeof window === 'undefined') return false;
  const flagged = sessionStorage.getItem('cb.resumeStartWizard') === '1';
  if (flagged) sessionStorage.removeItem('cb.resumeStartWizard');
  return flagged;
}

/** Path B — Build Resume from scratch (wizard → ATS → Improve → Save). */
export function markResumeBuildPath() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(AUTOFILL_SEED_KEY);
  sessionStorage.removeItem(AUTOFILL_FLAG_KEY);
  sessionStorage.setItem(BUILD_FLAG_KEY, '1');
  sessionStorage.setItem('cb.resumeFromProfile', '1');
  sessionStorage.setItem('cb.resumeStartWizard', '1');
}

export function peekResumeFromBuild() {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(BUILD_FLAG_KEY) === '1';
}

export function clearResumeFromBuild() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(BUILD_FLAG_KEY);
  sessionStorage.removeItem('cb.resumeStartWizard');
  sessionStorage.removeItem('cb.resumeFromProfile');
}

/**
 * Store wizard seed from uploaded resume and open /resume wizard.
 * Does NOT wipe an existing draft until the seed is applied on /resume —
 * so Back from the finish screen keeps filled data when returning.
 */
export function markResumeAutofillSeed(input: {
  seed: Omit<ResumeWizardDraft, 'savedAt' | 'version' | 'flowPhase' | 'wizardIndex'>;
  resumeId?: string;
}) {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(BUILD_FLAG_KEY);
  sessionStorage.setItem('cb.resumeReplaceDraft', '1');
  sessionStorage.setItem(
    AUTOFILL_SEED_KEY,
    JSON.stringify({
      ...input.seed,
      resumeId: input.resumeId || null,
      highlightMissing: true,
    }),
  );
  sessionStorage.setItem(AUTOFILL_FLAG_KEY, '1');
  sessionStorage.setItem('cb.resumeStartWizard', '1');
}

export function peekResumeFromAutofill() {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(AUTOFILL_FLAG_KEY) === '1';
}

export function peekResumeAutofillSeed():
  | (Omit<ResumeWizardDraft, 'savedAt' | 'version' | 'flowPhase' | 'wizardIndex'> & {
      resumeId?: string | null;
      highlightMissing?: boolean;
    })
  | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(AUTOFILL_SEED_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Clear only the seed payload after it has been copied into the wizard draft.
 * Keep `cb.resumeFromAutofill` so React Strict Mode remounts still open the wizard
 * (instead of falling through to the Choose screen).
 */
export function clearResumeAutofillSeed() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(AUTOFILL_SEED_KEY);
}

/** Clear the autofill navigation flag once the user leaves the autofill flow. */
export function clearResumeFromAutofill() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(AUTOFILL_FLAG_KEY);
  sessionStorage.removeItem('cb.resumeStartWizard');
}
