'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EDUCATION_LEVELS } from '@careerbridge/shared';
import {
  OnboardingActions,
  OnboardingFrame,
  OnboardingQuestion,
  onboardingPrimaryButtonClass,
} from '@/components/OnboardingFrame';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { addEducation, getCandidateMe, updateCandidateMe } from '@/lib/api';
import { nextOnboardingStepPath } from '@/lib/onboarding-flow';
import { useOnboardingGate } from '@/hooks/useOnboardingGate';

const STANDARD_LEVELS = EDUCATION_LEVELS.filter((level) => level !== 'Other');

export default function OnboardingEducationPage() {
  const router = useRouter();
  const [qualification, setQualification] = useState('');
  const [otherEducation, setOtherEducation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const gateReady = useOnboardingGate(3);
  const [profileReady, setProfileReady] = useState(false);
  const ready = gateReady && profileReady;

  useEffect(() => {
    if (!gateReady) return;
    getCandidateMe()
      .then((profile) => {
        const saved = profile.highestEducation || profile.education[0]?.qualification || '';
        if (STANDARD_LEVELS.includes(saved as (typeof STANDARD_LEVELS)[number])) {
          setQualification(saved);
        } else if (saved) {
          setQualification('Other');
          setOtherEducation(saved);
        }
      })
      .finally(() => setProfileReady(true));
  }, [gateReady]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = qualification === 'Other' ? otherEducation.trim() : qualification;
    if (!value) {
      setError(qualification === 'Other' ? 'Enter your highest education.' : 'Select your highest education.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const profile = await getCandidateMe();
      await updateCandidateMe({ highestEducation: value });
      if (!profile.education.length) {
        await addEducation({ qualification: value });
      }
      router.push(nextOnboardingStepPath(3));
    } catch {
      setError('We could not save your education right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function onSkip() {
    router.push(nextOnboardingStepPath(3));
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#faf8f4] text-sm text-slate-500">
        Loading...
      </main>
    );
  }

  return (
    <OnboardingFrame step={3}>
      <form onSubmit={onSubmit} className="space-y-6">
        <OnboardingQuestion title="What is your highest education?">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-primary">Education type</span>
            <select
              required
              value={qualification}
              onChange={(event) => {
                setQualification(event.target.value);
                if (event.target.value !== 'Other') setOtherEducation('');
              }}
              className="w-full rounded-xl border border-primary/15 bg-[#f8faf9] px-3.5 py-2.5 text-sm font-medium text-primary outline-none transition focus:border-teal focus:bg-white focus:ring-2 focus:ring-teal/20"
            >
              <option value="">Select education</option>
              {EDUCATION_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          {qualification === 'Other' ? (
            <Input
              label="Specify education"
              name="otherEducation"
              required
              value={otherEducation}
              onChange={(event) => setOtherEducation(event.target.value)}
              placeholder="Type your highest education"
            />
          ) : null}
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
