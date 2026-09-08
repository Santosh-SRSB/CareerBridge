const RESUME_WIZARD_DRAFT_KEY = 'cb.resumeWizardDraft';
export const RESUME_WIZARD_DRAFT_VERSION = 2;

export type ResumeWizardFlowPhase = 'choose' | 'wizard' | 'preview';

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
  languages: string[];
  availableLanguages: string[];
  preferredRole: string;
  preferredLocation: string;
  expectedSalary: string;
  savedAt: number;
}

export function loadResumeWizardDraft(): ResumeWizardDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(RESUME_WIZARD_DRAFT_KEY);
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
    sessionStorage.setItem(RESUME_WIZARD_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota errors
  }
}

export function clearResumeWizardDraft() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(RESUME_WIZARD_DRAFT_KEY);
}

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
    clearResumeWizardDraft();
  }
  return flagged;
}

/** Seed from profile and open the wizard (skip Upload vs Build choose). */
export function markResumeStartWizardFromProfile() {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('cb.resumeFromProfile', '1');
  sessionStorage.setItem('cb.resumeStartWizard', '1');
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
