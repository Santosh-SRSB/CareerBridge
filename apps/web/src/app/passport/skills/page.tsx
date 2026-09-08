'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type CandidateSkill } from '@careerbridge/shared';
import { Button } from '@/components/ui/Button';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { SkillSearchCombobox } from '@/components/resume/SkillSearchCombobox';
import { getStoredUser } from '@/lib/session';
import { addSkill, getCandidateMe, removeSkill } from '@/lib/api';

export default function PassportSkillsPage() {
  const router = useRouter();
  const [skills, setSkills] = useState<CandidateSkill[]>([]);
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
        if (profile.skills?.length) setSkills(profile.skills);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [router]);

  async function handleAddSkill(name: string) {
    if (!name.trim()) return;
    const exists = skills.some((s) => s.name.toLowerCase() === name.trim().toLowerCase());
    if (exists) return;

    const newSkill: CandidateSkill = { id: `temp-${Date.now()}`, name: name.trim() };
    setSkills((prev) => [...prev, newSkill]);

    try {
      const profile = await addSkill({ name: name.trim() });
      if (profile.skills) setSkills(profile.skills);
    } catch {
      // Keep optimistic item
    }
  }

  async function handleRemoveSkill(id: string) {
    const item = skills.find((s) => s.id === id);
    setSkills((prev) => prev.filter((s) => s.id !== id));
    if (item && !id.startsWith('temp-')) {
      try {
        await removeSkill(id);
      } catch {
        // Ignored
      }
    }
  }

  async function onSave() {
    if (skills.length < 1) {
      setError('Add at least one skill to save.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      router.push('/profile');
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
          onAdd={(name) => void handleAddSkill(name)}
          onRemove={(name) => {
            const match = skills.find((skill) => skill.name.toLowerCase() === name.toLowerCase());
            if (match) void handleRemoveSkill(match.id);
          }}
        />

        {error ? <p className="text-sm font-semibold text-error">{error}</p> : null}

        <Button
          type="button"
          loading={loading}
          loadingLabel="Saving..."
          onClick={() => void onSave()}
          className="rounded-xl bg-[#0a2e2c] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#072422]"
        >
          Save
        </Button>
      </div>
    </CandidateAppShell>
  );
}
