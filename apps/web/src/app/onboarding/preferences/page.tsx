'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DEFAULT_JOB_CATEGORY_ITEMS,
  ONBOARDING_MAX_JOB_CATEGORIES,
  ONBOARDING_MAX_JOB_CATEGORIES_MESSAGE,
  SALARY_RANGE_INVALID_MESSAGE,
  validateExpectedSalaryRange,
} from '@careerbridge/shared';
import {
  OnboardingActions,
  OnboardingError,
  OnboardingFrame,
  OnboardingIcon,
  OnboardingLoading,
  OnboardingQuestion,
  OnboardingStepHeader,
  obxPrimaryButtonClass,
} from '@/components/OnboardingFrame';
import { categoryIconName } from '@/lib/onboarding-category-icon';
import { Button } from '@/components/ui/Button';
import { getCandidateMe, getCatalog, updateCandidateMe } from '@/lib/api';
import { nextOnboardingStepPath, withSkippedStep } from '@/lib/onboarding-flow';
import { JOB_TYPE_OPTIONS } from '@/features/jobs/job-search';
import { useOnboardingGate } from '@/hooks/useOnboardingGate';
import { ONBOARDING_SAVE_ERROR, useOnboardingSkip } from '@/hooks/useOnboardingSkip';

function parseSalary(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : Number.NaN;
}

export default function OnboardingPreferencesPage() {
  const router = useRouter();
  const gateReady = useOnboardingGate(3);
  const [profileReady, setProfileReady] = useState(false);
  const [categories, setCategories] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [jobTypes, setJobTypes] = useState<string[]>([]);
  const [skippedSteps, setSkippedSteps] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [saveFailed, setSaveFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const { skip, skipping, skipError } = useOnboardingSkip(3, skippedSteps);

  useEffect(() => {
    if (!gateReady) return;
    getCandidateMe()
      .then((profile) => {
        setSelected((profile.careerInterests || []).slice(0, ONBOARDING_MAX_JOB_CATEGORIES));
        setSalaryMin(profile.expectedSalaryMin != null ? String(profile.expectedSalaryMin) : '');
        setSalaryMax(profile.expectedSalaryMax != null ? String(profile.expectedSalaryMax) : '');
        setJobTypes(profile.preferredJobTypes || []);
        setSkippedSteps(profile.onboardingSkippedSteps ?? []);
      })
      .finally(() => setProfileReady(true));
    getCatalog('job-categories')
      .then((rows) => setCategories(rows.map((row) => row.label)))
      .catch(() => setCategories(DEFAULT_JOB_CATEGORY_ITEMS.map((item) => item.label)));
  }, [gateReady]);

  const categoryOptions = useMemo(() => {
    const list = categories ?? [];
    return [...selected.filter((item) => !list.includes(item)), ...list];
  }, [categories, selected]);

  function toggleCategory(name: string) {
    if (selected.includes(name)) {
      setSelected((prev) => prev.filter((item) => item !== name));
      setCategoryError('');
      return;
    }
    if (selected.length >= ONBOARDING_MAX_JOB_CATEGORIES) {
      setCategoryError(ONBOARDING_MAX_JOB_CATEGORIES_MESSAGE);
      return;
    }
    setCategoryError('');
    setSelected((prev) => [...prev, name]);
  }

  function toggleJobType(value: string) {
    setJobTypes((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
  }

  async function save() {
    setSaveFailed(false);
    const min = parseSalary(salaryMin);
    const max = parseSalary(salaryMax);
    const salaryError = validateExpectedSalaryRange(min, max);
    if (salaryError) {
      setError(salaryError);
      return;
    }
    setError('');
    setLoading(true);
    try {
      await updateCandidateMe({
        careerInterests: selected,
        expectedSalaryMin: min,
        expectedSalaryMax: max,
        preferredJobTypes: jobTypes,
        onboardingSkippedSteps: withSkippedStep(skippedSteps, 3, false),
      });
      router.push(nextOnboardingStepPath(3));
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

  if (!gateReady || !profileReady) return <OnboardingLoading step={3} />;

  const salaryInvalid = error === SALARY_RANGE_INVALID_MESSAGE;
  const categoriesFull = selected.length >= ONBOARDING_MAX_JOB_CATEGORIES;

  return (
    <OnboardingFrame step={3} onSkip={() => void skip()} skipDisabled={skipping || loading}>
      <form onSubmit={onSubmit} noValidate className="obx-form">
        <div className="obx-body">
          <OnboardingStepHeader
            icon="briefcase"
            title="Job preferences"
            subtitle={`All optional. Choose up to ${ONBOARDING_MAX_JOB_CATEGORIES} categories.`}
          />

          <p className="obx-cnt" aria-live="polite">
            {selected.length} of {ONBOARDING_MAX_JOB_CATEGORIES} selected
          </p>
          {categories === null ? (
            <div role="status" className="obx-grid">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="obx-skel" style={{ height: 52 }} />
              ))}
              <span className="sr-only">Loading job categories…</span>
            </div>
          ) : (
            <div className="obx-grid" data-testid="job-categories">
              {categoryOptions.map((name) => {
                const active = selected.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleCategory(name)}
                    aria-pressed={active}
                    aria-disabled={!active && categoriesFull ? true : undefined}
                    className={`obx-opt obx-tile${active ? ' is-on' : ''}`}
                    style={!active && categoriesFull ? { opacity: 0.45 } : undefined}
                  >
                    <span className="obx-ti">
                      <OnboardingIcon name={active ? 'check' : categoryIconName(name)} size={16} />
                    </span>
                    {name}
                  </button>
                );
              })}
            </div>
          )}
          <OnboardingError message={categoryError} />

          <OnboardingQuestion title="Expected monthly salary in ₹" hint="Optional">
            <div className="obx-grid">
              <input
                type="number"
                inputMode="numeric"
                aria-label="Minimum expected salary"
                aria-invalid={salaryInvalid || undefined}
                value={salaryMin}
                onChange={(event) => {
                  setSalaryMin(event.target.value);
                  if (salaryInvalid) setError('');
                }}
                placeholder="Min e.g. 20000"
                className="obx-input"
              />
              <input
                type="number"
                inputMode="numeric"
                aria-label="Maximum expected salary"
                aria-invalid={salaryInvalid || undefined}
                value={salaryMax}
                onChange={(event) => {
                  setSalaryMax(event.target.value);
                  if (salaryInvalid) setError('');
                }}
                placeholder="Max e.g. 30000"
                className="obx-input"
              />
            </div>
          </OnboardingQuestion>

          <fieldset>
            <legend className="obx-label">
              Job type<em>Optional</em>
            </legend>
            <div className="obx-grid">
              {JOB_TYPE_OPTIONS.map((option) => {
                const active = jobTypes.includes(option.value);
                return (
                  <label key={option.value} className={`obx-opt obx-check${active ? ' is-on' : ''}`}>
                    <input type="checkbox" checked={active} onChange={() => toggleJobType(option.value)} />
                    {option.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <OnboardingError
            message={error || skipError}
            onRetry={saveFailed ? () => void save() : skipError ? () => void skip() : undefined}
          />
        </div>

        <OnboardingActions step={3}>
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
