'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PhoneField } from '@/components/PhoneField';
import { Input } from '@/components/ui/Input';
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

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
      />
    </svg>
  ) : (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
  const [otpChannel, setOtpChannel] = useState<'MOBILE' | 'EMAIL'>('MOBILE');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Input
        label="Full Name"
        name="fullName"
        required
        autoComplete="name"
        placeholder="Rahul Kumar"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
      />

      <PhoneField
        dial={dial}
        national={national}
        onDialChange={setDial}
        onNationalChange={setNational}
        hint="Use your WhatsApp number — it helps us reach you faster."
        error={error.includes('mobile') ? error : undefined}
      />

      <Input
        label="Email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <div>
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
            Mobile OTP
          </button>
          <button
            type="button"
            onClick={() => setOtpChannel('EMAIL')}
            className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-3 text-xs font-bold transition-all ${
              otpChannel === 'EMAIL'
                ? 'border-[#0a2e2c] bg-[#0a2e2c] text-white shadow-sm'
                : 'border-slate-200 bg-[#f8faf9] text-slate-600 hover:border-slate-300 hover:bg-white'
            }`}
          >
            Email OTP
          </button>
        </div>
        <p className="mt-1.5 text-[11px] font-medium text-slate-500">
          {otpChannel === 'EMAIL'
            ? 'A 6-digit OTP will be sent to your email.'
            : 'A 6-digit OTP will be sent to your mobile number.'}
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-bold text-primary" htmlFor="cand-password">
          Password
        </label>
        <div className="relative">
          <input
            id="cand-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="new-password"
            placeholder="Min 8 chars (e.g. Pass@123)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-primary/15 bg-[#f8faf9] px-3.5 py-2.5 pr-10 text-sm font-medium text-primary outline-none transition focus:border-teal focus:bg-white"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            <EyeIcon open={showPassword} />
          </button>
        </div>
        <p className="mt-1 text-[11px] font-medium text-slate-500">{REGISTRATION_PASSWORD_HINT}</p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-bold text-primary" htmlFor="cand-confirm-password">
          Confirm password
        </label>
        <div className="relative">
          <input
            id="cand-confirm-password"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            required
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-xl border border-primary/15 bg-[#f8faf9] px-3.5 py-2.5 pr-10 text-sm font-medium text-primary outline-none transition focus:border-teal focus:bg-white"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
          >
            <EyeIcon open={showConfirmPassword} />
          </button>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-primary/10 bg-[#f8faf9] p-3">
        <input
          type="checkbox"
          checked={whatsappOptIn}
          onChange={(event) => setWhatsappOptIn(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-primary/20 text-teal focus:ring-teal/30"
        />
        <span className="text-xs leading-relaxed text-[#4e6864]">
          <span className="font-semibold text-primary">WhatsApp notifications (optional).</span> Get
          quick interview updates on WhatsApp.
        </span>
      </label>

      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={agreedToTerms}
          onChange={(event) => setAgreedToTerms(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-primary/20 text-teal focus:ring-teal/30"
        />
        <span className="text-xs leading-relaxed text-[#4e6864]">
          I agree to the{' '}
          <Link href="/terms" className="font-semibold text-[#0d9488] hover:underline">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="font-semibold text-[#0d9488] hover:underline">
            Privacy Policy
          </Link>
        </span>
      </label>

      {error ? <p className="text-sm font-medium text-error">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-gradient-to-r from-[#0a2e2c] via-[#0d9488] to-[#14b8a6] px-4 py-3.5 text-base font-bold text-white shadow-[0_12px_28px_rgba(13,148,136,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(13,148,136,0.34)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Sending OTP...' : 'Create Profile'}
      </button>
    </form>
  );
}
