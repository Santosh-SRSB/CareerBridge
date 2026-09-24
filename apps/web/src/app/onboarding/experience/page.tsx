'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EXPERIENCE_OPTIONS } from '@careerbridge/shared';
import {
  OB,
  OnboardingActions,
  OnboardingFrame,
  OnboardingHero,
  OnboardingQuestion,
  OnboardingStepHeader,
  onboardingInputClass,
  onboardingPrimaryButtonClass,
} from '@/components/OnboardingFrame';
import { Button } from '@/components/ui/Button';
import { patchStoredUser } from '@/lib/session';
import { addExperience, getCandidateMe, updateCandidateMe } from '@/lib/api';
import { useOnboardingGate } from '@/hooks/useOnboardingGate';
import { DatePicker } from '@/features/candidate/passport/DatePicker';

export default function OnboardingExperiencePage() {
  const router = useRouter();
  const [hasExperience, setHasExperience] = useState('');
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentlyWorking, setCurrentlyWorking] = useState(false);
  const [noticePreset, setNoticePreset] = useState('');
  const [noticeMonths, setNoticeMonths] = useState('');
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

  function resolveNoticePeriod(): string | undefined {
    if (!showJobForm) return undefined;
    if (noticePreset === 'CUSTOM') {
      const months = Number(noticeMonths.trim());
      if (!Number.isFinite(months) || months < 1) return undefined;
      return `${months} month${months === 1 ? '' : 's'}`;
    }
    return noticePreset || undefined;
  }

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
      if (!/^\d+(\.\d{1,2})?$/.test(experienceYears.trim())) {
        setError('Years of experience must be a number (e.g. 1 or 1.5). No letters.');
        return;
      }
      const yearsNum = Number(experienceYears.trim());
      if (!Number.isFinite(yearsNum) || yearsNum < 0 || yearsNum > 50) {
        setError('Enter a valid experience between 0 and 50 years.');
        return;
      }
      if (!startDate || (!currentlyWorking && !endDate)) {
        setError('Select from and to dates for your experience.');
        return;
      }
      if (!noticePreset) {
        setError('Select your notice period / availability.');
        return;
      }
      if (noticePreset === 'CUSTOM') {
        const months = Number(noticeMonths.trim());
        if (!Number.isFinite(months) || months < 1 || months > 24) {
          setError('Enter notice period in months (1–24).');
          return;
        }
      }
    }
    setError('');
    setLoading(true);
    try {
      const noticePeriod = resolveNoticePeriod();
      let profile = await updateCandidateMe({
        hasExperience,
        experienceLevel: hasExperience === 'YES' ? 'experienced' : 'fresher',
        ...(showJobForm
          ? {
              totalExperienceYears: experienceYears.trim() || '0',
              totalExperienceMonths: '0',
              ...(noticePeriod ? { noticePeriod } : {}),
            }
          : {}),
        onboardingCompleted: true,
      });
      if (showJobForm) {
        profile = await addExperience({
          company: company.trim(),
          jobTitle: jobTitle.trim(),
          startDate: `${startDate}-01`,
          endDate: currentlyWorking ? undefined : `${endDate}-01`,
          stillInCompany: currentlyWorking,
          isInternship: false,
        });
        profile = await updateCandidateMe({
          onboardingCompleted: true,
          hasExperience: 'YES',
          experienceLevel: 'experienced',
          totalExperienceYears: experienceYears.trim() || '0',
          totalExperienceMonths: '0',
          ...(noticePeriod ? { noticePeriod } : {}),
        });
      } else if (hasExperience === 'INTERNSHIP' && (company.trim() || jobTitle.trim())) {
        profile = await addExperience({
          company: company.trim() || 'Internship',
          jobTitle: jobTitle.trim() || 'Intern',
          stillInCompany: false,
          isInternship: true,
        });
        profile = await updateCandidateMe({
          onboardingCompleted: true,
          hasExperience: 'INTERNSHIP',
          experienceLevel: 'fresher',
        });
      }
      patchStoredUser({
        firstName: profile.firstName,
        onboardingCompleted: true,
      });
      router.replace('/onboarding/dossier');
    } catch {
      setError('We could not save your experience right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function selectExperience(value: string) {
    setHasExperience(value);
    setError('');
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
    <OnboardingFrame step={4}>
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="cb-ob-hide-scrollbar min-h-0 flex-1 space-y-3.5 overflow-y-auto overflow-x-hidden pb-1">
          <OnboardingHero tone="teal">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke={OB.teal800}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
            </svg>
          </OnboardingHero>

          <OnboardingStepHeader
            title="Work experience"
            subtitle="Do you have prior work experience?"
          />

          <div className="mb-1 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {EXPERIENCE_OPTIONS.map((option) => {
              const active = hasExperience === option.value;
              const label =
                option.value === 'NONE'
                  ? 'No, fresher'
                  : option.value === 'INTERNSHIP'
                    ? 'Internship'
                    : option.label;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => selectExperience(option.value)}
                  className="flex h-auto flex-col items-center gap-1.5 rounded-[10px] border px-2 py-3.5 text-sm transition active:scale-[0.97]"
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
                  {option.value === 'YES' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : option.value === 'NONE' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                      <circle cx="8.5" cy="7" r="4" />
                      <line x1="20" y1="8" x2="20" y2="14" />
                      <line x1="23" y1="11" x2="17" y2="11" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <rect x="2" y="7" width="20" height="14" rx="2" />
                      <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
                    </svg>
                  )}
                  <span className="text-center text-[13px] font-medium leading-tight">{label}</span>
                </button>
              );
            })}
          </div>

          {!hasExperience ? (
            <p className="text-[13px]" style={{ color: OB.textMuted }}>
              Select an option to continue.
            </p>
          ) : null}

          {showJobForm ? (
            <div className="space-y-3.5">
              <OnboardingQuestion title="Years of experience">
                <input
                  name="experienceYears"
                  type="text"
                  inputMode="decimal"
                  pattern="^\d+(\.\d{1,2})?$"
                  required
                  value={experienceYears}
                  onChange={(event) => {
                    const next = event.target.value.replace(/[^\d.]/g, '');
                    // Allow at most one decimal point and two fraction digits
                    const cleaned = next.replace(/(\..*)\./g, '$1').replace(/^(\d+)(\.\d{0,2})?.*$/, '$1$2');
                    setExperienceYears(cleaned);
                  }}
                  placeholder="e.g. 1.5"
                  className={onboardingInputClass}
                />
              </OnboardingQuestion>
              <OnboardingQuestion title="Most recent role">
                <input
                  name="jobTitle"
                  required
                  value={jobTitle}
                  onChange={(event) => setJobTitle(event.target.value)}
                  placeholder="e.g. Frontend developer"
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
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-[13px]" style={{ color: OB.muted }}>
                    From
                  </span>
                  <DatePicker
                    mode="month"
                    value={startDate}
                    onChange={setStartDate}
                    placeholder="Select month"
                    confirmLabel="Set start date"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[13px]" style={{ color: OB.muted }}>
                    To
                  </span>
                  <DatePicker
                    mode="month"
                    value={currentlyWorking ? '' : endDate}
                    onChange={setEndDate}
                    placeholder="Select month"
                    confirmLabel="Set end date"
                    disabled={currentlyWorking}
                  />
                </label>
              </div>
              <label
                className="mt-1 flex cursor-pointer items-center gap-2 text-sm font-medium"
                style={{ color: OB.ink }}
              >
                <input
                  type="checkbox"
                  checked={currentlyWorking}
                  onChange={(event) => {
                    setCurrentlyWorking(event.target.checked);
                    if (event.target.checked) setEndDate('');
                  }}
                  className="h-4 w-4 rounded border-[#d4d3cc] text-[#0B3D33]"
                />
                Currently working
              </label>

              <OnboardingQuestion title="Serving notice period / availability">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {[
                    { value: 'Immediate', label: 'Immediate' },
                    { value: '15 days', label: '15 days' },
                    { value: '30 days', label: '30 days' },
                    { value: '3 months', label: '3 months' },
                    { value: 'CUSTOM', label: 'Other months' },
                  ].map((opt) => {
                    const active = noticePreset === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setNoticePreset(opt.value);
                          if (opt.value !== 'CUSTOM') setNoticeMonths('');
                          setError('');
                        }}
                        className="rounded-[10px] border px-2 py-2.5 text-[13px] font-medium transition active:scale-[0.97]"
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
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {noticePreset === 'CUSTOM' ? (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={noticeMonths}
                      onChange={(e) => setNoticeMonths(e.target.value.replace(/\D/g, '').slice(0, 2))}
                      placeholder="e.g. 2"
                      className={`${onboardingInputClass} max-w-[7rem]`}
                      aria-label="Notice period months"
                    />
                    <span className="text-sm font-medium" style={{ color: OB.ink }}>
                      month(s)
                    </span>
                  </div>
                ) : null}
              </OnboardingQuestion>
            </div>
          ) : hasExperience === 'INTERNSHIP' ? (
            <div className="space-y-3.5">
              <OnboardingQuestion title="Company / Organisation">
                <input
                  name="company"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  placeholder="Optional"
                  className={onboardingInputClass}
                />
              </OnboardingQuestion>
              <OnboardingQuestion title="Role">
                <input
                  name="jobTitle"
                  value={jobTitle}
                  onChange={(event) => setJobTitle(event.target.value)}
                  placeholder="e.g. Intern"
                  className={onboardingInputClass}
                />
              </OnboardingQuestion>
            </div>
          ) : null}

          {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
        </div>

        <OnboardingActions step={4}>
          <Button
            type="submit"
            size="sm"
            block
            loading={loading}
            loadingLabel="Saving..."
            className={onboardingPrimaryButtonClass}
            style={{ background: OB.accent }}
          >
            Finish
          </Button>
        </OnboardingActions>
      </form>
    </OnboardingFrame>
  );
}
