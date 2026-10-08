'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { PhoneField } from '@/components/PhoneField';
import { AuthField, authFieldDescribedBy } from '@/components/auth/AuthField';
import { BuildingIcon, EyeIcon, LockIcon, MailIcon, PhoneIcon, UserIcon } from '@/components/auth/AuthIcons';
import { COUNTRIES, DEFAULT_COUNTRY, toE164 } from '@/lib/phone';
import { requestOtp } from '@/lib/api';
import { saveOtpFlow } from '@/lib/otp-flow';
import { clearPendingPassword, getPendingPassword, setPendingPassword } from '@/lib/pending-password';
import { clearRegistrationDraft, loadRegistrationDraft, saveRegistrationDraft } from '@/lib/registration-draft';
import { authErrorMessage } from '@/lib/auth-errors';
import {
  COMPANY_NAME_MAX,
  hasRegistrationErrors,
  REGISTRATION_PASSWORD_HINT,
  validateEmployerRegistration,
  type EmployerRegistrationErrors,
} from '@careerbridge/shared';
import {
  clearFirebaseOtp,
  isDevOtpEnabled,
  isFirebaseConfigured,
  sendFirebaseOtp,
} from '@/lib/firebase';

type Field = keyof EmployerRegistrationErrors;

const FIELD_ORDER: Array<[Field, string]> = [
  ['yourName', 'emp-your-name'],
  ['companyName', 'emp-company-name'],
  ['workEmail', 'emp-work-email'],
  ['mobile', 'emp-mobile'],
  ['password', 'emp-password'],
  ['confirmPassword', 'emp-confirm-password'],
  ['otpChannel', 'emp-otp-mobile'],
  ['terms', 'emp-terms'],
];

