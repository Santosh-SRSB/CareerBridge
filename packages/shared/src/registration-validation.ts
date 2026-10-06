import { registrationPasswordError } from './auth';
import { validateEmailAddress } from './validation';

export type RegistrationOtpChannel = 'MOBILE' | 'EMAIL' | null;

export type CandidateRegistrationInput = {
  fullName: string;
  national: string;
  mobileLength: number;
  email: string;
  password: string;
  confirmPassword: string;
  otpChannel: RegistrationOtpChannel;
  agreedToTerms: boolean;
};

export type CandidateRegistrationErrors = Partial<
  Record<'fullName' | 'mobile' | 'email' | 'password' | 'confirmPassword' | 'otpChannel' | 'terms', string>
>;

const NAME_PATTERN = /^[a-zA-Z\s.'-]+$/;
export const COMPANY_NAME_MAX = 100;

export function registrationNameError(value: string, shortMessage = 'Please enter your full name'): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return 'Name is required';
  if (trimmed.length < 2) return shortMessage;
  if (!NAME_PATTERN.test(trimmed)) return 'Name should only contain letters and spaces.';
  return undefined;
}

export function registrationMobileError(
  national: string,
  length: number,
  emptyMessage = 'Mobile number is required',
): string | undefined {
  if (!national) return emptyMessage;
  if (/\D/.test(national)) return 'Mobile number must contain digits only';
  if (national.length !== length) return `Please enter a valid ${length}-digit mobile number`;
  return undefined;
}

export function validateCandidateRegistration(input: CandidateRegistrationInput): CandidateRegistrationErrors {
  const errors: CandidateRegistrationErrors = {};
  const name = registrationNameError(input.fullName);
  if (name) errors.fullName = name;
  const mobile = registrationMobileError(input.national, input.mobileLength);
  if (mobile) errors.mobile = mobile;
  const email = input.email.trim();
  if (email) {
    if (validateEmailAddress(email, true)) errors.email = 'Please enter a valid email address';
  } else if (input.otpChannel === 'EMAIL') {
    errors.email = 'Email is required to receive the OTP by email.';
  }
  const password = registrationPasswordError(input.password);
  if (password) errors.password = password;
  if (!input.confirmPassword) errors.confirmPassword = 'Please confirm your password.';
  else if (input.confirmPassword !== input.password) errors.confirmPassword = 'Passwords do not match.';
  if (!input.otpChannel) errors.otpChannel = 'Select Mobile OTP or Email OTP.';
  if (!input.agreedToTerms) errors.terms = 'You must accept the Terms and Privacy Policy to continue';
  return errors;
}

export type EmployerRegistrationInput = {
  yourName: string;
  companyName: string;
  workEmail: string;
  national: string;
  mobileLength: number;
  password: string;
  confirmPassword: string;
  otpChannel: RegistrationOtpChannel;
  agreedToTerms: boolean;
};

export type EmployerRegistrationErrors = Partial<
  Record<
    'yourName' | 'companyName' | 'workEmail' | 'mobile' | 'password' | 'confirmPassword' | 'otpChannel' | 'terms',
    string
  >
>;

export function validateEmployerRegistration(input: EmployerRegistrationInput): EmployerRegistrationErrors {
  const errors: EmployerRegistrationErrors = {};
  const name = registrationNameError(input.yourName, 'Please enter a valid name');
  if (name) errors.yourName = name;
  const company = input.companyName.trim();
  if (!company) errors.companyName = 'Company name is required';
  else if (company.length < 2) errors.companyName = 'Company name must be at least 2 characters.';
  else if (company.length > COMPANY_NAME_MAX) {
    errors.companyName = `Company name must be ${COMPANY_NAME_MAX} characters or less.`;
  }
  const email = input.workEmail.trim();
  if (!email || validateEmailAddress(email, true)) errors.workEmail = 'Please enter a valid work email address';
  const mobile = registrationMobileError(
    input.national,
    input.mobileLength,
    `Please enter a valid ${input.mobileLength}-digit mobile number`,
  );
  if (mobile) errors.mobile = mobile;
  const password = registrationPasswordError(input.password);
  if (password) errors.password = password;
  if (!input.confirmPassword) errors.confirmPassword = 'Please confirm your password.';
  else if (input.confirmPassword !== input.password) errors.confirmPassword = 'Passwords do not match.';
  if (!input.otpChannel) errors.otpChannel = 'Select Mobile OTP or Email OTP.';
  if (!input.agreedToTerms) errors.terms = 'You must accept the Terms and Privacy Policy to continue';
  return errors;
}

export function hasRegistrationErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}
