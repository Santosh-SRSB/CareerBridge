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

  if (!gateReady || !profileReady) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm" style={{ background: OB.bg, color: OB.muted }}>
        Loading...
      </main>
    );
  }

  const salaryInvalid = error === SALARY_RANGE_INVALID_MESSAGE;

  return (
    <OnboardingFrame step={3}>
      <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="cb-ob-hide-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden pb-1">
          <OnboardingStepHeader title="Job preferences" subtitle="All optional. Tell us what you are looking for." />

          <OnboardingQuestion
            title="Preferred job categories (optional)"
            hint={`Choose up to ${ONBOARDING_MAX_JOB_CATEGORIES} · ${selected.length}/${ONBOARDING_MAX_JOB_CATEGORIES} selected`}
          >
            {categories === null ? (
              <div role="status" className="grid grid-cols-2 gap-2">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="h-9 animate-pulse rounded-full bg-[#e9e8e3]" />
                ))}
                <span className="sr-only">Loading job categories…</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2" data-testid="job-categories">
                {categoryOptions.map((name) => {
                  const active = selected.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleCategory(name)}
                      aria-pressed={active}
                      className="min-h-12 rounded-full border px-3.5 text-[13px] transition active:scale-95"
                      style={
                        active
                          ? { background: OB.accent, color: '#fff', borderColor: OB.accent }
                          : { background: OB.surface, color: OB.ink, borderColor: OB.borderStrong }
                      }
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            )}
            <OnboardingError message={categoryError} />
          </OnboardingQuestion>

          <OnboardingQuestion title="Expected monthly salary in ₹ (optional)">
            <div className="grid grid-cols-2 gap-2.5">
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
                className={onboardingInputClass}
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
                className={onboardingInputClass}
              />
            </div>
          </OnboardingQuestion>

          <fieldset>
            <legend className="mb-2 text-[13px] font-medium" style={{ color: OB.muted }}>
              Job type (optional)
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {JOB_TYPE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex min-h-12 cursor-pointer items-center gap-2 rounded-[10px] border px-3 text-sm"
                  style={{ borderColor: OB.borderStrong, color: OB.ink }}
                >
                  <input
                    type="checkbox"
                    checked={jobTypes.includes(option.value)}
                    onChange={() => toggleJobType(option.value)}
                    className="h-4 w-4 accent-[#10137C]"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <OnboardingError
            message={error || skipError}
            onRetry={saveFailed ? () => void save() : skipError ? () => void skip() : undefined}
          />
        </div>

        <OnboardingActions step={3} onSkip={() => void skip()} skipDisabled={skipping || loading}>
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
