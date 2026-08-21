export const COUNTRIES = [
  { code: 'IN', dial: '+91', name: 'India', maxLength: 10 },
  { code: 'AE', dial: '+971', name: 'UAE', maxLength: 9 },
  { code: 'SG', dial: '+65', name: 'Singapore', maxLength: 8 },
  { code: 'US', dial: '+1', name: 'United States', maxLength: 10 },
] as const;

export const DEFAULT_COUNTRY = COUNTRIES[0];

export function toE164(dial: string, national: string) {
  const digits = national.replace(/\D/g, '');
  return `${dial}${digits}`;
}

export function isValidNational(maxLength: number, national: string) {
  const digits = national.replace(/\D/g, '');
  return digits.length === maxLength;
}

export function formatPhoneDisplay(e164: string) {
  if (e164.startsWith('+91') && e164.length === 13) {
    return `+91 ${e164.slice(3, 8)} ${e164.slice(8)}`;
  }
  return e164;
}

export function postAuthPath(user: {
  role?: string;
  firstName?: string | null;
  onboardingCompleted: boolean;
}) {
  if (user.role === 'EMPLOYER_ADMIN' || user.role === 'EMPLOYER_RECRUITER') {
    return '/employer';
  }
  if (user.role === 'PLATFORM_ADMIN' || user.role === 'PLATFORM_OPERATOR') {
    return '/admin';
  }
  return '/dashboard';
}
