'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CAREER_INTERESTS } from '@careerbridge/shared';
import { Chip, PassportFrame, WizardActions } from '@/components/PassportFrame';
import { Button } from '@/components/ui/Button';
import { getStoredUser } from '@/lib/session';
import { getCandidateMe, updatePreferences } from '@/lib/api';
import { goToNextPassportStep } from '@/lib/passport-flow';

export default function PassportPreferencesPage() {
  const router = useRouter();
  const [interests, setInterests] = useState<string[]>([]);
  const [openToRelocating, setOpenToRelocating] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getStoredUser()) {
      router.replace('/login');
      return;
    }
    getCandidateMe()
      .then((profile) => {
        setInterests(profile.careerInterests);
        setOpenToRelocating(profile.openToRelocating);
      })
      .finally(() => setReady(true));
  }, [router]);

  function toggle(value: string) {
    setInterests((current) => {
      if (current.includes(value)) return current.filter((item) => item !== value);
      return [...current, value];
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!interests.length) {
      setError('Select the kinds of work that interest you.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await updatePreferences({ careerInterests: interests, openToRelocating });
      await goToNextPassportStep(router, 'preferences');
    } catch {
      setError('We could not save your preferences right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return <main className="cb-wizard text-muted">Loading your Career Passport...</main>;

  return (
    <PassportFrame
      title="Career preferences"
      subtitle="We use this to recommend work you actually want."
      step="preferences"
    >
      <form onSubmit={onSubmit} className="cb-passport-panel space-y-4 p-6 sm:p-7">
        <div>
          <p className="mb-2 text-sm font-semibold text-primary">Kinds of work you want</p>
          <div className="flex flex-wrap gap-1.5">
            {CAREER_INTERESTS.map((item) => (
              <Chip key={item} selected={interests.includes(item)} onClick={() => toggle(item)}>
                {item}
              </Chip>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-3 text-sm font-semibold text-primary">
          <input
            type="checkbox"
            checked={openToRelocating}
            onChange={(event) => setOpenToRelocating(event.target.checked)}
          />
          Open to relocating
        </label>
        {error ? <p className="text-sm text-error">{error}</p> : null}
        <WizardActions>
          <Button type="submit" size="md" block={false} loading={loading} loadingLabel="Saving...">
            Save and continue
          </Button>
        </WizardActions>
      </form>
    </PassportFrame>
  );
}
