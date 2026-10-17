'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PhoneField } from '@/components/PhoneField';
import { Input } from '@/components/ui/Input';
import { COUNTRIES, DEFAULT_COUNTRY, isValidNational, toE164 } from '@/lib/phone';
import { requestOtp } from '@/lib/api';
import { saveOtpFlow } from '@/lib/otp-flow';
import { authErrorMessage } from '@/lib/auth-errors';
import { validateEmailAddress } from '@/lib/validation';
import {
  isDevOtpEnabled,
  isFirebaseConfigured,
  sendFirebaseOtp,
} from '@/lib/firebase';
import type { AccountKind, AuthPurpose } from '@careerbridge/shared';

export function PhoneAuthForm({
  purpose,
  accountType = 'CANDIDATE',
}: {
  purpose: AuthPurpose;
  accountType?: AccountKind;
}) {
  const router = useRouter();
  const [channel, setChannel] = useState<'MOBILE' | 'EMAIL'>('MOBILE');
  const [dial, setDial] = useState<string>(DEFAULT_COUNTRY.dial);
  const [national, setNational] = useState('');
  const [email, setEmail] = useState('');

  // Touched state
  const [touched, setTouched] = useState({
    national: false,
    email: false,
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const country = COUNTRIES.find((item) => item.dial === dial) || DEFAULT_COUNTRY;

  const nationalError = (() => {
    if (!touched.national || channel !== 'MOBILE') return '';
    if (!national) return 'Mobile number is required.';
    if (!isValidNational(country.maxLength, national)) {
      return `Enter a valid ${country.maxLength}-digit mobile number.`;
    }
    return '';
  })();

  const emailError = (() => {
    if (!touched.email || channel !== 'EMAIL') return '';
    return validateEmailAddress(email, true) || '';
  })();

  function markTouched(field: keyof typeof touched) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    setTouched({ national: true, email: true });

    let phone = '';
    if (channel === 'MOBILE') {
      if (!isValidNational(country.maxLength, national)) {
        setError(`Enter a valid ${country.maxLength}-digit mobile number.`);
        return;
      }
      phone = toE164(dial, national);
    } else {
      const emailProblem = validateEmailAddress(email.trim(), true);
      if (emailProblem) {
        setError(emailProblem);
        return;
      }
    }

    setLoading(true);
    try {
      const result = await requestOtp({
        channel,
        purpose,
        phone: channel === 'MOBILE' ? phone : undefined,
        email: channel === 'EMAIL' ? email.trim() : undefined,
        accountType,
      });
      if (channel === 'MOBILE' && !isDevOtpEnabled()) {
        if (!isFirebaseConfigured()) {
          throw new Error('Firebase OTP is not configured yet.');
        }
        await sendFirebaseOtp(phone);
      }
      saveOtpFlow({
        requestId: result.requestId,
        phone: channel === 'MOBILE' ? phone : '',
        email: channel === 'EMAIL' ? email.trim() : '',
        channel,
        purpose,
        expiresAt: Date.now() + result.expiresIn * 1000,
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
      {/* Channel Switcher */}
      <div className="flex rounded-xl bg-[#eef4f1] p-1 text-xs font-bold border border-primary/10 shadow-inner">
        <button
          type="button"
          onClick={() => {
            setChannel('MOBILE');
            setError('');
            setTouched((prev) => ({ ...prev, national: false }));
          }}
          className={`flex-1 py-2 rounded-lg transition-all duration-200 ${
            channel === 'MOBILE' ? 'bg-[#0a2e2c] text-white shadow-sm' : 'text-primary/70 hover:text-primary'
          }`}
        >
          Mobile Number
        </button>
        <button
          type="button"
          onClick={() => {
            setChannel('EMAIL');
            setError('');
            setTouched((prev) => ({ ...prev, email: false }));
          }}
          className={`flex-1 py-2 rounded-lg transition-all duration-200 ${
            channel === 'EMAIL' ? 'bg-[#0a2e2c] text-white shadow-sm' : 'text-primary/70 hover:text-primary'
          }`}
        >
          Email Address
        </button>
      </div>

      {channel === 'MOBILE' ? (
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
          hint="We will send a 6-digit OTP to your number."
        />
      ) : (
        <Input
          label="Email Address"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          error={emailError}
          onChange={(event) => {
            setEmail(event.target.value);
            if (!touched.email) markTouched('email');
          }}
          onBlur={() => markTouched('email')}
          hint="We will send a 6-digit OTP to your email."
        />
      )}

      {error ? (
        <div className="rounded-xl border border-error/20 bg-error/5 p-2.5 text-xs font-semibold text-error">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-gradient-to-r from-[#0a2e2c] via-[#0d9488] to-[#14b8a6] px-4 py-3.5 text-base font-bold text-white shadow-[0_12px_28px_rgba(13,148,136,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(13,148,136,0.34)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Sending OTP...' : 'Send OTP'}
      </button>
    </form>
  );
}
