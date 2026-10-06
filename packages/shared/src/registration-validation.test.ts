import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasRegistrationErrors,
  validateCandidateRegistration,
  validateEmployerRegistration,
} from './registration-validation';

const candidate = {
  fullName: 'Rahul Kumar',
  national: '9876543210',
  mobileLength: 10,
  email: '',
  password: 'SecurePass@1',
  confirmPassword: 'SecurePass@1',
  otpChannel: 'MOBILE' as const,
  agreedToTerms: true,
};

test('candidate email is optional with mobile OTP', () => {
  assert.equal(hasRegistrationErrors(validateCandidateRegistration(candidate)), false);
});

test('candidate empty form reports every required field with handbook wording', () => {
  const errors = validateCandidateRegistration({
    ...candidate,
    fullName: '',
    national: '',
    password: '',
    confirmPassword: '',
    otpChannel: null,
    agreedToTerms: false,
  });
  assert.equal(errors.fullName, 'Name is required');
  assert.equal(errors.mobile, 'Mobile number is required');
  assert.equal(errors.password, 'Password must be at least 8 characters.');
  assert.equal(errors.terms, 'You must accept the Terms and Privacy Policy to continue');
  assert.ok(errors.otpChannel);
});

test('candidate field rules', () => {
  const errors = validateCandidateRegistration({ ...candidate, fullName: 'A', national: '12345', email: 'abc@' });
  assert.equal(errors.fullName, 'Please enter your full name');
  assert.equal(errors.mobile, 'Please enter a valid 10-digit mobile number');
  assert.equal(errors.email, 'Please enter a valid email address');
  assert.ok(validateCandidateRegistration({ ...candidate, otpChannel: 'EMAIL' }).email);
});

const employer = {
  yourName: 'John Smith',
  companyName: 'ABC Services',
  workEmail: 'john@abcservices.com',
  national: '9876543210',
  mobileLength: 10,
  password: 'SecurePass@1',
  confirmPassword: 'SecurePass@1',
  otpChannel: 'EMAIL' as const,
  agreedToTerms: true,
};

test('employer valid form has no errors', () => {
  assert.equal(hasRegistrationErrors(validateEmployerRegistration(employer)), false);
});

test('employer empty form reports all six handbook fields at once', () => {
  const errors = validateEmployerRegistration({
    ...employer,
    yourName: '',
    companyName: '',
    workEmail: '',
    national: '',
    password: '',
    confirmPassword: '',
    agreedToTerms: false,
  });
  assert.equal(errors.yourName, 'Name is required');
  assert.equal(errors.companyName, 'Company name is required');
  assert.equal(errors.workEmail, 'Please enter a valid work email address');
  assert.equal(errors.mobile, 'Please enter a valid 10-digit mobile number');
  assert.equal(errors.password, 'Password must be at least 8 characters.');
  assert.equal(errors.terms, 'You must accept the Terms and Privacy Policy to continue');
});

test('employer field rules', () => {
  const errors = validateEmployerRegistration({
    ...employer,
    yourName: 'A',
    workEmail: 'john@',
    companyName: 'x'.repeat(101),
    password: 'password123',
  });
  assert.equal(errors.yourName, 'Please enter a valid name');
  assert.equal(errors.workEmail, 'Please enter a valid work email address');
  assert.match(errors.companyName || '', /100 characters/);
  assert.equal(errors.password, 'Password must contain uppercase, number, and special character');
});
