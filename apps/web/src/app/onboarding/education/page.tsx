'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EDUCATION_LEVELS } from '@careerbridge/shared';
import {
  OB,
  OnboardingActions,
  OnboardingFieldIcon,
  OnboardingFrame,
  OnboardingHero,
  OnboardingQuestion,
  OnboardingStepHeader,
  onboardingInputClass,
  onboardingPrimaryButtonClass,
} from '@/components/OnboardingFrame';
import { Button } from '@/components/ui/Button';
import { fieldsForQualification } from '@/data/degree-options';
import { addEducation, getCandidateMe, updateCandidateMe } from '@/lib/api';
import { nextOnboardingStepPath } from '@/lib/onboarding-flow';
import { useOnboardingGate } from '@/hooks/useOnboardingGate';

const STANDARD_LEVELS = EDUCATION_LEVELS.filter((level) => level !== 'Other');
const OTHER_FIELD = 'Other';

export default function OnboardingEducationPage() {
  const router = useRouter();
  const [qualification, setQualification] = useState('');
  const [otherEducation, setOtherEducation] = useState('');
  const [fieldSelect, setFieldSelect] = useState('');
  const [customField, setCustomField] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const gateReady = useOnboardingGate(3);
  const [profileReady, setProfileReady] = useState(false);
  const ready = gateReady && profileReady;

  const fieldOptions = useMemo(
    () => fieldsForQualification(qualification || 'Other'),
    [qualification],
  );

  useEffect(() => {
    if (!gateReady) return;
    getCandidateMe()
      .then((profile) => {
        const saved = profile.highestEducation || profile.education[0]?.qualification || '';
        let nextQual = '';
        if (STANDARD_LEVELS.includes(saved as (typeof STANDARD_LEVELS)[number])) {
          nextQual = saved;
          setQualification(saved);
        } else if (saved) {
          nextQual = 'Other';
          setQualification('Other');
          setOtherEducation(saved);
        }

        const savedField = profile.education[0]?.fieldOfStudy?.trim() || '';
        if (!savedField) return;
        const options = fieldsForQualification(nextQual || 'Other');
        if (options.includes(savedField)) {
          setFieldSelect(savedField);
          setCustomField('');
        } else {
          setFieldSelect(OTHER_FIELD);
          setCustomField(savedField);
        }
      })
      .finally(() => setProfileReady(true));
  }, [gateReady]);

  function onQualificationChange(next: string) {
    setQualification(next);
    if (next !== 'Other') setOtherEducation('');
    setFieldSelect('');
    setCustomField('');
    setError('');
  }

  function resolvedFieldOfStudy(): string {
    if (fieldSelect === OTHER_FIELD) return customField.trim();
    return fieldSelect.trim();
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = qualification === 'Other' ? otherEducation.trim() : qualification;
    if (!value) {
      setError(qualification === 'Other' ? 'Enter your highest education.' : 'Select your highest education.');
      return;
    }
    if (!fieldSelect) {
      setError('Select your field of study.');
      return;
    }
    if (fieldSelect === OTHER_FIELD && customField.trim().length < 2) {
      setError('Enter your field of study.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const profile = await getCandidateMe();
      const fieldOfStudy = resolvedFieldOfStudy();
      await updateCandidateMe({ highestEducation: value });
      if (!profile.education.length) {
        await addEducation({
          qualification: value,
          fieldOfStudy: fieldOfStudy || undefined,
        });
      }
      router.push(nextOnboardingStepPath(3));
    } catch {
      setError('We could not save your education right now. Please try again.');
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
    <OnboardingFrame step={3}>
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="cb-ob-hide-scrollbar min-h-0 flex-1 space-y-3.5 overflow-y-auto overflow-x-hidden pb-1">
          <OnboardingHero tone="amber">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke={OB.amber800}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 3L2 8l10 5 10-5-10-5z" />
              <path d="M6 10.5V16c0 1.5 2.5 3 6 3s6-1.5 6-3v-5.5" />
            </svg>
          </OnboardingHero>

          <OnboardingStepHeader
            title="Your education"
            subtitle="Tell us your highest qualification."
          />

          <OnboardingQuestion title="Highest education">
            <select
              required
              value={qualification}
              onChange={(event) => onQualificationChange(event.target.value)}
              className={onboardingInputClass}
            >
              <option value="">Select degree</option>
              {EDUCATION_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
            {qualification === 'Other' ? (
              <input
                name="otherEducation"
                required
                value={otherEducation}
                onChange={(event) => setOtherEducation(event.target.value)}
                placeholder="Type your highest education"
                className={`${onboardingInputClass} mt-3`}
              />
            ) : null}
          </OnboardingQuestion>

          <OnboardingQuestion title="Stream / field">
            <div className="relative">
              <OnboardingFieldIcon>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                </svg>
              </OnboardingFieldIcon>
              <select
                required
                value={fieldSelect}
                onChange={(event) => {
                  setFieldSelect(event.target.value);
                  if (event.target.value !== OTHER_FIELD) setCustomField('');
                  setError('');
                }}
                disabled={!qualification}
                className={`${onboardingInputClass} pl-[34px]`}
              >
                <option value="">
                  {qualification ? 'Select field of study' : 'Select qualification first'}
                </option>
                {fieldOptions.map((field) => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))}
              </select>
            </div>
            {fieldSelect === OTHER_FIELD ? (
              <input
                name="customFieldOfStudy"
                required
                value={customField}
                onChange={(event) => setCustomField(event.target.value)}
                placeholder="e.g. Computer science"
                className={`${onboardingInputClass} mt-3`}
              />
            ) : null}
          </OnboardingQuestion>

          {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
        </div>

        <OnboardingActions step={3}>
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
