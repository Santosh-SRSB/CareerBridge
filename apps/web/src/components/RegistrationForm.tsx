'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PhoneField } from '@/components/PhoneField';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { validateEmailAddress } from '@/lib/validation';
import { COUNTRIES, DEFAULT_COUNTRY, isValidNational, toE164 } from '@/lib/phone';
import { requestOtp } from '@/lib/api';
import { saveOtpFlow } from '@/lib/otp-flow';
import { authErrorMessage } from '@/lib/auth-errors';

export function RegistrationForm() {
  const router = useRouter();
  const [dial, setDial] = useState<string>(DEFAULT_COUNTRY.dial);
  const [national, setNational] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [otpChannel, setOtpChannel] = useState<'MOBILE' | 'EMAIL'>('MOBILE');
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [touched, setTouched] = useState({
    fullName: false,
    national: false,
    email: false,
    agreeTerms: false,
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const country = COUNTRIES.find((item) => item.dial === dial) || DEFAULT_COUNTRY;

  const fullNameError = (() => {
    if (!touched.fullName) return '';
    const trimmed = fullName.trim();
    if (!trimmed) return 'Full name is required.';
    if (trimmed.length < 2) return 'Full name must be at least 2 characters.';
    if (!/^[a-zA-Z\s.'-]+$/.test(trimmed)) return 'Name should only contain letters and spaces.';
    return '';
  })();

  const nationalError = (() => {
    if (!touched.national) return '';
    if (!national) return 'Mobile number is required.';
    if (!isValidNational(country.maxLength, national)) {
      return `Enter a valid ${country.maxLength}-digit mobile number.`;
    }
    return '';
  })();

  const emailError = (() => {
    if (!touched.email && otpChannel === 'MOBILE') return '';
    if (otpChannel === 'EMAIL' && !email.trim()) return 'Email is required for Email OTP verification.';
    if (!email.trim()) return '';
    return validateEmailAddress(email, otpChannel === 'EMAIL') || '';
  })();

  const termsError = touched.agreeTerms && !agreeTerms ? 'You must agree to the Terms and Privacy Policy.' : '';

  function markTouched(field: keyof typeof touched) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    setTouched({
      fullName: true,
      national: true,
      email: true,
      agreeTerms: true,
    });

    if (fullName.trim().length < 2) {
      setError('Enter your full name.');
      return;
    }

    if (!/^[a-zA-Z\s.'-]+$/.test(fullName.trim())) {
      setError('Name should only contain letters and spaces.');
      return;
    }

    if (!isValidNational(country.maxLength, national)) {
      setError('Enter a valid mobile number.');
      return;
    }

    if (otpChannel === 'EMAIL') {
      if (!email.trim()) {
        setError('Please enter your email to receive the OTP.');
        return;
      }
      const emailValidationError = validateEmailAddress(email.trim(), true);
      if (emailValidationError) {
        setError(emailValidationError);
        return;
      }
    } else if (email.trim()) {
      const emailValidationError = validateEmailAddress(email.trim(), false);
      if (emailValidationError) {
        setError(emailValidationError);
        return;
      }
    }

    if (!agreeTerms) {
      setError('You must agree to the Terms and Privacy Policy to continue.');
      return;
    }

    const phone = toE164(dial, national);
    const fullEmail = email.trim() || undefined;

    setLoading(true);
    try {
      const result = await requestOtp({
        channel: otpChannel,
        purpose: 'REGISTER',
        accountType: 'CANDIDATE',
        phone,
        email: fullEmail,
        fullName: fullName.trim(),
      });

      saveOtpFlow({
        requestId: result.requestId,
        phone,
        email: fullEmail,
        channel: otpChannel,
        purpose: 'REGISTER',
        expiresAt: Date.now() + result.expiresIn * 1000,
        registration: {
          email: fullEmail,
          fullName: fullName.trim(),
          accountType: 'CANDIDATE',
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
      <Input
        label="Full Name"
        name="fullName"
        required
        autoComplete="name"
        placeholder="Enter your full name"
        value={fullName}
        error={fullNameError}
        onChange={(event) => {
          const sanitized = event.target.value.replace(/[^a-zA-Z\s.'-]/g, '');
          setFullName(sanitized);
          if (!touched.fullName) markTouched('fullName');
        }}
        onBlur={() => markTouched('fullName')}
      />

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

      <Input
        label={`Email${otpChannel === 'EMAIL' ? ' *' : ''}`}
        name="email"
        type="email"
        required={otpChannel === 'EMAIL'}
        autoComplete="email"
        placeholder="Enter your email"
        value={email}
        error={emailError}
        onChange={(event) => {
          setEmail(event.target.value);
          if (!touched.email) markTouched('email');
        }}
        onBlur={() => markTouched('email')}
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
              if (!email) markTouched('email');
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
      </div>

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
            I agree to the <a href="/terms" target="_blank" className="text-[#0d9488] hover:underline">Terms and Privacy Policy</a>
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

      <Button
        type="submit"
        loading={loading}
        loadingLabel="Creating Profile..."
        className="w-full py-3.5 text-sm font-bold bg-[#0a2e2c] hover:bg-[#072422] text-white shadow-md hover:shadow-lg transition mt-3 rounded-xl"
      >
        Create Profile
      </Button>
    </form>
  );
}
