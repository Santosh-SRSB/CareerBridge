'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { dateOfBirthError, personNameError } from '@careerbridge/shared';
import { PassportFrame, WizardActions } from '@/components/PassportFrame';
import { Input } from '@/components/ui/Input';
import { CitySelect } from '@/components/ui/CitySelect';
import { Button } from '@/components/ui/Button';
import { getStoredUser, patchStoredUser } from '@/lib/session';
import { getCandidateMe, updateCandidateMe } from '@/lib/api';
import { goToNextPassportStep } from '@/lib/passport-flow';

export default function PassportPersonalPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getStoredUser()) {
      router.replace('/login');
      return;
    }
    getCandidateMe()
      .then((profile) => {
        setFullName([profile.firstName, profile.lastName].filter(Boolean).join(' '));
        setDateOfBirth(profile.dateOfBirth || '');
        setGender(profile.gender || '');
        setCity(profile.city || '');
        setPhone(profile.phone || getStoredUser()?.phone || '');
        setEmail(profile.email || '');
      })
      .finally(() => setReady(true));
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const nameError = personNameError(fullName);
    if (nameError) {
      setError(nameError);
      return;
    }
    if (city.trim().length < 2) {
      setError('Select or enter your current city.');
      return;
    }
    const dobError = dateOfBirthError(dateOfBirth, true);
    if (dobError) {
      setError(dobError);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const profile = await updateCandidateMe({
        fullName: fullName.trim(),
        city: city.trim(),
        dateOfBirth,
        gender: gender || undefined,
      });
      patchStoredUser({ firstName: profile.firstName });
      await goToNextPassportStep(router, 'personal');
    } catch {
      setError('We could not save your details right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return <main className="cb-wizard text-muted">Loading your Career Passport...</main>;

  return (
    <PassportFrame
      title="Personal information"
      subtitle="Employers need to know who you are and where you are based."
      step="personal"
    >
      <form onSubmit={onSubmit} className="cb-passport-panel space-y-4 p-6 sm:p-7">
        <Input label="Full name" name="fullName" required value={fullName} onChange={(event) => setFullName(event.target.value)} />
        <CitySelect label="Current city" required value={city} onChange={setCity} />
        <Input label="Date of birth" name="dateOfBirth" type="date" required value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
        <label className="block" htmlFor="gender">
          <span className="mb-1.5 block text-sm font-semibold text-primary">Gender</span>
          <select
            id="gender"
            value={gender}
            onChange={(event) => setGender(event.target.value)}
            className="w-full rounded-md border border-primary/10 bg-[#faf8f3] px-3.5 py-3.5 text-base outline-none"
          >
            <option value="">Prefer not to say</option>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        {phone ? <Input label="Mobile number" name="phone" value={phone} readOnly /> : null}
        {email ? <Input label="Email" name="email" value={email} readOnly /> : null}
        {error ? <p className="text-sm text-error">{error}</p> : null}
        <WizardActions>
          <Button type="submit" size="md" block={false} loading={loading} loadingLabel="Saving...">
            Save and continue
          </Button>
        </WizardActions>
      </form>
    </PassportFrame>
  );
}
