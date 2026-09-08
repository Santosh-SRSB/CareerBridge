import { clearResumeWizardDraft } from './resume-wizard-draft';

const RESUME_UPDATE_MODE_KEY = 'cb.resumeUpdateMode';
const RESUME_UPDATE_ID_KEY = 'cb.resumeUpdateResumeId';

export function startResumeUpdate(resumeId?: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(RESUME_UPDATE_MODE_KEY, '1');
  if (resumeId) {
    sessionStorage.setItem(RESUME_UPDATE_ID_KEY, resumeId);
  } else {
    sessionStorage.removeItem(RESUME_UPDATE_ID_KEY);
  }
  clearResumeWizardDraft();
}

export function isResumeUpdateMode() {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(RESUME_UPDATE_MODE_KEY) === '1';
}

export function getResumeUpdateResumeId() {
  if (typeof window === 'undefined') return undefined;
  return sessionStorage.getItem(RESUME_UPDATE_ID_KEY) || undefined;
}

export function clearResumeUpdateMode() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(RESUME_UPDATE_MODE_KEY);
  sessionStorage.removeItem(RESUME_UPDATE_ID_KEY);
}
