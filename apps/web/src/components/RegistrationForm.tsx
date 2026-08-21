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
import { setPendingPassword } from '@/lib/pending-password';
import { isDevOtpEnabled, isFirebaseConfigured, sendFirebaseOtp } from '@/lib/firebase';
import { authErrorMessage } from '@/lib/auth-errors';
import { PREFERRED_LANGUAGES, REGISTRATION_PASSWORD_HINT, registrationPasswordError } from '@careerbridge/shared';
import type { OtpChannel } from '@careerbridge/shared';

export function RegistrationForm() {
  const router = useRouter();
  const [channel, setChannel] = useState<OtpChannel>('EMAIL');
  const [dial, setDial] = useState(DEFAULT_COUNTRY.dial);
  const [national, setNational] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [location, setLocation] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('English');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const country = COUNTRIES.find((item) => item.dial === dial) || DEFAULT_COUNTRY;
    if (!isValidNational(country.maxLength, national)) {
      setError('Enter a valid mobile number.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (fullName.trim().length < 2) {
      setError('Enter your name.');
      return;
    }
    if (location.trim().length < 2) {
      setError('Enter your location.');
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
        channel,
        purpose: 'REGISTER',
        phone,
        email: email.trim(),
        fullName: fullName.trim(),
        location: location.trim(),
        preferredLanguage,
        password,
      });
      if (channel === 'MOBILE' && !isDevOtpEnabled()) {
        if (!isFirebaseConfigured()) {
          throw new Error('Firebase OTP is not configured yet.');
        }
        await sendFirebaseOtp(phone);
      }
      setPendingPassword(password);
      saveOtpFlow({
        requestId: result.requestId,
        phone,
        email: email.trim(),
        channel,
        purpose: 'REGISTER',
        expiresAt: Date.now() + result.expiresIn * 1000,
        registration: {
          email: email.trim(),
          fullName: fullName.trim(),
          location: location.trim(),
          preferredLanguage,
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
    <form onSubmit={onSubmit} className="space-y-3">
      <OtpChannelToggle value={channel} onChange={setChannel} />
      <p className="text-xs text-muted">
        {channel === 'MOBILE'
          ? 'We will send the OTP to your mobile number.'
          : 'We will send the OTP to your email address.'}
      </p>
      <Input
        label="Name"
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
        hint={
          channel === 'MOBILE'
            ? 'We will send a one-time password to this number.'
            : 'Saved to your Career Passport.'
        }
        error={error.includes('mobile') ? error : undefined}
      />
      <Input
        label="Email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        hint={
          channel === 'EMAIL'
            ? 'We will send a one-time password to this email.'
            : 'Saved to your Career Passport.'
        }
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Input
        label="Location"
        name="city"
        required
        autoComplete="address-level2"
        placeholder="Chennai"
        value={location}
        onChange={(event) => setLocation(event.target.value)}
      />
      <label className="block" htmlFor="preferredLanguage">
        <span className="mb-1.5 block text-sm font-medium">Preferred language</span>
        <select
          id="preferredLanguage"
          required
          value={preferredLanguage}
          onChange={(event) => setPreferredLanguage(event.target.value)}
          className="w-full rounded-sm border border-primary/20 bg-surface px-3 py-3 text-base"
        >
          {PREFERRED_LANGUAGES.map((language) => (
            <option key={language} value={language}>
              {language}
            </option>
          ))}
        </select>
      </label>
      <Input
        label="Password"
        name="password"
        type="password"
        required
        autoComplete="new-password"
        hint={REGISTRATION_PASSWORD_HINT}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Input
        label="Confirm password"
        name="confirmPassword"
        type="password"
        required
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
      />
      {error ? <p className="text-sm text-error">{error}</p> : null}
      <Button type="submit" loading={loading} loadingLabel="Sending...">
        Send OTP
      </Button>
    </form>
  );
}
