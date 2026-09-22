'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { PhoneField } from '@/components/PhoneField';
import { COUNTRIES, DEFAULT_COUNTRY, isValidNational, toE164 } from '@/lib/phone';
import { requestOtp } from '@/lib/api';
import { saveOtpFlow } from '@/lib/otp-flow';
import { setPendingPassword } from '@/lib/pending-password';
import { authErrorMessage } from '@/lib/auth-errors';
import { registrationPasswordError } from '@careerbridge/shared';
import { validateEmailAddress } from '@/lib/validation';
import {
  isDevOtpEnabled,
  isFirebaseConfigured,
  sendFirebaseOtp,
} from '@/lib/firebase';

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19c1.6-3 4-4.5 6.5-4.5S17 16 18.5 19" strokeLinecap="round" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 20V7.5L12 4l8 3.5V20" strokeLinejoin="round" />
      <path d="M9 20v-5h6v5M10 10h.01M14 10h.01M10 13h.01M14 13h.01" strokeLinecap="round" />
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

  const [touched, setTouched] = useState({
    yourName: false,
    companyName: false,
    workEmail: false,
    national: false,
    password: false,
    confirmPassword: false,
    agreeTerms: false,
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const country = COUNTRIES.find((item) => item.dial === dial) || DEFAULT_COUNTRY;

  const yourNameError = (() => {
    if (!touched.yourName) return '';
    const trimmed = yourName.trim();
    if (!trimmed) return 'Your name is required.';
    if (trimmed.length < 2) return 'Name must be at least 2 characters.';
    if (!/^[a-zA-Z\s.'-]+$/.test(trimmed)) return 'Name should only contain letters and spaces.';
    return '';
  })();

  const companyNameError = (() => {
    if (!touched.companyName) return '';
    const trimmed = companyName.trim();
    if (!trimmed) return 'Company name is required.';
    if (trimmed.length < 2) return 'Company name must be at least 2 characters.';
    return '';
  })();

  const workEmailError = (() => {
    if (!touched.workEmail && otpChannel === 'MOBILE') return '';
    if (otpChannel === 'EMAIL' && !workEmail.trim()) {
      return 'Work email is required for Email OTP verification.';
    }
    if (!workEmail.trim()) return '';
    return validateEmailAddress(workEmail, otpChannel === 'EMAIL') || '';
  })();

  const nationalError = (() => {
    if (!touched.national) return '';
    if (!national) return 'Mobile number is required.';
    if (!isValidNational(country.maxLength, national)) return `Enter a valid ${country.maxLength}-digit number.`;
    return '';
  })();

  const passwordError = (() => {
    if (!touched.password) return '';
    return registrationPasswordError(password) || '';
  })();

  const confirmPasswordError = (() => {
    if (!touched.confirmPassword) return '';
    if (!confirmPassword) return 'Confirm your password.';
    if (confirmPassword !== password) return 'Passwords do not match.';
    return '';
  })();

  const termsError = touched.agreeTerms && !agreeTerms ? 'You must agree to Terms & Privacy Policy.' : '';

  function markTouched(field: keyof typeof touched) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    setTouched({
      yourName: true,
      companyName: true,
      workEmail: true,
      national: true,
      password: true,
      confirmPassword: true,
      agreeTerms: true,
    });

    if (yourName.trim().length < 2) {
      setError('Enter your name.');
      return;
    }
    if (!/^[a-zA-Z\s.'-]+$/.test(yourName.trim())) {
      setError('Name should only contain letters and spaces.');
      return;
    }
    if (companyName.trim().length < 2) {
      setError('Enter your company name.');
      return;
    }
    if (otpChannel === 'EMAIL') {
      if (!workEmail.trim()) {
        setError('Please enter your work email to receive the OTP.');
        return;
      }
      const emailProblem = validateEmailAddress(workEmail.trim(), true);
      if (emailProblem) {
        setError(emailProblem);
        return;
      }
    } else {
      const emailProblem = validateEmailAddress(workEmail.trim(), true);
      if (emailProblem) {
        setError(emailProblem);
        return;
      }
    }
    if (!isValidNational(country.maxLength, national)) {
      setError('Enter a valid mobile number.');
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
    if (!agreeTerms) {
      setError('You must agree to Terms & Privacy Policy to continue.');
      return;
    }

    const phone = toE164(dial, national);
    setLoading(true);
    try {
      const result = await requestOtp({
        channel: otpChannel,
        purpose: 'REGISTER',
        accountType: 'EMPLOYER',
        phone,
        email: workEmail.trim(),
        fullName: yourName.trim(),
        companyName: companyName.trim(),
        password,
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
        email: workEmail.trim(),
        channel: otpChannel,
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
      setError(authErrorMessage(err, 'request'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="cb-auth-form-stack" noValidate>
      <div className="cb-auth-field">
        <label className="cb-auth-field__label" htmlFor="emp-your-name">
          Your Name
        </label>
        <div className={`cb-auth-field__control ${yourNameError ? 'is-error' : ''}`}>
          <span className="cb-auth-field__icon">
            <UserIcon />
          </span>
          <input
            id="emp-your-name"
            name="yourName"
            required
            autoComplete="name"
            placeholder="Enter your name"
            value={yourName}
            onChange={(event) => {
              const sanitized = event.target.value.replace(/[^a-zA-Z\s.'-]/g, '');
              setYourName(sanitized);
              if (!touched.yourName) markTouched('yourName');
            }}
            onBlur={() => markTouched('yourName')}
            className="cb-auth-field__input"
          />
        </div>
        {yourNameError ? <span className="cb-auth-field__error">{yourNameError}</span> : null}
      </div>

      <div className="cb-auth-field">
        <label className="cb-auth-field__label" htmlFor="emp-company-name">
          Company Name
        </label>
        <div className={`cb-auth-field__control ${companyNameError ? 'is-error' : ''}`}>
          <span className="cb-auth-field__icon">
            <BuildingIcon />
          </span>
          <input
            id="emp-company-name"
            name="companyName"
            required
            placeholder="Enter company name"
            value={companyName}
            onChange={(event) => {
              setCompanyName(event.target.value);
              if (!touched.companyName) markTouched('companyName');
            }}
            onBlur={() => markTouched('companyName')}
            className="cb-auth-field__input"
          />
        </div>
        {companyNameError ? <span className="cb-auth-field__error">{companyNameError}</span> : null}
      </div>

      <div className="cb-auth-field">
        <label className="cb-auth-field__label" htmlFor="emp-work-email">
          Work Email{otpChannel === 'EMAIL' ? ' *' : ''}
        </label>
        <div className={`cb-auth-field__control ${workEmailError ? 'is-error' : ''}`}>
          <span className="cb-auth-field__icon">
            <MailIcon />
          </span>
          <input
            id="emp-work-email"
            name="workEmail"
            type="email"
            required={otpChannel === 'EMAIL'}
            placeholder="you@company.com"
            value={workEmail}
            onChange={(event) => {
              setWorkEmail(event.target.value);
              if (!touched.workEmail) markTouched('workEmail');
            }}
            onBlur={() => markTouched('workEmail')}
            className="cb-auth-field__input"
          />
        </div>
        {workEmailError ? <span className="cb-auth-field__error">{workEmailError}</span> : null}
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
              onDialChange={(nextDial) => {
                setDial(nextDial);
                markTouched('national');
              }}
              onNationalChange={(val) => {
                setNational(val);
                if (!touched.national) markTouched('national');
              }}
              error={nationalError}
              hint=""
            />
          </div>
        </div>
        {nationalError ? <span className="cb-auth-field__error">{nationalError}</span> : null}
      </div>

      <div className="cb-auth-field">
        <label className="cb-auth-field__label" htmlFor="emp-password">
          Password
        </label>
        <div className={`cb-auth-field__control ${passwordError ? 'is-error' : ''}`}>
          <span className="cb-auth-field__icon">
            <LockIcon />
          </span>
          <input
            id="emp-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="new-password"
            placeholder="Min 8 chars"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (!touched.password) markTouched('password');
            }}
            onBlur={() => markTouched('password')}
            className="cb-auth-field__input"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="cb-auth-field__action"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        {passwordError ? <span className="cb-auth-field__error">{passwordError}</span> : null}
      </div>

      <div className="cb-auth-field">
        <label className="cb-auth-field__label" htmlFor="emp-confirm-password">
          Confirm Password
        </label>
        <div className={`cb-auth-field__control ${confirmPasswordError ? 'is-error' : ''}`}>
          <span className="cb-auth-field__icon">
            <LockIcon />
          </span>
          <input
            id="emp-confirm-password"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            required
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              if (!touched.confirmPassword) markTouched('confirmPassword');
            }}
            onBlur={() => markTouched('confirmPassword')}
            className="cb-auth-field__input"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="cb-auth-field__action"
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
          >
            {showConfirmPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        {confirmPasswordError ? <span className="cb-auth-field__error">{confirmPasswordError}</span> : null}
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
            onClick={() => {
              setOtpChannel('EMAIL');
              if (!workEmail) markTouched('workEmail');
            }}
            className={`cb-auth-otp__btn${otpChannel === 'EMAIL' ? ' is-active' : ''}`}
          >
            Email OTP
          </button>
        </div>
        <p className="cb-auth-field__hint">
          {!otpChannel
            ? 'Choose Mobile OTP or Email OTP.'
            : otpChannel === 'EMAIL'
              ? 'A 6-digit OTP will be sent to your work email.'
              : 'A 6-digit OTP will be sent to your mobile number.'}
        </p>
      </div>

      <label className="cb-auth-check">
        <input
          type="checkbox"
          required
          checked={agreeTerms}
          onChange={(e) => {
            setAgreeTerms(e.target.checked);
            markTouched('agreeTerms');
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
        </span>
      </label>
      {termsError ? <span className="cb-auth-field__error">{termsError}</span> : null}

      {error ? <div className="cb-auth-alert">{error}</div> : null}

      <Button type="submit" loading={loading} loadingLabel="Creating Account..." className="w-full">
        REGISTER
      </Button>
    </form>
  );
}
