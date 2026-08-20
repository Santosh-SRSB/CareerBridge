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

export const PASSPORT_FLOW_START = '/passport/personal?flow=1';
export const PASSPORT_OVERVIEW = '/passport?overview=1';

export function wizardStepIndex(key: PassportSectionKey) {
  return PASSPORT_WIZARD_KEYS.indexOf(key);
}

export function nextPassportPath(afterKey?: PassportSectionKey) {
  if (!afterKey) return PASSPORT_FLOW_START;
  const nextKey = PASSPORT_WIZARD_KEYS[wizardStepIndex(afterKey) + 1];
  return nextKey ? `${PASSPORT_SECTION_COPY[nextKey].href}?flow=1` : PASSPORT_OVERVIEW;
}

export function passportStepHref(key: PassportSectionKey) {
  return `${PASSPORT_SECTION_COPY[key].href}?flow=1`;
}

export function previousPassportPath(key: PassportSectionKey) {
  const index = wizardStepIndex(key);
  if (index <= 0) return '/dashboard';
  const prevKey = PASSPORT_WIZARD_KEYS[index - 1];
  return passportStepHref(prevKey);
}

export function goToNextPassportStep(
  router: { replace: (href: string) => void },
  afterKey?: PassportSectionKey,
) {
  router.replace(nextPassportPath(afterKey));
}
