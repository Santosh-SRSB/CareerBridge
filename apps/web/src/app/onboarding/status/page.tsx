'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DEFAULT_EXPERIENCE_LEVELS,
  EMPLOYMENT_STATUSES,
  employmentStatusNeedsExperience,
  type CatalogItem,
} from '@careerbridge/shared';
import {
  OB,
  OnboardingActions,
  OnboardingError,
  OnboardingFrame,
  OnboardingQuestion,
  OnboardingStepHeader,
  onboardingInputClass,
  onboardingPrimaryButtonClass,
} from '@/components/OnboardingFrame';
import { Button } from '@/components/ui/Button';
import { addExperience, getCandidateMe, getCatalog, updateCandidateMe } from '@/lib/api';
import { nextOnboardingStepPath, withSkippedStep } from '@/lib/onboarding-flow';
import { useOnboardingGate } from '@/hooks/useOnboardingGate';
import { ONBOARDING_SAVE_ERROR, useOnboardingSkip } from '@/hooks/useOnboardingSkip';

const STATUS_ERROR = 'Please select your employment status';
const EXPERIENCE_ERROR = 'Please select your years of experience';
const NOTICE_OPTIONS = ['Immediate', '15 days', '30 days', '2 months', '3 months'];

type LevelOption = Pick<CatalogItem, 'value' | 'label'>;

