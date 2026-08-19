'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingFrame } from '@/components/OnboardingFrame';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { getStoredUser } from '@/lib/session';
import { getCandidateMe, updateCandidateMe } from '@/lib/api';

export default function OnboardingLocationPage() {
  const router = useRouter();
  const [city, setCity] = useState('');
  const [openToRelocating, setOpenToRelocating] = useState(false);
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
        setCity(profile.city || '');
        setOpenToRelocating(profile.openToRelocating);
      })
      .finally(() => setReady(true));
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (city.trim().length < 2) {
      setError('Enter your current city.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await updateCandidateMe({ city: city.trim(), openToRelocating });
      router.push('/onboarding/education');
    } catch {
      setError('We could not save your details right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return null;

  return (
    <OnboardingFrame step={2} title="Where are you looking for work?" subtitle="This helps us show nearby opportunities.">
      <form onSubmit={onSubmit} className="space-y-5">
        <Input
          label="Current city"
          name="city"
          required
          autoComplete="address-level2"
          placeholder="Chennai"
          value={city}
          onChange={(event) => setCity(event.target.value)}
        />
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={openToRelocating}
            onChange={(event) => setOpenToRelocating(event.target.checked)}
          />
          Open to relocating
        </label>
        {error ? <p className="text-sm text-error">{error}</p> : null}
        <Button type="submit" loading={loading} loadingLabel="Saving...">
          Continue
        </Button>
      </form>
    </OnboardingFrame>
  );
}
