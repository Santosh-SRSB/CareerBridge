'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CAREER_INTERESTS, SUGGESTED_SKILLS } from '@careerbridge/shared';
import { OnboardingFrame } from '@/components/OnboardingFrame';
import { Chip } from '@/components/PassportFrame';
import { Button } from '@/components/ui/Button';
import { getStoredUser } from '@/lib/session';
import { addSkill, getCandidateMe, updateCandidateMe } from '@/lib/api';

export default function OnboardingInterestsPage() {
  const router = useRouter();
  const [interests, setInterests] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
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
        setSkills(profile.skills.map((item) => item.name));
      })
      .finally(() => setReady(true));
  }, [router]);

  function toggle(list: string[], value: string, max?: number) {
    if (list.includes(value)) return list.filter((item) => item !== value);
    if (max && list.length >= max) return list;
    return [...list, value];
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!interests.length) {
      setError('Select up to 3 kinds of work that interest you.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await updateCandidateMe({ careerInterests: interests });
      for (const name of skills) {
        await addSkill({ name });
      }
      router.push('/onboarding/experience');
    } catch {
      setError('We could not save your interests right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return null;

  return (
    <OnboardingFrame
      step={4}
      title="What kind of work interests you?"
      subtitle="Select up to 3. You can also add a few skills."
    >
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="flex flex-wrap gap-1.5">
          {CAREER_INTERESTS.map((item) => (
            <Chip key={item} selected={interests.includes(item)} onClick={() => setInterests(toggle(interests, item, 3))}>
              {item}
            </Chip>
          ))}
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Skills (optional)</p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_SKILLS.map((item) => (
              <Chip key={item} selected={skills.includes(item)} onClick={() => setSkills(toggle(skills, item))}>
                {item}
              </Chip>
            ))}
          </div>
        </div>
        {error ? <p className="text-sm text-error">{error}</p> : null}
        <Button type="submit" loading={loading} loadingLabel="Saving...">
          Continue
        </Button>
      </form>
    </OnboardingFrame>
  );
}
