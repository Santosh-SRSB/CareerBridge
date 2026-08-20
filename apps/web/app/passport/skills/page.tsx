'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SUGGESTED_SKILLS, type CandidateSkill } from '@careerbridge/shared';
import { PassportFrame, WizardActions } from '@/components/PassportFrame';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { getStoredUser } from '@/lib/session';
import { addSkill, getCandidateMe, removeSkill } from '@/lib/api';
import { goToNextPassportStep } from '@/lib/passport-flow';

const MIN_SKILLS = 3;

export default function PassportSkillsPage() {
  const router = useRouter();
  const [skills, setSkills] = useState<CandidateSkill[]>([]);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getStoredUser()) {
      router.replace('/login');
      return;
    }
    getCandidateMe()
      .then((profile) => setSkills(profile.skills))
      .finally(() => setReady(true));
  }, [router]);

  async function save(name: string) {
    setError('');
    setLoading(true);
    try {
      const profile = await addSkill({ name });
      setSkills(profile.skills);
      setCustom('');
    } catch {
      setError('We could not save that skill right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function onAddSkill() {
    if (custom.trim().length < 2) {
      setError('Enter a skill name.');
      return;
    }
    await save(custom.trim());
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      let nextSkills = skills;
      if (custom.trim().length >= 2) {
        const profile = await addSkill({ name: custom.trim() });
        nextSkills = profile.skills;
        setSkills(nextSkills);
        setCustom('');
      }
      if (nextSkills.length < MIN_SKILLS) {
        setError(`Add at least ${MIN_SKILLS} skills to continue. You have ${nextSkills.length}.`);
        return;
      }
      await goToNextPassportStep(router, 'skills');
    } catch {
      setError('We could not save that skill right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return <main className="cb-wizard text-muted">Loading your Career Passport...</main>;

  const recommended = SUGGESTED_SKILLS.filter((item) => !skills.some((skill) => skill.name === item));

  return (
    <PassportFrame title="Skills" subtitle="Add the skills you already use at work, college, or home." step="skills">
      <form onSubmit={onSubmit} className="cb-passport-panel space-y-4 p-6 sm:p-7">
        <p className="text-sm font-semibold text-primary">
          {skills.length} of {MIN_SKILLS} skills added
        </p>
        <div>
          <p className="mb-2 text-sm font-semibold text-primary">Your skills</p>
          <div className="flex flex-wrap gap-2">
            {skills.length ? (
              skills.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="rounded-pill bg-[#1ec8c0] px-2.5 py-1 text-xs font-bold text-[#0c3340]"
                  onClick={async () => setSkills((await removeSkill(item.id)).skills)}
                >
                  {item.name} ×
                </button>
              ))
            ) : (
              <p className="text-sm text-muted">Add at least 3 skills so employers can find you.</p>
            )}
          </div>
        </div>

        {recommended.length ? (
          <div>
            <p className="mb-2 text-sm font-semibold text-primary">Suggested</p>
            <div className="flex flex-wrap gap-2">
              {recommended.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="rounded-pill border border-primary/12 bg-white px-2.5 py-1 text-xs font-bold text-primary hover:border-teal hover:bg-[#e8fbfa]"
                  onClick={() => void save(item)}
                >
                  + {item}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <Input
          label="Add another skill"
          name="customSkill"
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          placeholder="Communication, MS Excel, Sales"
        />
        {error ? <p className="text-sm text-error">{error}</p> : null}
        <WizardActions>
          <Button
            type="button"
            size="md"
            block={false}
            variant="secondary"
            className="cb-wizard-secondary"
            loading={loading}
            loadingLabel="Saving..."
            onClick={() => void onAddSkill()}
          >
            Add skill
          </Button>
          <Button type="submit" size="md" block={false} loading={loading} loadingLabel="Saving...">
            Save and continue
          </Button>
        </WizardActions>
      </form>
    </PassportFrame>
  );
}
