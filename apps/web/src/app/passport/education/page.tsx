'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EDUCATION_LEVELS, yearError, type CandidateEducation } from '@careerbridge/shared';
import { Chip, PassportFrame, WizardActions } from '@/components/PassportFrame';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { getStoredUser } from '@/lib/session';
import { addEducation, getCandidateMe, removeEducation, updateCandidateMe } from '@/lib/api';
import { goToNextPassportStep } from '@/lib/passport-flow';

const MIN_EDUCATION = 1;

export default function PassportEducationPage() {
  const router = useRouter();
  const [items, setItems] = useState<CandidateEducation[]>([]);
  const [qualification, setQualification] = useState('');
  const [institution, setInstitution] = useState('');
  const [fieldOfStudy, setFieldOfStudy] = useState('');
  const [yearCompleted, setYearCompleted] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getStoredUser()) {
      router.replace('/login');
      return;
    }
    getCandidateMe()
      .then((profile) => setItems(profile.education))
      .finally(() => setReady(true));
  }, [router]);

  function resetForm() {
    setQualification('');
    setInstitution('');
    setFieldOfStudy('');
    setYearCompleted('');
  }

  async function saveCurrentRow() {
    if (!qualification) {
      setError('Select a qualification.');
      return null;
    }
    if (institution.trim().length < 2) {
      setError('Enter the school, college, or institution name.');
      return null;
    }
    const invalidYear = yearError(yearCompleted);
    if (invalidYear) {
      setError(invalidYear);
      return null;
    }
    await updateCandidateMe({ highestEducation: qualification });
    const profile = await addEducation({
      qualification,
      institution: institution.trim(),
      fieldOfStudy: fieldOfStudy.trim() || undefined,
      yearCompleted: yearCompleted ? Number(yearCompleted) : undefined,
    });
    setItems(profile.education);
    resetForm();
    return profile.education;
  }

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await saveCurrentRow();
    } catch {
      setError('We could not save that education record right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function onContinue() {
    setError('');
    setLoading(true);
    try {
      let nextItems = items;
      if (nextItems.length < MIN_EDUCATION || qualification || institution.trim()) {
        if (qualification || institution.trim()) {
          const saved = await saveCurrentRow();
          if (!saved) {
            setLoading(false);
            return;
          }
          nextItems = saved;
        }
      }
      if (nextItems.length < MIN_EDUCATION) {
        setError('Add your highest education to continue.');
        return;
      }
      await goToNextPassportStep(router, 'education');
    } catch {
      setError('We could not save your education right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return <main className="cb-wizard text-muted">Loading your Career Passport...</main>;

  return (
    <PassportFrame
      title="Education"
      subtitle="Add your highest qualification. Extra records are optional."
      step="education"
    >
      <form onSubmit={onAdd} className="cb-passport-panel space-y-4 p-6 sm:p-7">
        <p className="text-sm text-muted">
          {items.length
            ? 'Highest education saved. You can add more below if you want.'
            : 'Highest education is required to continue.'}
        </p>

        {items.length ? (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="cb-wizard-record">
                <div>
                  <p className="text-sm font-semibold text-primary">{item.qualification}</p>
                  <p className="text-xs text-muted">
                    {[item.institution, item.fieldOfStudy, item.yearCompleted].filter(Boolean).join(' · ') || 'Saved'}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs font-semibold text-error"
                  onClick={async () => setItems((await removeEducation(item.id)).education)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-sm font-semibold text-primary">Highest qualification</p>
          <div className="flex flex-wrap gap-1.5">
            {EDUCATION_LEVELS.map((level) => (
              <Chip key={level} selected={qualification === level} onClick={() => setQualification(level)}>
                {level}
              </Chip>
            ))}
          </div>
        </div>
        <Input
          label="Institution"
          name="institution"
          value={institution}
          onChange={(event) => setInstitution(event.target.value)}
          placeholder="School, college, or university"
        />
        <Input
          label="Field of study (optional)"
          name="fieldOfStudy"
          value={fieldOfStudy}
          onChange={(event) => setFieldOfStudy(event.target.value)}
          placeholder="Commerce, Computer Science, Arts"
        />
        <Input
          label="Year completed (optional)"
          name="yearCompleted"
          inputMode="numeric"
          value={yearCompleted}
          onChange={(event) => setYearCompleted(event.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="2024"
        />
        {error ? <p className="text-sm text-error">{error}</p> : null}
        <WizardActions>
          <Button
            type="submit"
            size="md"
            block={false}
            loading={loading}
            loadingLabel="Saving..."
            variant="secondary"
            className="cb-wizard-secondary"
          >
            Add education
          </Button>
          <Button type="button" size="md" block={false} loading={loading} loadingLabel="Saving..." onClick={() => void onContinue()}>
            Save and continue
          </Button>
        </WizardActions>
      </form>
    </PassportFrame>
  );
}
