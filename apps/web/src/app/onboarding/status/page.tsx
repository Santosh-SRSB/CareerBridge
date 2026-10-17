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
  OnboardingActions,
  OnboardingError,
  OnboardingFrame,
  OnboardingLoading,
  OnboardingQuestion,
  OnboardingStepHeader,
  obxPrimaryButtonClass,
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

  if (!gateReady || !profileReady) return <OnboardingLoading step={2} />;

  return (
    <OnboardingFrame step={2} onSkip={() => void skip()} skipDisabled={skipping || loading}>
      <form onSubmit={onSubmit} noValidate className="obx-form">
        <div className="obx-body">
          <OnboardingStepHeader
            icon="briefcase"
            title="What’s your work status?"
            subtitle="This helps employers understand where you are in your career."
          />

          <fieldset aria-describedby={error === STATUS_ERROR ? 'status-error' : undefined} style={{ marginTop: 16 }}>
            <legend className="sr-only">Employment status</legend>
            <div className="obx-list">
              {EMPLOYMENT_STATUSES.map((option) => {
                const active = status === option.value;
                return (
                  <label key={option.value} className={`obx-opt obx-row${active ? ' is-on' : ''}`}>
                    <input
                      type="radio"
                      name="employmentStatus"
                      value={option.value}
                      checked={active}
                      onChange={() => selectStatus(option.value)}
                      className="sr-only"
                    />
                    <span className="obx-dot" aria-hidden>
                      {active ? <i /> : null}
                    </span>
                    {option.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {needsExperience ? (
            <div>
              <OnboardingQuestion title="Years of experience" htmlFor="experience-range">
                {levels === null ? (
                  <div role="status" className="obx-skel" style={{ height: 46 }}>
                    <span className="sr-only">Loading experience options…</span>
                  </div>
                ) : (
                  <div className="obx-field is-select">
                    <select
                      id="experience-range"
                      aria-label="Years of experience"
                      aria-invalid={error === EXPERIENCE_ERROR || undefined}
                      value={experienceRange}
                      onChange={(event) => {
                        setExperienceRange(event.target.value);
                        if (event.target.value) setError('');
                      }}
                    >
                      <option value="">Select years of experience</option>
                      {levels.map((level) => (
                        <option key={level.value} value={level.value}>
                          {level.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </OnboardingQuestion>
              {!hasExperienceRecords ? (
                <>
                  <OnboardingQuestion
                    title={status === 'EMPLOYED' ? 'Current role' : 'Most recent role'}
                    hint="Optional"
                    htmlFor="experience-role"
                  >
                    <input
                      id="experience-role"
                      value={jobTitle}
                      onChange={(event) => setJobTitle(event.target.value)}
                      placeholder="e.g. Sales executive"
                      aria-label="Role"
                      className="obx-input"
                    />
                  </OnboardingQuestion>
                  <OnboardingQuestion title="Company" hint="Optional" htmlFor="experience-company">
                    <input
                      id="experience-company"
                      value={company}
                      onChange={(event) => setCompany(event.target.value)}
                      placeholder="Company name"
                      aria-label="Company"
                      className="obx-input"
                    />
                  </OnboardingQuestion>
                </>
              ) : null}
              {status === 'EMPLOYED' ? (
                <OnboardingQuestion title="Notice period" hint="Optional" htmlFor="notice-period">
                  <div className="obx-field is-select">
                    <select
                      id="notice-period"
                      aria-label="Notice period"
                      value={noticePeriod}
                      onChange={(event) => setNoticePeriod(event.target.value)}
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
                  </div>
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

        <OnboardingActions step={2}>
          <Button
            type="submit"
            block={false}
            loading={loading}
            loadingLabel="Saving..."
            className={obxPrimaryButtonClass}
          >
            Continue
          </Button>
        </OnboardingActions>
      </form>
    </OnboardingFrame>
  );
}
