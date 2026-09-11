'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ONBOARDING_DOMAINS } from '@careerbridge/shared';
import {
  OB,
  OnboardingActions,
  OnboardingFrame,
  OnboardingQuestion,
  onboardingInputClass,
  onboardingOptionButtonClass,
  onboardingPrimaryButtonClass,
} from '@/components/OnboardingFrame';
import { Button } from '@/components/ui/Button';
import { getCandidateMe, updateCandidateMe } from '@/lib/api';
import { nextOnboardingStepPath } from '@/lib/onboarding-flow';
import { useOnboardingGate } from '@/hooks/useOnboardingGate';

export default function OnboardingDomainPage() {
  const router = useRouter();
  const [domain, setDomain] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const gateReady = useOnboardingGate(2);
  const [profileReady, setProfileReady] = useState(false);
  const ready = gateReady && profileReady;

  useEffect(() => {
    if (!gateReady) return;
    getCandidateMe()
      .then((profile) => {
        const saved = profile.careerInterests?.[0] || '';
        if (ONBOARDING_DOMAINS.includes(saved as (typeof ONBOARDING_DOMAINS)[number])) {
          setDomain(saved);
        } else if (saved) {
          setDomain('Other');
          setCustomDomain(saved);
        }
      })
      .finally(() => setProfileReady(true));
  }, [gateReady]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = domain === 'Other' ? customDomain.trim() : domain;
    if (!value) {
      setError('Select your domain.');
      return;
    }
    if (domain === 'Other' && value.length < 2) {
      setError('Enter your domain.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await updateCandidateMe({ careerInterests: [value] });
      router.push(nextOnboardingStepPath(2));
    } catch {
      setError('We could not save your domain right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function onSkip() {
    router.push(nextOnboardingStepPath(2));
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm" style={{ background: OB.bg, color: OB.muted }}>
        Loading...
      </main>
    );
  }

  return (
    <OnboardingFrame step={2}>
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="cb-ob-hide-scrollbar min-h-0 flex-1 overflow-x-hidden">
          <OnboardingQuestion title="What is your domain?" hint="Pick the field you want to grow in.">
            <div className="flex flex-wrap gap-2">
              {ONBOARDING_DOMAINS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setDomain(item)}
                  className={onboardingOptionButtonClass(domain === item)}
                >
                  {item}
                </button>
              ))}
            </div>
            {domain === 'Other' ? (
              <input
                name="customDomain"
                required
                value={customDomain}
                onChange={(event) => setCustomDomain(event.target.value)}
                placeholder="Type your domain"
                className={`${onboardingInputClass} mt-3`}
              />
            ) : null}
          </OnboardingQuestion>
          {error ? <p className="mt-3 text-xs font-semibold text-red-600">{error}</p> : null}
        </div>

        <OnboardingActions onSkip={onSkip}>
          <Button
            type="submit"
            size="sm"
            block={false}
            loading={loading}
            loadingLabel="Saving..."
            className={onboardingPrimaryButtonClass}
            style={{ background: OB.moss }}
          >
            Continue
          </Button>
        </OnboardingActions>
      </form>
    </OnboardingFrame>
  );
}
