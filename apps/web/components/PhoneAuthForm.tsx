'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PhoneField } from '@/components/PhoneField';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { OtpChannelToggle } from '@/components/OtpChannelToggle';
import { COUNTRIES, DEFAULT_COUNTRY, isValidNational, toE164 } from '@/lib/phone';
import { requestOtp } from '@/lib/api';
import { saveOtpFlow } from '@/lib/otp-flow';
import { isDevOtpEnabled, isFirebaseConfigured, sendFirebaseOtp, usesFirebasePhoneOtp } from '@/lib/firebase';
import { authErrorMessage } from '@/lib/auth-errors';
import type { AuthPurpose, OtpChannel } from '@careerbridge/shared';

export function PhoneAuthForm({ purpose }: { purpose: AuthPurpose }) {
  const router = useRouter();
  const [channel, setChannel] = useState<OtpChannel>('MOBILE');
  const [dial, setDial] = useState<string>(DEFAULT_COUNTRY.dial);
  const [national, setNational] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const country = COUNTRIES.find((item) => item.dial === dial) || DEFAULT_COUNTRY;
    const phone = channel === 'MOBILE' ? toE164(dial, national) : undefined;
    if (channel === 'MOBILE' && !isValidNational(country.maxLength, national)) {
      setError('Enter a valid mobile number.');
      return;
    }
    if (channel === 'EMAIL' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const result = await requestOtp({
        channel,
        purpose,
        phone,
        email: email.trim() || undefined,
      });
      if (channel === 'MOBILE' && phone && usesFirebasePhoneOtp()) {
        if (!isFirebaseConfigured()) {
          throw new Error('Firebase OTP is not configured yet.');
        }
        await sendFirebaseOtp(phone);
      }
      saveOtpFlow({
        requestId: result.requestId,
        phone: phone || '',
        email: email.trim() || undefined,
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
    <form onSubmit={onSubmit} className="space-y-6">
      <OtpChannelToggle value={channel} onChange={setChannel} />
      {channel === 'MOBILE' ? (
        <PhoneField
          dial={dial}
          national={national}
          onDialChange={setDial}
          onNationalChange={setNational}
          error={error}
        />
      ) : (
        <Input
          label="Email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          hint="We will send a one-time password to this email."
          error={error}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      )}
      <Button type="submit" loading={loading} loadingLabel="Sending...">
        Send OTP
      </Button>
    </form>
  );
}
