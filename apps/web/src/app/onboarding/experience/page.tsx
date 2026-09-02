'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EXPERIENCE_OPTIONS } from '@careerbridge/shared';
import {
  OnboardingActions,
  OnboardingFrame,
  OnboardingQuestion,
  onboardingOptionButtonClass,
  onboardingPrimaryButtonClass,
} from '@/components/OnboardingFrame';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { patchStoredUser } from '@/lib/session';
import { addExperience, getCandidateMe, updateCandidateMe } from '@/lib/api';
import { useOnboardingGate } from '@/hooks/useOnboardingGate';

export default function OnboardingExperiencePage() {
  const router = useRouter();
  const [hasExperience, setHasExperience] = useState('');
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const gateReady = useOnboardingGate(4);
  const [profileReady, setProfileReady] = useState(false);
  const ready = gateReady && profileReady;

  useEffect(() => {
    if (!gateReady) return;
    getCandidateMe()
      .then((profile) => {
        setHasExperience(profile.hasExperience || '');
        const latest = profile.experiences?.[0];
        if (latest) {
          setCompany(latest.company || '');
          setJobTitle(latest.jobTitle || '');
          setStartDate(latest.startDate?.slice(0, 7) || '');
          setEndDate(latest.endDate?.slice(0, 7) || '');
        }
        if (profile.totalExperienceYears) {
          setExperienceYears(String(profile.totalExperienceYears));
        }
      })
      .finally(() => setProfileReady(true));
  }, [gateReady]);

  const showJobForm = hasExperience === 'YES';

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!hasExperience) {
      setError('Tell us if you have previous work experience.');
      return;
    }
    if (showJobForm) {
      if (company.trim().length < 2 || jobTitle.trim().length < 2) {
        setError('Enter company and job title.');
        return;
      }
      if (!experienceYears.trim()) {
        setError('Enter how many years of experience you have.');
        return;
      }
      if (!startDate || !endDate) {
        setError('Select from and to dates for your experience.');
        return;
      }
    }
    setError('');
    setLoading(true);
    try {
      let profile = await updateCandidateMe({
        hasExperience,
        ...(showJobForm
          ? {
              totalExperienceYears: experienceYears.trim(),
              totalExperienceMonths: '0',
            }
          : {}),
        onboardingCompleted: true,
      });
      if (showJobForm) {
        profile = await addExperience({
          company: company.trim(),
          jobTitle: jobTitle.trim(),
          startDate: `${startDate}-01`,
          endDate: `${endDate}-01`,
          isInternship: false,
        });
        profile = await updateCandidateMe({ onboardingCompleted: true });
      }
      patchStoredUser({
        firstName: profile.firstName,
        onboardingCompleted: true,
      });
      router.replace('/dashboard');
    } catch {
      setError('We could not save your experience right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function onSkip() {
    setLoading(true);
    try {
      const profile = await updateCandidateMe({ onboardingCompleted: true });
      patchStoredUser({ onboardingCompleted: profile.onboardingCompleted });
    } catch {
      // ignored
    } finally {
      setLoading(false);
      router.replace('/dashboard');
    }
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#faf8f4] text-sm text-slate-500">
        Loading...
      </main>
    );
  }

  return (
    <OnboardingFrame step={4}>
      <form onSubmit={onSubmit} className="space-y-6">
        <OnboardingQuestion title="Do you have previous work experience?">
          <div className="space-y-2">
            {EXPERIENCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setHasExperience(option.value)}
                className={`w-full ${onboardingOptionButtonClass(hasExperience === option.value)}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </OnboardingQuestion>

        {showJobForm ? (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
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
            <Input
              label="Years of experience"
              name="experienceYears"
              type="number"
              min={0}
              max={50}
              required
              value={experienceYears}
              onChange={(event) => setExperienceYears(event.target.value)}
              placeholder="e.g. 2"
            />
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-primary">From</span>
                <input
                  type="month"
                  required
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="w-full rounded-xl border border-primary/15 bg-[#f8faf9] px-3 py-2 text-xs font-semibold text-primary outline-none focus:border-teal focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-primary">To</span>
                <input
                  type="month"
                  required
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="w-full rounded-xl border border-primary/15 bg-[#f8faf9] px-3 py-2 text-xs font-semibold text-primary outline-none focus:border-teal focus:bg-white"
                />
              </label>
            </div>
          </div>
        ) : hasExperience === 'NONE' ? (
          <p className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
            That&apos;s okay. You can add experience later in your Career Passport.
          </p>
        ) : hasExperience === 'INTERNSHIP' ? (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <Input
              label="Company / Organisation"
              name="company"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
            />
            <Input
              label="Role"
              name="jobTitle"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
            />
          </div>
        ) : null}

        {error ? <p className="text-xs font-semibold text-error">{error}</p> : null}

        <OnboardingActions onSkip={() => void onSkip()} skipLabel="Skip for now">
          <Button
            type="submit"
            size="sm"
            block={false}
            loading={loading}
            loadingLabel="Saving..."
            className={onboardingPrimaryButtonClass}
          >
            Finish setup
          </Button>
        </OnboardingActions>
      </form>
    </OnboardingFrame>
  );
}
