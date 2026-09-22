'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PhoneField } from '@/components/PhoneField';
import { COUNTRIES, DEFAULT_COUNTRY, isValidNational, toE164 } from '@/lib/phone';
import { requestOtp } from '@/lib/api';
import { saveOtpFlow } from '@/lib/otp-flow';
import { setPendingPassword } from '@/lib/pending-password';
import { authErrorMessage } from '@/lib/auth-errors';
import {
  isDevOtpEnabled,
  isFirebaseConfigured,
  sendFirebaseOtp,
} from '@/lib/firebase';
import { REGISTRATION_PASSWORD_HINT, registrationPasswordError } from '@careerbridge/shared';
import { validateEmailAddress } from '@/lib/validation';

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19c1.6-3 4-4.5 6.5-4.5S17 16 18.5 19" strokeLinecap="round" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="8" y="3" width="8" height="18" rx="2" />
      <path d="M11 17h2" strokeLinecap="round" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.58 2 2.15 6.4 2.15 11.83c0 1.96.52 3.82 1.44 5.43L2 22l4.9-1.55a10 10 0 0 0 5.14 1.4h.01c5.46 0 9.89-4.4 9.89-9.83C21.94 6.4 17.5 2 12.04 2Zm5.55 13.95c-.23.65-1.35 1.2-1.88 1.28-.49.07-1.1.1-1.78-.11-.41-.13-.94-.27-1.62-.53-2.85-1.1-4.7-3.92-4.84-4.1-.14-.18-1.15-1.53-1.15-2.92 0-1.39.73-2.07.99-2.35.26-.28.57-.35.76-.35h.55c.18 0 .42-.07.65.5.23.58.79 2 .86 2.14.07.14.12.3.02.49-.1.18-.15.3-.3.46-.14.16-.3.35-.43.47-.14.12-.29.26-.12.5.16.25.72 1.18 1.55 1.92 1.06.94 1.96 1.23 2.24 1.37.28.14.44.12.6-.07.16-.18.7-.81.89-1.09.18-.28.37-.23.62-.14.25.1 1.58.75 1.85.88.27.14.45.2.52.31.07.11.07.64-.16 1.29Z" />
    </svg>
  );
}

