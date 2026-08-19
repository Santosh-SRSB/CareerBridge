'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EXPERIENCE_OPTIONS } from '@careerbridge/shared';
import { OnboardingFrame } from '@/components/OnboardingFrame';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { getStoredUser, patchStoredUser } from '@/lib/session';
import { addExperience, getCandidateMe, updateCandidateMe } from '@/lib/api';

export default function OnboardingExperiencePage() {
  const router = useRouter();
  const [hasExperience, setHasExperience] = useState('');
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getStoredUser()) {
      router.replace('/login');
      return;
    }
    getCandidateMe()
      .then((profile) => setHasExperience(profile.hasExperience || ''))
      .finally(() => setReady(true));
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!hasExperience) {
      setError('Tell us if you have previous work experience.');
      return;
    }
    if (hasExperience !== 'NONE' && (company.trim().length < 2 || jobTitle.trim().length < 2)) {
      setError('Enter company and job title, or choose No experience.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      let profile = await updateCandidateMe({ hasExperience });
      if (hasExperience !== 'NONE') {
        profile = await addExperience({
          company: company.trim(),
          jobTitle: jobTitle.trim(),
          isInternship: hasExperience === 'INTERNSHIP',
        });
      }
      patchStoredUser({
        firstName: profile.firstName,
        onboardingCompleted: profile.onboardingCompleted,
      });
      router.replace('/onboarding/complete');
    } catch {
      setError('We could not save your experience right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return null;

  return (
    <OnboardingFrame
      step={5}
      title="Do you have previous work experience?"
      subtitle="Many employers hire candidates with no previous experience."
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          {EXPERIENCE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setHasExperience(option.value)}
              className={`w-full rounded-sm border px-3 py-3 text-left font-semibold ${
                hasExperience === option.value
                  ? 'border-primary bg-primary text-accent'
                  : 'border-primary/20 bg-surface text-primary'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {hasExperience && hasExperience !== 'NONE' ? (
          <>
            <Input
              label="Company"
              name="company"
              required
              value={company}
              onChange={(event) => setCompany(event.target.value)}
            />
            <Input
              label="Job title"
              name="jobTitle"
              required
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
            />
          </>
        ) : hasExperience === 'NONE' ? (
          <p className="rounded-md bg-primary-soft p-3 text-sm text-primary">
            That&apos;s okay. You can add internships, projects or volunteer experience later.
          </p>
        ) : null}
        {error ? <p className="text-sm text-error">{error}</p> : null}
        <Button type="submit" loading={loading} loadingLabel="Saving...">
          Finish
        </Button>
      </form>
    </OnboardingFrame>
  );
}
