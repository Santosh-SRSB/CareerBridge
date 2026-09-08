export const UserType = {
  CANDIDATE: 'CANDIDATE',
  EMPLOYER_ADMIN: 'EMPLOYER_ADMIN',
  EMPLOYER_RECRUITER: 'EMPLOYER_RECRUITER',
  SUPER_ADMIN: 'SUPER_ADMIN',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  PLATFORM_OPERATOR: 'PLATFORM_OPERATOR',
} as const;

export type UserType = (typeof UserType)[keyof typeof UserType];

export const AuthPurpose = {
  LOGIN: 'LOGIN',
  REGISTER: 'REGISTER',
  RESET_PASSWORD: 'RESET_PASSWORD',
} as const;

export type AuthPurpose = (typeof AuthPurpose)[keyof typeof AuthPurpose];

export const OtpChannel = {
  MOBILE: 'MOBILE',
  EMAIL: 'EMAIL',
} as const;

export type OtpChannel = (typeof OtpChannel)[keyof typeof OtpChannel];

/** Candidate / employer portals only — never platform roles. */
export type AccountKind = 'CANDIDATE' | 'EMPLOYER';

/** Password login portal — Super Admin and Admin are separate. */
export type LoginAccountType = AccountKind | 'SUPER_ADMIN' | 'ADMIN';

export const PLATFORM_USER_TYPES = [
  UserType.SUPER_ADMIN,
  UserType.PLATFORM_ADMIN,
  UserType.PLATFORM_OPERATOR,
] as const;

export type PlatformUserType = (typeof PLATFORM_USER_TYPES)[number];

export function isPlatformUserType(role: string | null | undefined): role is PlatformUserType {
  return (
    role === UserType.SUPER_ADMIN ||
    role === UserType.PLATFORM_ADMIN ||
    role === UserType.PLATFORM_OPERATOR
  );
}

export function isSuperAdminType(role: string | null | undefined) {
  return role === UserType.SUPER_ADMIN;
}

export function isAdminStaffType(role: string | null | undefined) {
  return role === UserType.PLATFORM_ADMIN || role === UserType.PLATFORM_OPERATOR;
}

export type AuthUser = {
  id: string;
  role: UserType;
  phone: string;
  firstName: string | null;
  onboardingCompleted: boolean;
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
  email?: string;
  phone?: string;
  fullName: string;
  location?: string;
  state?: string;
  city?: string;
  preferredLanguage?: string;
  accountType?: 'CANDIDATE' | 'EMPLOYER';
  companyName?: string;
  industry?: string;
  /** Explicit consent for WhatsApp interview notifications. */
  whatsappOptIn?: boolean;
};

export type RequestOtpPayload = {
  phone?: string;
  email?: string;
  channel: OtpChannel;
  purpose: AuthPurpose;
  fullName?: string;
  location?: string;
  state?: string;
  city?: string;
  preferredLanguage?: string;
  password?: string;
  accountType?: 'CANDIDATE' | 'EMPLOYER';
  companyName?: string;
  industry?: string;
  whatsappOptIn?: boolean;
};

export const REGISTRATION_PASSWORD_HINT =
  'At least 8 characters, 1 uppercase letter, 1 number, and 1 special character (!@#$%^&*).';

export function registrationPasswordError(password: string): string | null {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must include at least one number.';
  }
  if (!/[!@#$%^&*()_\-+=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    return 'Password must include at least one special character.';
  }
  return null;
}

export const REGISTRATION_PASSWORD_PATTERN =
  /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_\-+=[\]{};':"\\|,.<>/?`~]).{8,}$/;

/** Stronger rules for Super Admin / Admin accounts. */
export function platformPasswordError(password: string): string | null {
  if (!password || password.length < 12) {
    return 'Admin password must be at least 12 characters.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Admin password must include an uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Admin password must include a lowercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Admin password must include a number.';
  }
  return null;
}

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

export type PlatformAdminRecord = {
  id: string;
  email: string | null;
  phone: string;
  userType: PlatformUserType;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
};
