'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
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
  const [otpChannel, setOtpChannel] = useState<'MOBILE' | 'EMAIL'>('MOBILE');

  // Touched state for real-time validation
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

  // Real-time validations matching wireframe E01
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

    // Mark all touched
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
    <form onSubmit={onSubmit} className="space-y-3.5" noValidate>
      {/* 1. Your Name */}
      <Input
        label="Your Name"
        name="yourName"
        required
        autoComplete="name"
        placeholder="Enter your name"
        value={yourName}
        error={yourNameError}
        onChange={(event) => {
          const sanitized = event.target.value.replace(/[^a-zA-Z\s.'-]/g, '');
          setYourName(sanitized);
          if (!touched.yourName) markTouched('yourName');
        }}
        onBlur={() => markTouched('yourName')}
      />

      {/* 2. Company Name */}
      <Input
        label="Company Name"
        name="companyName"
        required
        placeholder="Enter company name"
        value={companyName}
        error={companyNameError}
        onChange={(event) => {
          setCompanyName(event.target.value);
          if (!touched.companyName) markTouched('companyName');
        }}
        onBlur={() => markTouched('companyName')}
      />

      {/* 3. Work Email */}
      <Input
        label={`Work Email${otpChannel === 'EMAIL' ? ' *' : ''}`}
        name="workEmail"
        type="email"
        required={otpChannel === 'EMAIL'}
        placeholder="you@company.com"
        value={workEmail}
        error={workEmailError}
        onChange={(event) => {
          setWorkEmail(event.target.value);
          if (!touched.workEmail) markTouched('workEmail');
        }}
        onBlur={() => markTouched('workEmail')}
      />

      {/* 4. Mobile Number */}
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

      <div className="pt-1">
        <label className="mb-1.5 block text-xs font-bold text-primary">Verify via OTP on</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setOtpChannel('MOBILE')}
            className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-3 text-xs font-bold transition-all ${
              otpChannel === 'MOBILE'
                ? 'border-[#0a2e2c] bg-[#0a2e2c] text-white shadow-sm'
                : 'border-slate-200 bg-[#f8faf9] text-slate-600 hover:border-slate-300 hover:bg-white'
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span>Mobile OTP</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setOtpChannel('EMAIL');
              if (!workEmail) markTouched('workEmail');
            }}
            className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-3 text-xs font-bold transition-all ${
              otpChannel === 'EMAIL'
                ? 'border-[#0a2e2c] bg-[#0a2e2c] text-white shadow-sm'
                : 'border-slate-200 bg-[#f8faf9] text-slate-600 hover:border-slate-300 hover:bg-white'
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>Email OTP</span>
          </button>
        </div>
        <p className="mt-1.5 text-[11px] font-medium text-slate-500">
          {otpChannel === 'EMAIL'
            ? 'A 6-digit OTP will be sent to your work email.'
            : 'A 6-digit OTP will be sent to your mobile number.'}
        </p>
      </div>

      {/* 5. Password */}
      <div>
        <label className="mb-1.5 block text-xs font-bold text-primary" htmlFor="emp-password">
          Password
        </label>
        <div className="relative flex items-center">
          <input
            id="emp-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="new-password"
            placeholder="Min 8 chars (e.g. Pass@123)"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (!touched.password) markTouched('password');
            }}
            onBlur={() => markTouched('password')}
            className={`w-full rounded-xl border bg-[#f8faf9] px-3.5 py-2.5 pr-10 text-xs font-semibold text-primary outline-none transition focus:bg-white focus:ring-2 ${
              passwordError
                ? 'border-error focus:border-error focus:ring-error/20'
                : 'border-primary/15 focus:border-teal focus:ring-teal/20'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 text-slate-400 hover:text-slate-700 transition"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        {passwordError ? (
          <span className="mt-1 block text-[11px] font-medium text-error">{passwordError}</span>
        ) : null}
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-bold text-primary" htmlFor="emp-confirm-password">
          Confirm Password
        </label>
        <div className="relative flex items-center">
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
            className={`w-full rounded-xl border bg-[#f8faf9] px-3.5 py-2.5 pr-10 text-xs font-semibold text-primary outline-none transition focus:bg-white focus:ring-2 ${
              confirmPasswordError
                ? 'border-error focus:border-error focus:ring-error/20'
                : 'border-primary/15 focus:border-teal focus:ring-teal/20'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 text-slate-400 transition hover:text-slate-700"
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
          >
            {showConfirmPassword ? (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        {confirmPasswordError ? (
          <span className="mt-1 block text-[11px] font-medium text-error">{confirmPasswordError}</span>
        ) : null}
      </div>

      {/* 6. Checkbox: I agree to Terms & Privacy Policy */}
      <div className="pt-1">
        <label className="flex items-start gap-2.5 cursor-pointer text-xs font-semibold text-slate-600 hover:text-slate-900">
          <input
            type="checkbox"
            required
            checked={agreeTerms}
            onChange={(e) => {
              setAgreeTerms(e.target.checked);
              markTouched('agreeTerms');
            }}
            className="mt-0.5 h-4 w-4 rounded border-primary/20 text-[#0a2e2c] focus:ring-[#0d9488]"
          />
          <span>
            I agree to <a href="/terms" target="_blank" className="text-[#0d9488] hover:underline">Terms & Privacy Policy</a>
          </span>
        </label>
        {termsError ? (
          <span className="mt-1 block text-[11px] font-medium text-error">{termsError}</span>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-error/20 bg-error/5 p-2.5 text-xs font-semibold text-error">
          {error}
        </div>
      ) : null}

      {/* 7. Button: Create Employer Account */}
      <Button
        type="submit"
        loading={loading}
        loadingLabel="Creating Account..."
        className="w-full py-3.5 text-sm font-bold bg-[#0a2e2c] hover:bg-[#072422] text-white shadow-md hover:shadow-lg transition mt-3 rounded-xl"
      >
        Create Employer Account
      </Button>
    </form>
  );
}
