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
import { REGISTRATION_PASSWORD_HINT, registrationPasswordError } from '@careerbridge/shared';

export function EmployerRegisterForm() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [industry, setIndustry] = useState('Customer Service');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dial, setDial] = useState<string>(DEFAULT_COUNTRY.dial);
  const [national, setNational] = useState('');
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
    if (companyName.trim().length < 2 || contactName.trim().length < 2 || city.trim().length < 2) {
      setError('Fill in company, contact person, and location.');
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
        channel: 'EMAIL',
        purpose: 'REGISTER',
        accountType: 'EMPLOYER',
        phone,
        email: email.trim(),
        fullName: contactName.trim(),
        location: city.trim(),
        companyName: companyName.trim(),
        industry: industry.trim(),
        password,
      });
      setPendingPassword(password);
      saveOtpFlow({
        requestId: result.requestId,
        phone,
        email: email.trim(),
        channel: 'EMAIL',
        purpose: 'REGISTER',
        expiresAt: Date.now() + result.expiresIn * 1000,
        registration: {
          email: email.trim(),
          fullName: contactName.trim(),
          location: city.trim(),
          accountType: 'EMPLOYER',
          companyName: companyName.trim(),
          industry: industry.trim(),
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
      <Input label="Company name" name="companyName" required value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
      <Input label="Contact person" name="contactName" required value={contactName} onChange={(event) => setContactName(event.target.value)} />
      <Input
        label="Business email"
        name="email"
        type="email"
        required
        hint="We will send a one-time password to this email."
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <PhoneField
        dial={dial}
        national={national}
        onDialChange={setDial}
        onNationalChange={setNational}
        hint="Use this number later to sign in."
      />
      <Input label="Industry" name="industry" required value={industry} onChange={(event) => setIndustry(event.target.value)} />
      <Input label="Location" name="city" required value={city} onChange={(event) => setCity(event.target.value)} />
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
      <Button type="submit" loading={loading} loadingLabel="Sending OTP...">
        Send email OTP
      </Button>
    </form>
  );
}
