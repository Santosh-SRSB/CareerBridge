'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EDUCATION_LEVELS } from '@careerbridge/shared';
import {
  OB,
  OnboardingActions,
  OnboardingFrame,
  OnboardingQuestion,
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
    // Reset field when qualification changes — options are different
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

  function onSkip() {
    router.push(nextOnboardingStepPath(3));
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm" style={{ background: OB.bg, color: OB.muted }}>
        Loading...
      </main>
    );
  }

  return (
    <OnboardingFrame step={3}>
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="cb-ob-hide-scrollbar min-h-0 flex-1 space-y-4 overflow-x-hidden">
          <OnboardingQuestion title="Highest qualification">
            <select
              required
              value={qualification}
              onChange={(event) => onQualificationChange(event.target.value)}
              className={onboardingInputClass}
            >
              <option value="">Select one</option>
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

          <OnboardingQuestion title="Field of study">
            <select
              required
              value={fieldSelect}
              onChange={(event) => {
                setFieldSelect(event.target.value);
                if (event.target.value !== OTHER_FIELD) setCustomField('');
                setError('');
              }}
              disabled={!qualification}
              className={onboardingInputClass}
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
            {fieldSelect === OTHER_FIELD ? (
              <input
                name="customFieldOfStudy"
                required
                value={customField}
                onChange={(event) => setCustomField(event.target.value)}
                placeholder="Type your field of study"
                className={`${onboardingInputClass} mt-3`}
              />
            ) : null}
          </OnboardingQuestion>

          {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
        </div>

        <OnboardingActions onSkip={onSkip}>
          <Button
            type="submit"
            size="sm"
            block={false}
            loading={loading}
            loadingLabel="Saving..."
            className={onboardingPrimaryButtonClass}
            style={{ background: OB.moss }}
          >
            Continue
          </Button>
        </OnboardingActions>
      </form>
    </OnboardingFrame>
  );
}
