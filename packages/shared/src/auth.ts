export const UserType = {
  CANDIDATE: 'CANDIDATE',
  EMPLOYER_ADMIN: 'EMPLOYER_ADMIN',
  EMPLOYER_RECRUITER: 'EMPLOYER_RECRUITER',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  PLATFORM_OPERATOR: 'PLATFORM_OPERATOR',
} as const;

export type UserType = (typeof UserType)[keyof typeof UserType];

export const AuthPurpose = {
  LOGIN: 'LOGIN',
  REGISTER: 'REGISTER',
} as const;

export type AuthPurpose = (typeof AuthPurpose)[keyof typeof AuthPurpose];

export const OtpChannel = {
  MOBILE: 'MOBILE',
  EMAIL: 'EMAIL',
} as const;

export type OtpChannel = (typeof OtpChannel)[keyof typeof OtpChannel];

export type AccountKind = 'CANDIDATE' | 'EMPLOYER';

export type AuthUser = {
  id: string;
  role: UserType;
  phone: string;
  firstName: string | null;
  onboardingCompleted: boolean;
  employerVerificationStatus?: import('./marketplace').EmployerVerificationStatus | null;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthUser;
};

export const PREFERRED_LANGUAGES = [
  'English',
  'Hindi',
  'Tamil',
  'Telugu',
  'Kannada',
  'Malayalam',
  'Marathi',
  'Bengali',
  'Gujarati',
] as const;

export type PreferredLanguage = (typeof PREFERRED_LANGUAGES)[number];

export const LANGUAGE_LEVELS = ['Basic', 'Conversational', 'Professional', 'Fluent', 'Native'] as const;

export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number];

export type LanguageSkill = {
  name: string;
  level: string;
};

export function parseLanguageSkills(value: string | null | undefined): LanguageSkill[] {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
      if (match) return { name: match[1].trim(), level: match[2].trim() };
      return { name: item, level: '' };
    });
}

export function serializeLanguageSkills(items: LanguageSkill[]) {
  return items
    .map((item) => (item.level ? `${item.name} (${item.level})` : item.name))
    .join(', ');
}

export function formatLanguageSkill(item: LanguageSkill) {
  return item.level ? `${item.name} · ${item.level}` : item.name;
}

export type RegistrationDraft = {
  email: string;
  fullName: string;
  location: string;
  preferredLanguage?: string;
  accountType?: 'CANDIDATE' | 'EMPLOYER';
  companyName?: string;
  industry?: string;
};

export type RequestOtpPayload = {
  phone?: string;
  email?: string;
  channel: OtpChannel;
  purpose: AuthPurpose;
  fullName?: string;
  location?: string;
  preferredLanguage?: string;
  password?: string;
  accountType?: 'CANDIDATE' | 'EMPLOYER';
  companyName?: string;
  industry?: string;
};

export const REGISTRATION_PASSWORD_HINT =
  'At least 8 characters, 1 uppercase letter, letters and numbers only. No special characters.';

export function registrationPasswordError(password: string): string | null {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (/[^A-Za-z0-9]/.test(password)) {
    return 'Password cannot contain special characters.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter.';
  }
  return null;
}

export const REGISTRATION_PASSWORD_PATTERN = /^(?=.*[A-Z])[A-Za-z0-9]{8,}$/;

export type RequestOtpResult = {
  requestId: string;
  expiresIn: number;
  devOtp?: string;
};

export type VerifyOtpPayload = {
  requestId: string;
  idToken?: string;
  otp?: string;
};

export type VerifyOtpResult = AuthSession | { registered: true; signInRequired: true };
