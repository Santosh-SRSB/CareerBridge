'use client';

import { FormEvent, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ONBOARDING_DOMAINS } from '@careerbridge/shared';
import {
  OB,
  OnboardingActions,
  OnboardingFrame,
  OnboardingQuestion,
  OnboardingStepHeader,
  onboardingInputClass,
  onboardingPrimaryButtonClass,
} from '@/components/OnboardingFrame';
import { Button } from '@/components/ui/Button';
import { getCandidateMe, updateCandidateMe } from '@/lib/api';
import { nextOnboardingStepPath } from '@/lib/onboarding-flow';
import { useOnboardingGate } from '@/hooks/useOnboardingGate';

const DOMAIN_ICONS: Record<string, ReactNode> = {
  IT: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 3L2 12l6 9M16 3l6 9-6 9" />
    </svg>
  ),
  'Non-IT': (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  Finance: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  ),
  Healthcare: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0012 3a5.5 5.5 0 00-10 5.5c0 2.29 1.51 4.04 3 5.5l7 7z" />
    </svg>
  ),
  Retail: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  Operations: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
  Manufacturing: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  ),
  Other: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
};

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

  if (!ready) {
    return (
      <main
        className="flex min-h-screen items-center justify-center text-sm"
        style={{ background: OB.bg, color: OB.muted }}
      >
        Loading...
      </main>
    );
  }

  return (
    <OnboardingFrame step={2}>
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="cb-ob-hide-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-1">
          <OnboardingStepHeader
            title="Choose your domain"
            subtitle="Pick the field you work or want to work in."
          />

          <OnboardingQuestion title="What is your domain?">
            <div className="grid grid-cols-2 gap-2.5">
              {ONBOARDING_DOMAINS.map((item) => {
                const active = domain === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setDomain(item)}
                    className="flex min-h-[80px] flex-col items-center justify-center gap-2.5 rounded-[10px] border px-2 py-[18px] transition active:scale-[0.94]"
                    style={
                      active
                        ? {
                            borderColor: OB.accent,
                            background: OB.accentTint,
                            color: OB.accent,
                          }
                        : {
                            borderColor: OB.borderStrong,
                            background: OB.surface,
                            color: OB.ink,
                          }
                    }
                    aria-pressed={active}
                  >
                    {DOMAIN_ICONS[item] ?? DOMAIN_ICONS.Other}
                    <span className="text-[13px] font-medium">{item}</span>
                  </button>
                );
              })}
            </div>
            {domain === 'Other' ? (
              <div className="mt-3.5">
                <label className="mb-1.5 block text-[13px]" style={{ color: OB.muted }}>
                  Tell us your field
                </label>
                <input
                  name="customDomain"
                  required
                  value={customDomain}
                  onChange={(event) => setCustomDomain(event.target.value)}
                  placeholder="e.g. Legal, Healthcare, Logistics"
                  className={onboardingInputClass}
                />
              </div>
            ) : null}
          </OnboardingQuestion>
          {error ? <p className="mt-3 text-xs font-semibold text-red-600">{error}</p> : null}
        </div>

        <OnboardingActions step={2}>
          <Button
            type="submit"
            size="sm"
            block
            loading={loading}
            loadingLabel="Saving..."
            className={onboardingPrimaryButtonClass}
            style={{ background: OB.accent }}
          >
            Continue
          </Button>
        </OnboardingActions>
      </form>
    </OnboardingFrame>
  );
}
