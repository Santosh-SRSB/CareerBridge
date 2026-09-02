'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  OnboardingActions,
  OnboardingFrame,
  OnboardingQuestion,
  onboardingPrimaryButtonClass,
} from '@/components/OnboardingFrame';
import { CitySelect } from '@/components/ui/CitySelect';
import { Button } from '@/components/ui/Button';
import { patchStoredUser } from '@/lib/session';
import { getCandidateMe, updateCandidateMe } from '@/lib/api';
import { nextOnboardingStepPath } from '@/lib/onboarding-flow';
import { useOnboardingGate } from '@/hooks/useOnboardingGate';

export default function OnboardingLocationPage() {
  const router = useRouter();
  const [city, setCity] = useState('');
  const [preferredWorkCity, setPreferredWorkCity] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const gateReady = useOnboardingGate(1);
  const [profileReady, setProfileReady] = useState(false);
  const ready = gateReady && profileReady;

  useEffect(() => {
    if (!gateReady) return;
    getCandidateMe()
      .then((profile) => {
        const currentCity = profile.city?.trim() || '';
        setCity(currentCity);
        setPreferredWorkCity(profile.preferredWorkCity?.trim() || currentCity);
      })
      .finally(() => setProfileReady(true));
  }, [gateReady]);

  async function saveAndContinue() {
    if (city.trim().length < 2) {
      setError('Select where you are currently located.');
      return false;
    }
    if (preferredWorkCity.trim().length < 2) {
      setError('Select where you would like to work.');
      return false;
    }
    setError('');
    setLoading(true);
    try {
      const profile = await updateCandidateMe({
        city: city.trim(),
        preferredWorkCity: preferredWorkCity.trim(),
        openToRelocating: city.trim().toLowerCase() !== preferredWorkCity.trim().toLowerCase(),
      });
      patchStoredUser({ firstName: profile.firstName });
      router.push(nextOnboardingStepPath(1));
      return true;
    } catch {
      setError('We could not save your location right now. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await saveAndContinue();
  }

  function onSkip() {
    router.push(nextOnboardingStepPath(1));
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#faf8f4] text-sm text-slate-500">
        Loading...
      </main>
    );
  }

  return (
    <OnboardingFrame step={1}>
      <form onSubmit={onSubmit} className="space-y-6">
        <OnboardingQuestion title="Where are you currently located?">
          <CitySelect id="current-city" label="" required value={city} onChange={setCity} />
        </OnboardingQuestion>

        <OnboardingQuestion title="Where would you like to work?">
          <CitySelect
            id="work-city"
            label=""
            required
            value={preferredWorkCity}
            onChange={setPreferredWorkCity}
          />
        </OnboardingQuestion>

        {error ? <p className="text-xs font-semibold text-error">{error}</p> : null}

        <OnboardingActions onSkip={onSkip}>
          <Button
            type="submit"
            size="sm"
            block={false}
            loading={loading}
            loadingLabel="Saving..."
            className={onboardingPrimaryButtonClass}
          >
            Continue
          </Button>
        </OnboardingActions>
      </form>
    </OnboardingFrame>
  );
}
