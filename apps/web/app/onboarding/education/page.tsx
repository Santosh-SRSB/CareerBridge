'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EDUCATION_LEVELS, yearError } from '@careerbridge/shared';
import { OnboardingFrame } from '@/components/OnboardingFrame';
import { Chip } from '@/components/PassportFrame';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { getStoredUser } from '@/lib/session';
import { addEducation, getCandidateMe, updateCandidateMe } from '@/lib/api';

export default function OnboardingEducationPage() {
  const router = useRouter();
  const [qualification, setQualification] = useState('');
  const [institution, setInstitution] = useState('');
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
      .then((profile) => setQualification(profile.highestEducation || ''))
      .finally(() => setReady(true));
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!qualification) {
      setError('Select your highest education.');
      return;
    }
    const invalidYear = yearError(yearCompleted);
    if (invalidYear) {
      setError(invalidYear);
      return;
    }
    setError('');
    setLoading(true);
    try {
      let profile = await getCandidateMe();
      await updateCandidateMe({ highestEducation: qualification });
      if (!profile.education.length) {
        await addEducation({
          qualification,
          institution: institution || undefined,
          yearCompleted: yearCompleted ? Number(yearCompleted) : undefined,
        });
      }
      router.push('/onboarding/interests');
    } catch {
      setError('We could not save your education right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return null;

  return (
    <OnboardingFrame step={3} title="What is your highest education?" subtitle="You can add more later in your Career Passport.">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="flex flex-wrap gap-1.5">
          {EDUCATION_LEVELS.map((level) => (
            <Chip key={level} selected={qualification === level} onClick={() => setQualification(level)}>
              {level}
            </Chip>
          ))}
        </div>
        <Input
          label="Institution (optional)"
          name="institution"
          value={institution}
          onChange={(event) => setInstitution(event.target.value)}
        />
        <Input
          label="Year completed (optional)"
          name="yearCompleted"
          inputMode="numeric"
          value={yearCompleted}
          onChange={(event) => setYearCompleted(event.target.value.replace(/\D/g, '').slice(0, 4))}
        />
        {error ? <p className="text-sm text-error">{error}</p> : null}
        <Button type="submit" loading={loading} loadingLabel="Saving...">
          Continue
        </Button>
      </form>
    </OnboardingFrame>
  );
}
