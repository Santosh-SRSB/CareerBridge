import { clearResumeWizardDraft } from './resume-wizard-draft';

const RESUME_UPDATE_MODE_KEY = 'cb.resumeUpdateMode';
const RESUME_UPDATE_ID_KEY = 'cb.resumeUpdateResumeId';

/** ATS dashboard → edit one section → return to ATS (does not restart creation wizard). */
const ATS_SECTION_EDIT_KEY = 'cb.atsSectionEdit';

export type AtsSectionEditState = {
  sectionKey: string;
  resumeId?: string;
  /** Where to return after Save & recheck ATS */
  returnTo: 'preview' | 'ats';
};

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

export function startAtsSectionEdit(state: AtsSectionEditState) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(ATS_SECTION_EDIT_KEY, JSON.stringify(state));
}

export function peekAtsSectionEdit(): AtsSectionEditState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(ATS_SECTION_EDIT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AtsSectionEditState;
    if (!parsed?.sectionKey) return null;
    return {
      sectionKey: String(parsed.sectionKey),
      resumeId: parsed.resumeId || undefined,
      returnTo: parsed.returnTo === 'ats' ? 'ats' : 'preview',
    };
  } catch {
    return null;
  }
}

export function clearAtsSectionEdit() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(ATS_SECTION_EDIT_KEY);
}

/** Map ATS section keys / labels → wizard step names used by /resume. */
export function mapAtsSectionToWizardStep(sectionKeyOrLabel: string): string {
  const key = sectionKeyOrLabel.toLowerCase();
  if (key === 'education' || key.includes('educat')) return 'Education';
  if (key === 'experience' || key.includes('experience') || key.includes('work')) return 'Experience';
  if (key === 'skills' || key.includes('skill')) return 'Skills';
  if (key === 'projects' || key.includes('project')) return 'Projects';
  if (key === 'certifications' || key.includes('cert') || key.includes('achiev')) return 'Certifications';
  if (key === 'formatting' || key.includes('format')) return 'Review';
  if (key === 'summary' || key.includes('summary')) return 'Personal';
  if (key === 'contact' || key.includes('contact')) return 'Personal';
  return 'Personal';
}

export function atsEditActionLabel(sectionKey: string, sectionLabel: string): string {
  switch (sectionKey) {
    case 'contact':
      return 'Edit Contact Details';
    case 'summary':
      return 'Edit Professional Summary';
    case 'skills':
      return 'Edit Skills';
    case 'experience':
      return 'Edit Experience';
    case 'education':
      return 'Edit Education';
    case 'projects':
      return 'Edit Projects';
    case 'certifications':
      return 'Edit Certifications';
    case 'formatting':
      return 'Fix Formatting';
    default:
      return `Edit ${sectionLabel}`;
  }
}
