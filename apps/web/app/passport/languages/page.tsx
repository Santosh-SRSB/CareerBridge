'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LANGUAGE_LEVELS,
  PREFERRED_LANGUAGES,
  parseLanguageSkills,
  serializeLanguageSkills,
  type LanguageSkill,
} from '@careerbridge/shared';
import { Chip, PassportFrame, WizardActions } from '@/components/PassportFrame';
import { Button } from '@/components/ui/Button';
import { getStoredUser } from '@/lib/session';
import { getCandidateMe, updateCandidateMe } from '@/lib/api';
import { goToNextPassportStep } from '@/lib/passport-flow';

export default function PassportLanguagesPage() {
  const router = useRouter();
  const [languages, setLanguages] = useState<LanguageSkill[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getStoredUser()) {
      router.replace('/login');
      return;
    }
    getCandidateMe()
      .then((profile) => setLanguages(parseLanguageSkills(profile.preferredLanguage)))
      .finally(() => setReady(true));
  }, [router]);

  function toggle(name: string) {
    setLanguages((current) =>
      current.some((item) => item.name === name)
        ? current.filter((item) => item.name !== name)
        : [...current, { name, level: '' }],
    );
  }

  function setLevel(name: string, level: string) {
    setLanguages((current) => current.map((item) => (item.name === name ? { ...item, level } : item)));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!languages.length) {
      setError('Select at least one language you can use at work.');
      return;
    }
    if (languages.some((item) => !item.level)) {
      setError('Choose a proficiency level for each selected language.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await updateCandidateMe({ preferredLanguage: serializeLanguageSkills(languages) });
      await goToNextPassportStep(router, 'languages');
    } catch {
      setError('We could not save your languages right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return <main className="cb-wizard text-muted">Loading your Career Passport...</main>;

  return (
    <PassportFrame
      title="Languages"
      subtitle="Select every language you can use at work, then choose how well you know it. The first one is your preferred language."
      step="languages"
    >
      <form onSubmit={onSubmit} className="cb-passport-panel space-y-4 p-6 sm:p-7">
        <div className="flex flex-wrap gap-1.5">
          {PREFERRED_LANGUAGES.map((item) => (
            <Chip key={item} selected={languages.some((lang) => lang.name === item)} onClick={() => toggle(item)}>
              {item}
            </Chip>
          ))}
        </div>
        {languages.length ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-primary">Proficiency</p>
            {languages.map((item) => (
              <div key={item.name} className="rounded-xl border border-primary/8 bg-[#f7fbfb] p-3">
                <p className="text-sm font-bold text-primary">{item.name}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {LANGUAGE_LEVELS.map((level) => (
                    <Chip key={level} selected={item.level === level} onClick={() => setLevel(item.name, level)}>
                      {level}
                    </Chip>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-sm text-muted">Preferred: {languages[0].name}</p>
          </div>
        ) : null}
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