export function EmployerRegisterForm() {
  const router = useRouter();
  const [yourName, setYourName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [dial, setDial] = useState<string>(DEFAULT_COUNTRY.dial);
  const [national, setNational] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [otpChannel, setOtpChannel] = useState<'MOBILE' | 'EMAIL' | null>(null);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const [restored, setRestored] = useState(false);
  const replacesRequestId = useRef<string | undefined>(undefined);

  // Back from the OTP page ("Change mobile number"): refill everything except what was never stored.
  // The password only survives in memory, so it is refilled after client-side navigation but not after a refresh.
  useEffect(() => {
    const draft = loadRegistrationDraft('EMPLOYER');
    if (!draft) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is client-only; restored once after hydration
    setYourName(draft.fullName);
    setCompanyName(draft.companyName || '');
    setWorkEmail(draft.email);
    setDial(draft.dial || DEFAULT_COUNTRY.dial);
    setNational(draft.national);
    setOtpChannel(draft.otpChannel);
    setAgreeTerms(draft.agreedToTerms);
    const pendingPassword = getPendingPassword();
    if (pendingPassword) {
      setPassword(pendingPassword);
      setConfirmPassword(pendingPassword);
    }
    replacesRequestId.current = draft.pendingRequestId;
    setRestored(true);
    const change = new URLSearchParams(window.location.search).get('change');
    document.getElementById(change === 'email' ? 'emp-work-email' : 'emp-mobile')?.focus();
  }, []);

  function startOver() {
    clearRegistrationDraft();
    clearPendingPassword();
    replacesRequestId.current = undefined;
    setYourName('');
    setCompanyName('');
    setWorkEmail('');
    setDial(DEFAULT_COUNTRY.dial);
    setNational('');
    setPassword('');
    setConfirmPassword('');
    setOtpChannel(null);
    setAgreeTerms(false);
    setTouched({});
    setSubmitAttempted(false);
    setSubmitError('');
    setRestored(false);
  }

  const country = COUNTRIES.find((item) => item.dial === dial) || DEFAULT_COUNTRY;
  const errors = validateEmployerRegistration({
    yourName,
    companyName,
    workEmail,
    national,
    mobileLength: country.maxLength,
    password,
    confirmPassword,
    otpChannel,
    agreedToTerms: agreeTerms,
  });
  const invalid = hasRegistrationErrors(errors);
  const shown = (field: Field) => (submitAttempted || touched[field] ? errors[field] : undefined);
  const touch = (field: Field) => setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setSubmitError('');

    if (invalid) {
      setSubmitAttempted(true);
      const first = FIELD_ORDER.find(([field]) => errors[field]);
      if (first) document.getElementById(first[1])?.focus();
      return;
    }

    const phone = toE164(dial, national);
    setLoading(true);
    try {
      const result = await requestOtp({
        channel: otpChannel!,
        purpose: 'REGISTER',
        accountType: 'EMPLOYER',
        phone,
        email: workEmail.trim(),
        fullName: yourName.trim(),
        companyName: companyName.trim(),
        password,
        ...(replacesRequestId.current ? { replacesRequestId: replacesRequestId.current } : {}),
      });
      if (otpChannel === 'MOBILE' && !isDevOtpEnabled()) {
        if (!isFirebaseConfigured()) {
          throw new Error('Mobile OTP is not available right now. Please try Email OTP or try again later.');
        }
        clearFirebaseOtp();
        await sendFirebaseOtp(phone);
      }
      setPendingPassword(password);
      replacesRequestId.current = result.requestId;
      saveRegistrationDraft({
        accountType: 'EMPLOYER',
        fullName: yourName,
        companyName,
        email: workEmail,
        dial,
        national,
        otpChannel,
        agreedToTerms: agreeTerms,
        pendingRequestId: result.requestId,
      });
      saveOtpFlow({
        requestId: result.requestId,
        phone,
        email: workEmail.trim(),
        channel: otpChannel!,
        purpose: 'REGISTER',
        expiresAt: Date.now() + result.expiresIn * 1000,
        registration: {
          email: workEmail.trim(),
          fullName: yourName.trim(),
          phone,
          accountType: 'EMPLOYER',
          companyName: companyName.trim(),
        },
      });
      router.push('/verify-otp');
    } catch (err) {
      setSubmitError(authErrorMessage(err, 'request'));
    } finally {
      setLoading(false);
    }
  }

  const nameError = shown('yourName');
  const companyError = shown('companyName');
  const emailError = shown('workEmail');
  const passwordError = shown('password');
  const confirmError = shown('confirmPassword');
  const otpError = shown('otpChannel');
  const termsError = shown('terms');

  return (
    <form onSubmit={onSubmit} className="cb-auth-form-stack" noValidate aria-busy={loading || undefined}>
      {restored ? (
        <p className="cb-auth-field__hint" role="status" data-testid="registration-restored">
          Your details are filled in. Update your mobile number and submit to get a new OTP.{' '}
          <button type="button" className="cb-auth-meta__link" onClick={startOver}>
            Start over
          </button>
        </p>
      ) : null}
      <fieldset disabled={loading} className="cb-auth-form-stack">
        <AuthField id="emp-your-name" label="Your Name" required icon={<UserIcon />} error={nameError}>
          <input
            id="emp-your-name"
            name="yourName"
            required
            aria-required
            aria-invalid={nameError ? true : undefined}
            aria-describedby={authFieldDescribedBy('emp-your-name', nameError)}
            autoComplete="name"
            placeholder="Enter your name"
            value={yourName}
            onChange={(event) => setYourName(event.target.value)}
            onBlur={() => touch('yourName')}
            className="cb-auth-field__input"
          />
        </AuthField>

        <AuthField
          id="emp-company-name"
          label="Company Name"
          required
          icon={<BuildingIcon />}
          error={companyError}
        >
          <input
            id="emp-company-name"
            name="companyName"
            required
            aria-required
            aria-invalid={companyError ? true : undefined}
            aria-describedby={authFieldDescribedBy('emp-company-name', companyError)}
            autoComplete="organization"
            placeholder="Enter company name"
            maxLength={COMPANY_NAME_MAX + 1}
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            onBlur={() => touch('companyName')}
            className="cb-auth-field__input"
          />
        </AuthField>

        <AuthField id="emp-work-email" label="Work Email" required icon={<MailIcon />} error={emailError}>
          <input
            id="emp-work-email"
            name="workEmail"
            type="email"
            required
            aria-required
            aria-invalid={emailError ? true : undefined}
            aria-describedby={authFieldDescribedBy('emp-work-email', emailError)}
            autoComplete="email"
            placeholder="you@company.com"
            value={workEmail}
            onChange={(event) => setWorkEmail(event.target.value)}
            onBlur={() => touch('workEmail')}
            className="cb-auth-field__input"
          />
        </AuthField>

        <AuthField
          id="emp-mobile"
          label="Mobile number"
          required
          icon={<PhoneIcon />}
          controlClassName="cb-auth-field__control--phone"
        >
          <div className="cb-auth-field__phone">
            <PhoneField
              id="emp-mobile"
              required
              disabled={loading}
              dial={dial}
              national={national}
              onDialChange={setDial}
              onNationalChange={setNational}
              onBlur={() => touch('mobile')}
              error={shown('mobile')}
              hint=""
            />
          </div>
        </AuthField>

        <AuthField
          id="emp-password"
          label="Password"
          required
          icon={<LockIcon />}
          error={passwordError}
          hint={REGISTRATION_PASSWORD_HINT}
        >
          <input
            id="emp-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            aria-required
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={authFieldDescribedBy('emp-password', passwordError, REGISTRATION_PASSWORD_HINT)}
            autoComplete="new-password"
            placeholder="Min 8 chars"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onBlur={() => touch('password')}
            className="cb-auth-field__input"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="cb-auth-field__action"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            <EyeIcon open={showPassword} />
          </button>
        </AuthField>

        <AuthField
          id="emp-confirm-password"
          label="Confirm Password"
          required
          icon={<LockIcon />}
          error={confirmError}
        >
          <input
            id="emp-confirm-password"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            required
            aria-required
            aria-invalid={confirmError ? true : undefined}
            aria-describedby={authFieldDescribedBy('emp-confirm-password', confirmError)}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            onBlur={() => touch('confirmPassword')}
            className="cb-auth-field__input"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="cb-auth-field__action"
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
          >
            <EyeIcon open={showConfirmPassword} />
          </button>
        </AuthField>

        <div className="cb-auth-field" role="group" aria-labelledby="emp-otp-label">
          <span id="emp-otp-label" className="cb-auth-field__label">
            Verify via OTP on
            <span className="cb-auth-required" aria-hidden>
              *
            </span>
          </span>
          <div className="cb-auth-otp">
            <button
              id="emp-otp-mobile"
              type="button"
              aria-pressed={otpChannel === 'MOBILE'}
              aria-describedby={otpError ? 'emp-otp-error' : undefined}
              onClick={() => setOtpChannel('MOBILE')}
              className={`cb-auth-otp__btn${otpChannel === 'MOBILE' ? ' is-active' : ''}`}
            >
              Mobile OTP
            </button>
            <button
              type="button"
              aria-pressed={otpChannel === 'EMAIL'}
              aria-describedby={otpError ? 'emp-otp-error' : undefined}
              onClick={() => setOtpChannel('EMAIL')}
              className={`cb-auth-otp__btn${otpChannel === 'EMAIL' ? ' is-active' : ''}`}
            >
              Email OTP
            </button>
          </div>
          {otpError ? (
            <span id="emp-otp-error" role="alert" className="cb-auth-field__error">
              {otpError}
            </span>
          ) : (
            <p className="cb-auth-field__hint">
              {!otpChannel
                ? 'Choose Mobile OTP or Email OTP.'
                : otpChannel === 'EMAIL'
                  ? 'A 6-digit OTP will be sent to your work email.'
                  : 'A 6-digit OTP will be sent to your mobile number.'}
            </p>
          )}
        </div>

        <div>
          <label className="cb-auth-check" htmlFor="emp-terms">
            <input
              id="emp-terms"
              type="checkbox"
              required
              aria-required
              aria-invalid={termsError ? true : undefined}
              aria-describedby={termsError ? 'emp-terms-error' : undefined}
              checked={agreeTerms}
              onChange={(event) => {
                setAgreeTerms(event.target.checked);
                touch('terms');
              }}
            />
            <span>
              I agree to{' '}
              <a href="/employer/terms" target="_blank" rel="noreferrer" className="cb-auth-meta__link">
                Employer Terms
              </a>{' '}
              and{' '}
              <a href="/privacy" target="_blank" rel="noreferrer" className="cb-auth-meta__link">
                Privacy Policy
              </a>
              <span className="cb-auth-required" aria-hidden>
                *
              </span>
            </span>
          </label>
          {termsError ? (
            <span id="emp-terms-error" role="alert" className="cb-auth-field__error">
              {termsError}
            </span>
          ) : null}
        </div>
      </fieldset>

      {submitError ? (
        <div className="cb-auth-alert" role="alert">
          {submitError}
        </div>
      ) : null}

      <Button
        type="submit"
        loading={loading}
        loadingLabel="Creating..."
        aria-disabled={invalid || undefined}
        className="w-full"
      >
        Create Employer Account
      </Button>
    </form>
  );
}