function WhatsAppTicks() {
  return (
    <svg viewBox="0 0 24 16" fill="none" aria-hidden>
      <path
        d="M2.5 8.5 6 12l7-8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 8.5 12 12l7-8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
      />
    </svg>
  ) : (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

export function RegistrationForm() {
  const router = useRouter();
  const [dial, setDial] = useState<string>(DEFAULT_COUNTRY.dial);
  const [national, setNational] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpChannel, setOtpChannel] = useState<'MOBILE' | 'EMAIL' | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [whatsappNotice, setWhatsappNotice] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    setError('');

    if (!agreedToTerms) {
      setError('Please agree to the Terms and Privacy Policy.');
      return;
    }

    const country = COUNTRIES.find((item) => item.dial === dial) || DEFAULT_COUNTRY;
    if (!isValidNational(country.maxLength, national)) {
      setError('Enter a valid mobile number.');
      return;
    }
    const emailProblem = validateEmailAddress(email.trim(), true);
    if (emailProblem) {
      setError(emailProblem);
      return;
    }
    if (fullName.trim().length < 2) {
      setError('Enter your full name.');
      return;
    }
    const passwordProblem = registrationPasswordError(password);
    if (passwordProblem) {
      setError(passwordProblem);
      return;
    }
    if (password !== confirmPassword) {
      setError('Password and confirm password do not match.');
      return;
    }
    if (!otpChannel) {
      setError('Select Mobile OTP or Email OTP.');
      return;
    }

    const phone = toE164(dial, national);
    setLoading(true);
    try {
      const result = await requestOtp({
        channel: otpChannel,
        purpose: 'REGISTER',
        accountType: 'CANDIDATE',
        phone,
        email: email.trim(),
        fullName: fullName.trim(),
        preferredLanguage: 'English',
        password,
        whatsappOptIn,
      });

      if (otpChannel === 'MOBILE' && !isDevOtpEnabled()) {
        if (!isFirebaseConfigured()) {
          throw new Error('Mobile OTP is not available right now. Please try Email OTP or try again later.');
        }
        await sendFirebaseOtp(phone);
      }

      setPendingPassword(password);
      saveOtpFlow({
        requestId: result.requestId,
        phone,
        email: email.trim(),
        channel: otpChannel,
        purpose: 'REGISTER',
        expiresAt: Date.now() + result.expiresIn * 1000,
        registration: {
          email: email.trim(),
          fullName: fullName.trim(),
          preferredLanguage: 'English',
          accountType: 'CANDIDATE',
          whatsappOptIn,
        },
      });
      router.push('/verify-otp');
    } catch (err) {
      setError(authErrorMessage(err, 'request'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="cb-auth-form-stack" noValidate>
      <div className="cb-auth-field">
        <label className="cb-auth-field__label" htmlFor="cand-full-name">
          Full Name
        </label>
        <div className="cb-auth-field__control">
          <span className="cb-auth-field__icon">
            <UserIcon />
          </span>
          <input
            id="cand-full-name"
            name="fullName"
            required
            autoComplete="name"
            placeholder="Rahul Kumar"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="cb-auth-field__input"
          />
        </div>
      </div>

      <div className="cb-auth-field">
        <label className="cb-auth-field__label">Mobile number</label>
        <div className="cb-auth-field__control cb-auth-field__control--phone">
          <span className="cb-auth-field__icon">
            <PhoneIcon />
          </span>
          <div className="cb-auth-field__phone">
            <PhoneField
              dial={dial}
              national={national}
              onDialChange={setDial}
              onNationalChange={setNational}
              hint=""
              error={error.includes('mobile') ? error : undefined}
            />
          </div>
        </div>
        <p className="cb-auth-field__hint">Use your WhatsApp number for faster updates.</p>
      </div>

      <div className="cb-auth-field">
        <label className="cb-auth-field__label" htmlFor="cand-email">
          Email
        </label>
        <div className="cb-auth-field__control">
          <span className="cb-auth-field__icon">
            <MailIcon />
          </span>
          <input
            id="cand-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="cb-auth-field__input"
          />
        </div>
      </div>

      <div className="cb-auth-field">
        <label className="cb-auth-field__label" htmlFor="cand-password">
          Password
        </label>
        <div className="cb-auth-field__control">
          <span className="cb-auth-field__icon">
            <LockIcon />
          </span>
          <input
            id="cand-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="new-password"
            placeholder="Min 8 chars (e.g. Pass@123)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
        </div>
        <p className="cb-auth-field__hint">{REGISTRATION_PASSWORD_HINT}</p>
      </div>

      <div className="cb-auth-field">
        <label className="cb-auth-field__label" htmlFor="cand-confirm-password">
          Confirm password
        </label>
        <div className="cb-auth-field__control">
          <span className="cb-auth-field__icon">
            <LockIcon />
          </span>
          <input
            id="cand-confirm-password"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            required
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
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
        </div>
      </div>

      <div className="cb-auth-field">
        <label className="cb-auth-field__label">Verify via OTP on</label>
        <div className="cb-auth-otp">
          <button
            type="button"
            onClick={() => setOtpChannel('MOBILE')}
            className={`cb-auth-otp__btn${otpChannel === 'MOBILE' ? ' is-active' : ''}`}
          >
            Mobile OTP
          </button>
          <button
            type="button"
            onClick={() => setOtpChannel('EMAIL')}
            className={`cb-auth-otp__btn${otpChannel === 'EMAIL' ? ' is-active' : ''}`}
          >
            Email OTP
          </button>
        </div>
        <p className="cb-auth-field__hint">
          {!otpChannel
            ? 'Choose Mobile OTP or Email OTP.'
            : otpChannel === 'EMAIL'
              ? 'A 6-digit OTP will be sent to your email.'
              : 'A 6-digit OTP will be sent to your mobile number.'}
        </p>
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

      <label className="cb-auth-check">
        <input
          type="checkbox"
          checked={agreedToTerms}
          onChange={(event) => setAgreedToTerms(event.target.checked)}
        />
        <span>
          I agree to all the statements in{' '}
          <Link href="/terms" className="cb-auth-meta__link">
            Terms of service
          </Link>
        </span>
      </label>

      {error ? <div className="cb-auth-alert">{error}</div> : null}

      <button type="submit" disabled={loading} className="w-full">
        {loading ? 'Sending OTP...' : 'REGISTER'}
      </button>
    </form>
  );
}
