'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { dateOfBirthError, personNameError } from '@careerbridge/shared';
import { PassportFrame, PassportLoading, WizardActions, passportPrimaryButtonClass } from '@/components/PassportFrame';
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

  if (!ready) return <PassportLoading />;

  return (
    <PassportFrame
      title="Personal information"
      subtitle="Employers need to know who you are and where you are based."
      step="personal"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Full name"
          name="fullName"
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value.replace(/[^a-zA-Z\s.'-]/g, ''))}
        />
        <CitySelect label="Current city" required value={city} onChange={setCity} />
        <Input
          label="Date of birth"
          name="dateOfBirth"
          type="date"
          required
          value={dateOfBirth}
          onChange={(event) => setDateOfBirth(event.target.value)}
        />
        <label className="block" htmlFor="gender">
          <span className="mb-1.5 block text-xs font-bold text-slate-700">Gender</span>
          <select
            id="gender"
            value={gender}
            onChange={(event) => setGender(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-[#0a2e2c] focus:ring-2 focus:ring-[#0a2e2c]/10"
          >
            <option value="">Prefer not to say</option>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        {phone ? <Input label="Mobile number" name="phone" value={phone} readOnly /> : null}
        {email ? <Input label="Email" name="email" value={email} readOnly /> : null}
        {error ? <p className="text-sm font-semibold text-error">{error}</p> : null}
        <WizardActions>
          <Button
            type="submit"
            loading={loading}
            loadingLabel="Saving..."
            size="md"
            block={false}
            className={passportPrimaryButtonClass}
          >
            Save changes
          </Button>
        </WizardActions>
      </form>
    </PassportFrame>
  );
}