export default function OnboardingStatusPage() {
  const router = useRouter();
  const gateReady = useOnboardingGate(2);
  const [profileReady, setProfileReady] = useState(false);
  const [status, setStatus] = useState('');
  const [experienceRange, setExperienceRange] = useState('');
  const [levels, setLevels] = useState<LevelOption[] | null>(null);
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [hasExperienceRecords, setHasExperienceRecords] = useState(false);
  const [noticePeriod, setNoticePeriod] = useState('');
  const [skippedSteps, setSkippedSteps] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [saveFailed, setSaveFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const { skip, skipping, skipError } = useOnboardingSkip(2, skippedSteps);
  const needsExperience = employmentStatusNeedsExperience(status);

  useEffect(() => {
    if (!gateReady) return;
    getCandidateMe()
      .then((profile) => {
        setStatus(profile.employmentStatus || '');
        setExperienceRange(profile.experienceRange || '');
        setNoticePeriod(profile.noticePeriod || '');
        setHasExperienceRecords(profile.experiences.length > 0);
        setSkippedSteps(profile.onboardingSkippedSteps ?? []);
      })
      .finally(() => setProfileReady(true));
    getCatalog('experience-levels')
      .then((rows) => setLevels(rows.map(({ value, label }) => ({ value, label }))))
      .catch(() => setLevels(DEFAULT_EXPERIENCE_LEVELS));
  }, [gateReady]);

  function selectStatus(value: string) {
    setStatus(value);
    setError('');
    if (!employmentStatusNeedsExperience(value)) setExperienceRange('');
  }

  async function save() {
    setSaveFailed(false);
    if (!status) {
      setError(STATUS_ERROR);
      return;
    }
    if (needsExperience && !experienceRange) {
      setError(EXPERIENCE_ERROR);
      return;
    }
    setError('');
    setLoading(true);
    try {
      await updateCandidateMe({
        employmentStatus: status,
        ...(needsExperience ? { experienceRange } : {}),
        ...(status === 'EMPLOYED' && noticePeriod ? { noticePeriod } : {}),
        onboardingSkippedSteps: withSkippedStep(skippedSteps, 2, false),
      });
      if (needsExperience && !hasExperienceRecords && jobTitle.trim().length >= 2 && company.trim().length >= 2) {
        await addExperience({
          company: company.trim(),
          jobTitle: jobTitle.trim(),
          stillInCompany: status === 'EMPLOYED',
          isInternship: false,
        });
      }
      router.push(nextOnboardingStepPath(2));
    } catch {
      setError(ONBOARDING_SAVE_ERROR);
      setSaveFailed(true);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void save();
  }

  if (!gateReady || !profileReady) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm" style={{ background: OB.bg, color: OB.muted }}>
        Loading...
      </main>
    );
  }

  return (
    <OnboardingFrame step={2}>
      <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="cb-ob-hide-scrollbar min-h-0 flex-1 space-y-3.5 overflow-y-auto overflow-x-hidden pb-1">
          <OnboardingStepHeader
            title="Your work status"
            subtitle="This helps employers understand where you are in your career."
          />

          <fieldset aria-describedby={error === STATUS_ERROR ? 'status-error' : undefined}>
            <legend className="mb-2 text-[13px] font-medium" style={{ color: OB.muted }}>
              Employment status
            </legend>
            <div className="grid grid-cols-1 gap-2">
              {EMPLOYMENT_STATUSES.map((option) => {
                const active = status === option.value;
                return (
                  <label
                    key={option.value}
                    className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[10px] border px-3 text-sm font-medium transition"
                    style={
                      active
                        ? { borderColor: OB.accent, background: OB.accentTint, color: OB.accent }
                        : { borderColor: OB.borderStrong, background: OB.surface, color: OB.ink }
                    }
                  >
                    <input
                      type="radio"
                      name="employmentStatus"
                      value={option.value}
                      checked={active}
                      onChange={() => selectStatus(option.value)}
                      className="h-4 w-4 accent-[#0B3D33]"
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {needsExperience ? (
            <div className="space-y-3.5">
              <OnboardingQuestion title="Years of experience">
                {levels === null ? (
                  <div role="status" className="h-10 w-full animate-pulse rounded-[10px] bg-[#e9e8e3]">
                    <span className="sr-only">Loading experience options…</span>
                  </div>
                ) : (
                  <select
                    id="experience-range"
                    aria-label="Years of experience"
                    aria-invalid={error === EXPERIENCE_ERROR || undefined}
                    value={experienceRange}
                    onChange={(event) => {
                      setExperienceRange(event.target.value);
                      if (event.target.value) setError('');
                    }}
                    className={onboardingInputClass}
                  >
                    <option value="">Select years of experience</option>
                    {levels.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                )}
              </OnboardingQuestion>
              {!hasExperienceRecords ? (
                <>
                  <OnboardingQuestion title={status === 'EMPLOYED' ? 'Current role (optional)' : 'Most recent role (optional)'}>
                    <input
                      value={jobTitle}
                      onChange={(event) => setJobTitle(event.target.value)}
                      placeholder="e.g. Sales executive"
                      aria-label="Role"
                      className={onboardingInputClass}
                    />
                  </OnboardingQuestion>
                  <OnboardingQuestion title="Company (optional)">
                    <input
                      value={company}
                      onChange={(event) => setCompany(event.target.value)}
                      placeholder="Company name"
                      aria-label="Company"
                      className={onboardingInputClass}
                    />
                  </OnboardingQuestion>
                </>
              ) : null}
              {status === 'EMPLOYED' ? (
                <OnboardingQuestion title="Notice period (optional)">
                  <select
                    aria-label="Notice period"
                    value={noticePeriod}
                    onChange={(event) => setNoticePeriod(event.target.value)}
                    className={onboardingInputClass}
                  >
                    <option value="">Select notice period</option>
                    {(NOTICE_OPTIONS.includes(noticePeriod) || !noticePeriod ? NOTICE_OPTIONS : [noticePeriod, ...NOTICE_OPTIONS]).map(
                      (item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ),
                    )}
                  </select>
                </OnboardingQuestion>
              ) : null}
            </div>
          ) : null}

          <div id="status-error">
            <OnboardingError
              message={error || skipError}
              onRetry={saveFailed ? () => void save() : skipError ? () => void skip() : undefined}
            />
          </div>
        </div>

        <OnboardingActions step={2} onSkip={() => void skip()} skipDisabled={skipping || loading}>
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
