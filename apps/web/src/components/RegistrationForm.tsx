'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PhoneField } from '@/components/PhoneField';
import { Button } from '@/components/ui/Button';
import { AuthField, authFieldDescribedBy } from '@/components/auth/AuthField';
import {
  EyeIcon,
  LockIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  UserIcon,
  WhatsAppIcon,
  WhatsAppTicks,
} from '@/components/auth/AuthIcons';
import { COUNTRIES, DEFAULT_COUNTRY, toE164 } from '@/lib/phone';
import { requestOtp } from '@/lib/api';
import { saveOtpFlow } from '@/lib/otp-flow';
import { clearPendingPassword, getPendingPassword, setPendingPassword } from '@/lib/pending-password';
import { clearRegistrationDraft, loadRegistrationDraft, saveRegistrationDraft } from '@/lib/registration-draft';
import { authErrorMessage } from '@/lib/auth-errors';
import {
  clearFirebaseOtp,
  isDevOtpEnabled,
  isFirebaseConfigured,
  sendFirebaseOtp,
} from '@/lib/firebase';
import {
  CITIES_BY_STATE,
  REGISTRATION_PASSWORD_HINT,
  hasRegistrationErrors,
  validateCandidateRegistration,
  type CandidateRegistrationErrors,
} from '@careerbridge/shared';

type Field = keyof CandidateRegistrationErrors;

const FIELD_ORDER: Array<[Field, string]> = [
  ['fullName', 'cand-full-name'],
  ['mobile', 'cand-mobile'],
  ['email', 'cand-email'],
  ['password', 'cand-password'],
  ['confirmPassword', 'cand-confirm-password'],
  ['otpChannel', 'cand-otp-mobile'],
  ['terms', 'cand-terms'],
];

const LOCATION_GROUPS = Object.entries(CITIES_BY_STATE).sort(([a], [b]) => a.localeCompare(b));

