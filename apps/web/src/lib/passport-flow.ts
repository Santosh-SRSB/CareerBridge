import type { PassportSectionKey } from '@careerbridge/shared';
import { PASSPORT_SECTION_COPY } from '@careerbridge/shared';

export const PASSPORT_WIZARD_KEYS: PassportSectionKey[] = [
  'personal',
  'photo',
  'education',
  'skills',
  'experience',
  'preferences',
  'languages',
  'certifications',
  'projects',
  'links',
];

export const PASSPORT_FLOW_START = '/profile';
export const PASSPORT_OVERVIEW = '/profile';
export const PASSPORT_PREVIEW = '/passport/preview';
export const FLOW_DONE_KEY = 'cb.passportFlowDone';

export function isPassportFlowDone(userId?: string | null) {
  if (typeof window === 'undefined' || !userId) return false;
  return window.localStorage.getItem(`${FLOW_DONE_KEY}:${userId}`) === '1';
}

export function markPassportFlowDone(userId: string) {
  window.localStorage.setItem(`${FLOW_DONE_KEY}:${userId}`, '1');
}

export function wizardStepIndex(key: PassportSectionKey) {
  return PASSPORT_WIZARD_KEYS.indexOf(key);
}

export function nextPassportPath(_afterKey?: PassportSectionKey) {
  return PASSPORT_OVERVIEW;
}

export function passportStepHref(key: PassportSectionKey) {
  return PASSPORT_SECTION_COPY[key].href;
}

export function previousPassportPath(_key: PassportSectionKey) {
  return PASSPORT_OVERVIEW;
}

export function goToNextPassportStep(router: { replace: (href: string) => void }, _afterKey?: PassportSectionKey) {
  router.replace(PASSPORT_OVERVIEW);
}
