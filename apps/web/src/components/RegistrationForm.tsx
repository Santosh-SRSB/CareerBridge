'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PhoneField } from '@/components/PhoneField';
import { Input } from '@/components/ui/Input';
import { COUNTRIES, DEFAULT_COUNTRY, isValidNational, toE164 } from '@/lib/phone';
import { requestOtp } from '@/lib/api';
import { saveOtpFlow } from '@/lib/otp-flow';
import { authErrorMessage } from '@/lib/auth-errors';
import { SearchableCreatableSelect } from '@/components/ui/SearchableCreatableSelect';
import { REGISTRATION_CITIES } from '@/data/india-locations';

const fieldClass =
  'w-full rounded-xl border border-primary/15 bg-[#f8faf9] px-3.5 py-2.5 text-sm font-medium text-primary outline-none transition focus:border-teal focus:bg-white';

export function RegistrationForm() {
  const router = useRouter();
  const [dial, setDial] = useState<string>(DEFAULT_COUNTRY.dial);
  const [national, setNational] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [location, setLocation] = useState('');
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (fullName.trim().length < 2) {
      setError('Enter your full name.');
      return;
    }
    if (!location.trim()) {
      setError('Select or enter your location.');
      return;
    }

    const phone = toE164(dial, national);
    setLoading(true);
    try {
      const result = await requestOtp({
        channel: 'EMAIL',
        purpose: 'REGISTER',
        accountType: 'CANDIDATE',
        phone,
        email: email.trim(),
        fullName: fullName.trim(),
        location: location.trim(),
        preferredLanguage: 'English',
        whatsappOptIn,
      });

      saveOtpFlow({
        requestId: result.requestId,
        phone,
        email: email.trim(),
        channel: 'EMAIL',
        purpose: 'REGISTER',
        expiresAt: Date.now() + result.expiresIn * 1000,
        registration: {
          email: email.trim(),
          fullName: fullName.trim(),
          location: location.trim(),
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
    <form onSubmit={onSubmit} className="space-y-4">
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
        hint=""
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

      <SearchableCreatableSelect
        label="Location"
        id="location"
        required
        value={location}
        onChange={setLocation}
        options={REGISTRATION_CITIES}
        placeholder="Search city or type your own…"
        allowCustom
      />

      <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-primary/10 bg-[#f8faf9] p-3">
        <input
          type="checkbox"
          checked={whatsappOptIn}
          onChange={(event) => setWhatsappOptIn(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-primary/20 text-teal focus:ring-teal/30"
        />
        <span className="text-xs leading-relaxed text-[#4e6864]">
          <span className="font-semibold text-primary">WhatsApp interview notifications (optional).</span>{' '}
          I agree to receive interview invitations, confirmations, and reminders on WhatsApp at the mobile
          number I provided. I can change this later in my profile. SMS/email/portal notifications may still
          be used if WhatsApp is unavailable.
        </span>
      </label>

      <label className="flex items-start gap-2.5 cursor-pointer">
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