export function RegistrationForm() {
  const router = useRouter();
  const [dial, setDial] = useState<string>(DEFAULT_COUNTRY.dial);
  const [national, setNational] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [location, setLocation] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpChannel, setOtpChannel] = useState<'MOBILE' | 'EMAIL' | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [whatsappNotice, setWhatsappNotice] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const [restored, setRestored] = useState(false);
  const replacesRequestId = useRef<string | undefined>(undefined);

  // Back from the OTP page ("Change mobile number"): refill everything except what was never stored.
  // The password only survives in memory, so it is refilled after client-side navigation but not after a refresh.
  useEffect(() => {
    const draft = loadRegistrationDraft('CANDIDATE');
    if (!draft) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is client-only; restored once after hydration
    setFullName(draft.fullName);
    setEmail(draft.email);
    setDial(draft.dial || DEFAULT_COUNTRY.dial);
    setNational(draft.national);
    setLocation(draft.location || '');
    setOtpChannel(draft.otpChannel);
    setAgreedToTerms(draft.agreedToTerms);
    setWhatsappOptIn(draft.whatsappOptIn !== false);
    const pendingPassword = getPendingPassword();
    if (pendingPassword) {
      setPassword(pendingPassword);
      setConfirmPassword(pendingPassword);
    }
    replacesRequestId.current = draft.pendingRequestId;
    setRestored(true);
    const change = new URLSearchParams(window.location.search).get('change');
    document.getElementById(change === 'email' ? 'cand-email' : 'cand-mobile')?.focus();
  }, []);

  function startOver() {
    clearRegistrationDraft();
    clearPendingPassword();
    replacesRequestId.current = undefined;
    setFullName('');
    setEmail('');
    setDial(DEFAULT_COUNTRY.dial);
    setNational('');
    setLocation('');
    setPassword('');
    setConfirmPassword('');
    setOtpChannel(null);
    setAgreedToTerms(false);
    setWhatsappOptIn(true);
    setTouched({});
    setSubmitAttempted(false);
    setSubmitError('');
    setRestored(false);
  }

  const country = COUNTRIES.find((item) => item.dial === dial) || DEFAULT_COUNTRY;
  const errors = validateCandidateRegistration({
    fullName,
    national,
    mobileLength: country.maxLength,
    email,
    password,
    confirmPassword,
    otpChannel,
    agreedToTerms,
  });
  const invalid = hasRegistrationErrors(errors);
  const shown = (field: Field) => (submitAttempted || touched[field] ? errors[field] : undefined);
  const touch = (field: Field) => setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));

  function toggleWhatsApp() {
    const next = !whatsappOptIn;
    setWhatsappOptIn(next);
    if (next) {
      setWhatsappNotice(true);
      window.setTimeout(() => setWhatsappNotice(false), 3200);
    } else {
      setWhatsappNotice(false);
    }
  }

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
    const trimmedEmail = email.trim();
    const [locationState, locationCity] = location ? location.split('|') : ['', ''];
    setLoading(true);
    try {
      const result = await requestOtp({
        channel: otpChannel!,
        purpose: 'REGISTER',
        accountType: 'CANDIDATE',
        phone,
        email: trimmedEmail || undefined,
        fullName: fullName.trim(),
        ...(locationCity
          ? { location: `${locationCity}, ${locationState}`, city: locationCity, state: locationState }
          : {}),
        preferredLanguage: 'English',
        password,
        whatsappOptIn,
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
        accountType: 'CANDIDATE',
        fullName,
        email,
        dial,
        national,
        otpChannel,
        agreedToTerms,
        location,
        whatsappOptIn,
        pendingRequestId: result.requestId,
      });
      saveOtpFlow({
        requestId: result.requestId,
        phone,
        email: trimmedEmail,
        channel: otpChannel!,
        purpose: 'REGISTER',
        expiresAt: Date.now() + result.expiresIn * 1000,
        registration: {
          email: trimmedEmail,
          fullName: fullName.trim(),
          preferredLanguage: 'English',
          accountType: 'CANDIDATE',
          whatsappOptIn,
        },
      });
      router.push('/verify-otp');
    } catch (err) {
      setSubmitError(authErrorMessage(err, 'request'));
    } finally {
      setLoading(false);
    }
  }

  const nameError = shown('fullName');
  const emailError = shown('email');
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
        <AuthField id="cand-full-name" label="Full Name" required icon={<UserIcon />} error={nameError}>
          <input
            id="cand-full-name"
            name="fullName"
            required
            aria-required
            aria-invalid={nameError ? true : undefined}
            aria-describedby={authFieldDescribedBy('cand-full-name', nameError)}
            autoComplete="name"
            placeholder="Rahul Kumar"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            onBlur={() => touch('fullName')}
            className="cb-auth-field__input"
          />
        </AuthField>

        <AuthField
          id="cand-mobile"
          label="Mobile number"
          required
          icon={<PhoneIcon />}
          controlClassName="cb-auth-field__control--phone"
          hint="Use your WhatsApp number for faster updates."
        >
          <div className="cb-auth-field__phone">
            <PhoneField
              id="cand-mobile"
              required
              disabled={loading}
              dial={dial}
              national={national}
              onDialChange={setDial}
              onNationalChange={setNational}
              onBlur={() => touch('mobile')}
              hint=""
              error={shown('mobile')}
            />
          </div>
        </AuthField>

        <AuthField id="cand-email" label="Email" optional icon={<MailIcon />} error={emailError}>
          <input
            id="cand-email"
            name="email"
            type="email"
            required={otpChannel === 'EMAIL'}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={authFieldDescribedBy('cand-email', emailError)}
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onBlur={() => touch('email')}
            className="cb-auth-field__input"
          />
        </AuthField>

        <AuthField id="cand-location" label="Location" optional icon={<MapPinIcon />}>
          <select
            id="cand-location"
            name="location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            className="cb-auth-field__input"
          >
            <option value="">Select your city</option>
            {LOCATION_GROUPS.map(([state, cities]) => (
              <optgroup key={state} label={state}>
                {cities.map((city) => (
                  <option key={`${state}|${city}`} value={`${state}|${city}`}>
                    {city}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </AuthField>

        <AuthField
          id="cand-password"
          label="Password"
          required
          icon={<LockIcon />}
          error={passwordError}
          hint={REGISTRATION_PASSWORD_HINT}
        >
          <input
            id="cand-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            aria-required
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={authFieldDescribedBy('cand-password', passwordError, REGISTRATION_PASSWORD_HINT)}
            autoComplete="new-password"
            placeholder="Min 8 chars (e.g. Pass@123)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onBlur={() => touch('password')}
            className="cb-auth-field__input"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="cb-auth-field__action"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            <EyeIcon open={showPassword} />
          </button>
        </AuthField>

        <AuthField
          id="cand-confirm-password"
          label="Confirm password"
          required
          icon={<LockIcon />}
          error={confirmError}
        >
          <input
            id="cand-confirm-password"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            required
            aria-required
            aria-invalid={confirmError ? true : undefined}
            aria-describedby={authFieldDescribedBy('cand-confirm-password', confirmError)}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            onBlur={() => touch('confirmPassword')}
            className="cb-auth-field__input"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((v) => !v)}
            className="cb-auth-field__action"
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
          >
            <EyeIcon open={showConfirmPassword} />
          </button>
        </AuthField>

        <div className="cb-auth-field" role="group" aria-labelledby="cand-otp-label">
          <span id="cand-otp-label" className="cb-auth-field__label">
            Verify via OTP on
            <span className="cb-auth-required" aria-hidden>
              *
            </span>
          </span>
          <div className="cb-auth-otp">
            <button
              id="cand-otp-mobile"
              type="button"
              aria-pressed={otpChannel === 'MOBILE'}
              aria-describedby={otpError ? 'cand-otp-error' : undefined}
              onClick={() => setOtpChannel('MOBILE')}
              className={`cb-auth-otp__btn${otpChannel === 'MOBILE' ? ' is-active' : ''}`}
            >
              Mobile OTP
            </button>
            <button
              type="button"
              aria-pressed={otpChannel === 'EMAIL'}
              aria-describedby={otpError ? 'cand-otp-error' : undefined}
              onClick={() => {
                setOtpChannel('EMAIL');
                touch('email');
              }}
              className={`cb-auth-otp__btn${otpChannel === 'EMAIL' ? ' is-active' : ''}`}
            >
              Email OTP
            </button>
          </div>
          {otpError ? (
            <span id="cand-otp-error" role="alert" className="cb-auth-field__error">
              {otpError}
            </span>
          ) : (
            <p className="cb-auth-field__hint">
              {!otpChannel
                ? 'Choose Mobile OTP or Email OTP.'
                : otpChannel === 'EMAIL'
                  ? 'A 6-digit OTP will be sent to your email.'
                  : 'A 6-digit OTP will be sent to your mobile number.'}
            </p>
          )}
        </div>

        <div className="cb-auth-wa">
          <button
            type="button"
            className={`cb-auth-wa__btn${whatsappOptIn ? ' is-on' : ''}`}
            onClick={toggleWhatsApp}
            aria-pressed={whatsappOptIn}
          >
            <span className="cb-auth-wa__icon" aria-hidden>
              <WhatsAppIcon />
            </span>
            <span className="cb-auth-wa__copy">
              <strong>WhatsApp updates</strong>
              <em>Get quick interview alerts on WhatsApp</em>
            </span>
            {whatsappOptIn ? (
              <span className="cb-auth-wa__ticks" aria-hidden>
                <WhatsAppTicks />
              </span>
            ) : (
              <span className="cb-auth-wa__plus" aria-hidden>
                +
              </span>
            )}
          </button>
          {whatsappNotice ? (
            <div className="cb-auth-wa__success" role="status">
              <span className="cb-auth-wa__ticks" aria-hidden>
                <WhatsAppTicks />
              </span>
              <p>
                <strong>WhatsApp enabled</strong>
                Interview alerts will be sent to your WhatsApp number.
              </p>
            </div>
          ) : null}
        </div>

        <div>
          <label className="cb-auth-check" htmlFor="cand-terms">
            <input
              id="cand-terms"
              type="checkbox"
              required
              aria-required
              aria-invalid={termsError ? true : undefined}
              aria-describedby={termsError ? 'cand-terms-error' : undefined}
              checked={agreedToTerms}
              onChange={(event) => {
                setAgreedToTerms(event.target.checked);
                touch('terms');
              }}
            />
            <span>
              I agree to the{' '}
              <Link href="/terms" className="cb-auth-meta__link">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="cb-auth-meta__link">
                Privacy Policy
              </Link>
              <span className="cb-auth-required" aria-hidden>
                *
              </span>
            </span>
          </label>
          {termsError ? (
            <span id="cand-terms-error" role="alert" className="cb-auth-field__error">
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
        Create Profile
      </Button>
    </form>
  );
}
