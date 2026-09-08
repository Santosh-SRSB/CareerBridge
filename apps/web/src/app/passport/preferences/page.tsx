'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CAREER_INTERESTS } from '@careerbridge/shared';
import {
  Chip,
  PassportFrame,
  PassportLoading,
  WizardActions,
  passportPrimaryButtonClass,
} from '@/components/PassportFrame';
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

  if (!ready) return <PassportLoading />;

  return (
    <PassportFrame
      title="Career preferences"
      subtitle="We use this to recommend work you actually want."
      step="preferences"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-bold text-slate-700">Kinds of work you want</p>
          <div className="flex flex-wrap gap-1.5">
            {CAREER_INTERESTS.map((item) => (
              <Chip key={item} selected={interests.includes(item)} onClick={() => toggle(item)}>
                {item}
              </Chip>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            className="size-4 shrink-0 rounded border-slate-300 text-[#0a2e2c] focus:ring-[#0a2e2c]/20"
            checked={openToRelocating}
            onChange={(event) => setOpenToRelocating(event.target.checked)}
          />
          Open to relocating
        </label>
        {error ? <p className="text-sm font-semibold text-error">{error}</p> : null}
        <WizardActions>
          <Button
            type="submit"
            size="md"
            block={false}
            loading={loading}
            loadingLabel="Saving..."
            className={passportPrimaryButtonClass}
          >
            Save and continue
          </Button>
        </WizardActions>
      </form>
    </PassportFrame>
  );
}
