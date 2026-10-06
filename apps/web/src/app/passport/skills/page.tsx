'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CANDIDATE_MAX_SKILLS, CANDIDATE_MAX_SKILLS_MESSAGE, type CandidateSkill } from '@careerbridge/shared';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { SkillSearchCombobox } from '@/components/resume/SkillSearchCombobox';
import { getStoredUser } from '@/lib/session';
import { userFacingError } from '@/lib/client-errors';
import { addSkill, getCandidateMe, removeSkill } from '@/lib/api';

const isDraft = (skill: CandidateSkill) => skill.id.startsWith('draft-');

export default function PassportSkillsPage() {
  const router = useRouter();
  const [skills, setSkills] = useState<CandidateSkill[]>([]);
  const saved = useRef<CandidateSkill[]>([]);
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
        saved.current = profile.skills ?? [];
        setSkills(saved.current);
      })
      .catch((err) => setError(userFacingError(err, 'load your skills')))
      .finally(() => setReady(true));
  }, [router]);

  function handleAddSkill(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (skills.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) return;
    if (skills.length >= CANDIDATE_MAX_SKILLS) {
      setError(CANDIDATE_MAX_SKILLS_MESSAGE);
      return;
    }
    setError('');
    setSkills((prev) => [...prev, { id: `draft-${Date.now()}`, name: trimmed }]);
  }

  function handleRemoveSkill(name: string) {
    setError('');
    setSkills((prev) => prev.filter((s) => s.name.toLowerCase() !== name.toLowerCase()));
  }

  async function onSave() {
    if (skills.length < 1) {
      setError('Add at least one skill to save.');
      return;
    }
    setError('');
    setLoading(true);
    const keep = new Set(skills.filter((s) => !isDraft(s)).map((s) => s.id));
    const removed = saved.current.filter((s) => !keep.has(s.id));
    const added = skills.filter(isDraft);
    try {
      for (const skill of removed) await removeSkill(skill.id);
      for (const skill of added) await addSkill({ name: skill.name });
      toast.success('Skills saved');
      router.push('/profile');
    } catch (err) {
      setError(userFacingError(err, 'save your skills'));
      const profile = await getCandidateMe().catch(() => null);
      if (profile) {
        saved.current = profile.skills ?? [];
        const persisted = new Set(saved.current.map((s) => s.name.toLowerCase()));
        setSkills([...saved.current, ...added.filter((s) => !persisted.has(s.name.toLowerCase()))]);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <CandidateAppShell activeTab="profile" showBack title="My Skills" headerVariant="simple" maxWidth="max-w-lg">
        <div className="py-16 text-center text-sm text-slate-500">Loading...</div>
      </CandidateAppShell>
    );
  }

  return (
    <CandidateAppShell
      activeTab="profile"
      showBack
      title="My Skills"
      headerVariant="simple"
      maxWidth="max-w-lg"
      onBack={() => router.push('/profile')}
    >
      <div className="space-y-6">
        <SkillSearchCombobox
          label="My Skills"
          placeholder="Search skills or type to add…"
          selected={skills.map((skill) => skill.name)}
          onAdd={handleAddSkill}
          onRemove={handleRemoveSkill}
        />
        <p className="text-xs text-slate-500">
          {skills.length}/{CANDIDATE_MAX_SKILLS} skills
        </p>

        {error ? (
          <p className="text-sm font-semibold text-error" role="alert">
            {error}
          </p>
        ) : null}

        <Button
          type="button"
          loading={loading}
          loadingLabel="Saving..."
          onClick={() => void onSave()}
          className="min-h-12 rounded-xl bg-[#0a2e2c] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#072422]"
        >
          Save
        </Button>
      </div>
    </CandidateAppShell>
  );
}
