'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EXPERIENCE_OPTIONS } from '@careerbridge/shared';
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
import { patchStoredUser } from '@/lib/session';
import { addExperience, getCandidateMe, updateCandidateMe } from '@/lib/api';
import { useOnboardingGate } from '@/hooks/useOnboardingGate';

function parseExperienceYearsInput(raw: string) {
  const value = Number.parseFloat(raw.trim().replace(',', '.'));
  if (!Number.isFinite(value) || value < 0 || value > 50) return null;
  return value;
}

function toDateInputValue(iso?: string | null) {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export default function OnboardingExperiencePage() {
  const router = useRouter();
  const [hasExperience, setHasExperience] = useState('');
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentlyWorking, setCurrentlyWorking] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [moreBelow, setMoreBelow] = useState(false);
  const gateReady = useOnboardingGate(4);
  const [profileReady, setProfileReady] = useState(false);
  const ready = gateReady && profileReady;
  const scrollRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gateReady) return;
    getCandidateMe()
      .then((profile) => {
        setHasExperience(profile.hasExperience || '');
        const latest = profile.experiences?.[0];
        if (latest) {
          setCompany(latest.company || '');
          setJobTitle(latest.jobTitle || '');
          setStartDate(toDateInputValue(latest.startDate));
          setEndDate(toDateInputValue(latest.endDate));
          setCurrentlyWorking(Boolean(latest.stillInCompany));
        }
        if (profile.totalExperienceYears != null || profile.totalExperienceMonths != null) {
          const years = profile.totalExperienceYears || 0;
          const months = profile.totalExperienceMonths || 0;
          const decimal = years + months / 12;
          setExperienceYears(
            months ? String(Math.round(decimal * 10) / 10) : String(years),
          );
        }
      })
      .finally(() => setProfileReady(true));
  }, [gateReady]);

  const showJobForm = hasExperience === 'YES';

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !showJobForm) {
      setMoreBelow(false);
      return;
    }

    function updateMoreBelow() {
      if (!el) return;
      const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
      setMoreBelow(remaining > 12);
    }

    updateMoreBelow();
    el.addEventListener('scroll', updateMoreBelow, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateMoreBelow) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', updateMoreBelow);
      ro?.disconnect();
    };
  }, [showJobForm, jobTitle, company, experienceYears, startDate, endDate, currentlyWorking]);

  useEffect(() => {
    if (!showJobForm) return;
    const timer = window.setTimeout(() => {
      detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [showJobForm]);

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
      const yearsValue = parseExperienceYearsInput(experienceYears);
      if (yearsValue == null) {
        setError('Enter years of experience as a number (for example 2 or 2.5).');
        detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (!startDate) {
        setError('Select or enter the from date (day, month, year).');
        detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (!currentlyWorking && !endDate) {
        setError('Select or enter the to date, or tick “I am working currently”.');
        detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (!currentlyWorking && endDate && endDate < startDate) {
        setError('To date must be on or after the from date.');
        return;
      }
    }
    setError('');
    setLoading(true);
    try {
      let profile = await updateCandidateMe({
        hasExperience,
        experienceLevel: hasExperience === 'YES' ? 'experienced' : 'fresher',
        ...(showJobForm
          ? {
              totalExperienceYears: experienceYears.trim().replace(',', '.'),
              totalExperienceMonths: '0',
            }
          : {}),
        onboardingCompleted: true,
      });
      if (showJobForm) {
        profile = await addExperience({
          company: company.trim(),
          jobTitle: jobTitle.trim(),
          startDate,
          endDate: currentlyWorking ? undefined : endDate,
          stillInCompany: currentlyWorking,
          isInternship: false,
        });
        profile = await updateCandidateMe({ onboardingCompleted: true });
      }
      patchStoredUser({
        firstName: profile.firstName,
        onboardingCompleted: true,
      });
      router.replace('/onboarding/complete');
    } catch {
      setError('We could not save your experience right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm" style={{ background: OB.bg, color: OB.muted }}>
        Loading...
      </main>
    );
  }

  return (
    <OnboardingFrame step={4}>
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollRef}
            className="cb-ob-hide-scrollbar h-full min-h-0 space-y-3 overflow-x-hidden overflow-y-auto pr-0.5"
          >
            <OnboardingQuestion title="Work experience">
              <div className="flex flex-wrap gap-2">
                {EXPERIENCE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setHasExperience(option.value)}
                    className={onboardingOptionButtonClass(hasExperience === option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </OnboardingQuestion>

            {showJobForm ? (
              <div className="space-y-3">
                <OnboardingQuestion title="Current or most recent role">
                  <input
                    name="jobTitle"
                    required
                    value={jobTitle}
                    onChange={(event) => setJobTitle(event.target.value)}
                    placeholder="e.g. Sales executive"
                    className={onboardingInputClass}
                  />
                </OnboardingQuestion>
                <OnboardingQuestion title="Company">
                  <input
                    name="company"
                    required
                    value={company}
                    onChange={(event) => setCompany(event.target.value)}
                    placeholder="Company name"
                    className={onboardingInputClass}
                  />
                </OnboardingQuestion>

                <div
                  ref={detailsRef}
                  className="space-y-3 rounded-xl border px-3 py-3"
                  style={{ borderColor: 'rgba(10,46,44,0.14)', background: '#F7F9F4' }}
                >
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: OB.moss }}>
                    Also fill below
                  </p>
                  <OnboardingQuestion title="Years of experience">
                    <input
                      name="experienceYears"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={50}
                      step="0.1"
                      required
                      value={experienceYears}
                      onChange={(event) => setExperienceYears(event.target.value)}
                      placeholder="e.g. 2.5"
                      className={onboardingInputClass}
                    />
                  </OnboardingQuestion>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-semibold" style={{ color: OB.ink }}>
                        From
                      </span>
                      <input
                        type="date"
                        required
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                        className={onboardingInputClass}
                      />
                    </label>
                    <label className={`block ${currentlyWorking ? 'opacity-55' : ''}`}>
                      <span className="mb-1.5 block text-sm font-semibold" style={{ color: OB.ink }}>
                        To
                      </span>
                      <input
                        type="date"
                        required={!currentlyWorking}
                        disabled={currentlyWorking}
                        value={currentlyWorking ? '' : endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                        className={onboardingInputClass}
                      />
                    </label>
                  </div>
                  <label
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5"
                    style={{ borderColor: 'rgba(10,46,44,0.12)', background: '#fff' }}
                  >
                    <input
                      type="checkbox"
                      checked={currentlyWorking}
                      onChange={(event) => {
                        setCurrentlyWorking(event.target.checked);
                        if (event.target.checked) setEndDate('');
                      }}
                      className="h-4 w-4 accent-[#0a2e2c]"
                    />
                    <span className="text-sm font-semibold" style={{ color: OB.ink }}>
                      I am working currently
                    </span>
                  </label>
                </div>
              </div>
            ) : hasExperience === 'NONE' ? (
              <p
                className="rounded-lg border px-4 py-3 text-sm"
                style={{
                  borderColor: 'rgba(217, 164, 65, 0.35)',
                  color: OB.ink,
                  background: 'linear-gradient(135deg, #FBF7EC 0%, #F3F8F2 100%)',
                }}
              >
                ✨ That&apos;s okay. You can add experience later in your Career Passport.
              </p>
            ) : hasExperience === 'INTERNSHIP' ? (
              <div className="space-y-4">
                <OnboardingQuestion title="Company / Organisation">
                  <input
                    name="company"
                    value={company}
                    onChange={(event) => setCompany(event.target.value)}
                    className={onboardingInputClass}
                  />
                </OnboardingQuestion>
                <OnboardingQuestion title="Role">
                  <input
                    name="jobTitle"
                    value={jobTitle}
                    onChange={(event) => setJobTitle(event.target.value)}
                    className={onboardingInputClass}
                  />
                </OnboardingQuestion>
              </div>
            ) : null}

            {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
          </div>

          {showJobForm && moreBelow ? (
            <button
              type="button"
              onClick={() =>
                detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-1 bg-gradient-to-t from-white via-white/95 to-transparent pb-1 pt-6 text-xs font-bold"
              style={{ color: OB.moss }}
            >
              More fields below ↓
            </button>
          ) : null}
        </div>

        <OnboardingActions>
          <Button
            type="submit"
            size="sm"
            block={false}
            loading={loading}
            loadingLabel="Saving..."
            className={onboardingPrimaryButtonClass}
            style={{ background: OB.moss }}
          >
            Finish
          </Button>
        </OnboardingActions>
      </form>
    </OnboardingFrame>
  );
}
