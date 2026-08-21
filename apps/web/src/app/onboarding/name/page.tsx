'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingFrame } from '@/components/OnboardingFrame';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { getStoredUser, patchStoredUser } from '@/lib/session';
import { getCandidateMe, updateCandidateMe } from '@/lib/api';

export default function OnboardingNamePage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    getCandidateMe()
      .then((profile) => {
        const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
        setFullName(name);
        setDateOfBirth(profile.dateOfBirth || '');
        setGender(profile.gender || '');
      })
      .finally(() => setReady(true));
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (fullName.trim().length < 2) {
      setError('Enter your full name.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const profile = await updateCandidateMe({
        fullName: fullName.trim(),
        dateOfBirth: dateOfBirth || undefined,
        gender: gender || undefined,
      });
      patchStoredUser({ firstName: profile.firstName });
      router.push('/onboarding/location');
    } catch {
      setError('We could not save your details right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return null;

  return (
    <OnboardingFrame step={1} title="Let's get to know you" subtitle="What should we call you?">
      <form onSubmit={onSubmit} className="space-y-5">
        <Input
          label="Full name"
          name="fullName"
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
        <Input
          label="Date of birth"
          name="dateOfBirth"
          type="date"
          value={dateOfBirth}
          onChange={(event) => setDateOfBirth(event.target.value)}
        />
        <label className="block" htmlFor="gender">
          <span className="mb-1.5 block text-sm font-medium">Gender</span>
          <select
            id="gender"
            value={gender}
            onChange={(event) => setGender(event.target.value)}
            className="w-full rounded-sm border border-primary/20 bg-surface px-3 py-3 text-base"
          >
            <option value="">Prefer not to say</option>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        {error ? <p className="text-sm text-error">{error}</p> : null}
        <Button type="submit" loading={loading} loadingLabel="Saving...">
          Continue
        </Button>
      </form>
    </OnboardingFrame>
  );
}
