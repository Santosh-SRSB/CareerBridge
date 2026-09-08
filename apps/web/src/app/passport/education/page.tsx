'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { yearError, type CandidateEducation } from '@careerbridge/shared';
import {
  PassportFrame,
  PassportLoading,
  PassportRecord,
  WizardActions,
  passportPrimaryButtonClass,
  passportSecondaryButtonClass,
} from '@/components/PassportFrame';
import { DegreeSelect, FieldOfStudySelect, InstitutionCombobox } from '@/components/resume/EducationSelectors';
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
      setError('Select your degree (e.g. B.Tech, B.E., B.Com).');
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

  if (!ready) return <PassportLoading />;

  return (
    <PassportFrame
      title="Education"
      subtitle="Add your degree and institution — e.g. B.Tech, B.E., MBA."
      step="education"
    >
      <form onSubmit={onAdd} className="space-y-4">
        <p className="text-sm text-slate-500">
          {items.length
            ? 'Highest education saved. You can add more below if you want.'
            : 'Highest education is required to continue.'}
        </p>

        {items.length ? (
          <div className="space-y-2">
            {items.map((item) => (
              <PassportRecord
                key={item.id}
                title={
                  item.fieldOfStudy
                    ? `${item.qualification} in ${item.fieldOfStudy}`
                    : item.qualification
                }
                subtitle={[item.institution, item.yearCompleted].filter(Boolean).join(' · ') || 'Saved'}
                onRemove={() => void removeEducation(item.id).then((profile) => setItems(profile.education))}
              />
            ))}
          </div>
        ) : null}

        <DegreeSelect value={qualification} onChange={setQualification} />
        <FieldOfStudySelect value={fieldOfStudy} onChange={setFieldOfStudy} />
        <InstitutionCombobox value={institution} onChange={setInstitution} />
        <Input
          label="Year completed (optional)"
          name="yearCompleted"
          inputMode="numeric"
          value={yearCompleted}
          onChange={(event) => setYearCompleted(event.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="2024"
        />
        {error ? <p className="text-sm font-semibold text-error">{error}</p> : null}
        <WizardActions>
          <Button
            type="submit"
            size="md"
            block={false}
            loading={loading}
            loadingLabel="Saving..."
            variant="outline"
            className={passportSecondaryButtonClass}
          >
            Add education
          </Button>
          <Button
            type="button"
            size="md"
            block={false}
            loading={loading}
            loadingLabel="Saving..."
            className={passportPrimaryButtonClass}
            onClick={() => void onContinue()}
          >
            Save and continue
          </Button>
        </WizardActions>
      </form>
    </PassportFrame>
  );
}
