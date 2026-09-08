import { parseCityState } from '@/data/india-locations';

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return /^[6-9]\d{9}$/.test(digits);
  if (digits.length === 12 && digits.startsWith('91')) return /^91[6-9]\d{9}$/.test(digits);
  return false;
}

export function hasValidLocation(location: string): boolean {
  const { city, state } = parseCityState(location);
  return Boolean(city && state);
}

export interface WizardStepValidationInput {
  fullName: string;
  location: string;
  email: string;
  phone: string;
  skills: string[];
  educationList: unknown[];
  languages: string[];
  preferredRole: string;
}

export function validateWizardStep(step: string, input: WizardStepValidationInput): string[] {
  const errors: string[] = [];

  switch (step) {
    case 'Personal': {
      if (!input.fullName.trim()) errors.push('Full name is required.');
      if (!hasValidLocation(input.location)) {
        errors.push('Select both state and city.');
      }
      if (!input.email.trim()) {
        errors.push('Email is required.');
      } else if (!isValidEmail(input.email)) {
        errors.push('Enter a valid email address.');
      }
      if (!input.phone.trim()) {
        errors.push('Phone number is required.');
      } else if (!isValidPhone(input.phone)) {
        errors.push('Enter a valid 10-digit Indian mobile number.');
      }
      break;
    }
    case 'Education':
      if (input.educationList.length === 0) {
        errors.push('Add at least one education entry.');
      }
      break;
    case 'Skills':
      if (input.skills.length === 0) {
        errors.push('Add at least one skill.');
      }
      break;
    case 'Languages':
      if (input.languages.length === 0) {
        errors.push('Select at least one language.');
      }
      break;
    case 'Preferences':
      if (!input.preferredRole.trim()) {
        errors.push('Preferred role is required.');
      }
      break;
    default:
      break;
  }

  return errors;
}
