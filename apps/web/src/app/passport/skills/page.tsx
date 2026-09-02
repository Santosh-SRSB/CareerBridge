'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type CandidateSkill } from '@careerbridge/shared';
import { Button } from '@/components/ui/Button';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { getStoredUser } from '@/lib/session';
import { addSkill, getCandidateMe, removeSkill } from '@/lib/api';

const DEFAULT_SUGGESTED = ['Communication', 'English', 'Customer Service', 'MS Excel'];

export default function PassportSkillsPage() {
  const router = useRouter();
  const [skills, setSkills] = useState<CandidateSkill[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
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
    setSearchTerm('');

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

  const availableSuggested = DEFAULT_SUGGESTED.filter(
    (s) => !skills.some((sk) => sk.name.toLowerCase() === s.toLowerCase()),
  );

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
        <div className="space-y-2">
          <p className="text-sm font-bold text-slate-900">My Skills</p>
          <p className="text-xs font-medium text-slate-500">Search for a skill</p>
          <input
            id="skill-search"
            type="text"
            placeholder="Type a skill..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleAddSkill(searchTerm);
              }
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#0a2e2c] focus:ring-2 focus:ring-[#0a2e2c]/10"
          />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-bold text-slate-900">Suggested skills</p>
          <div className="space-y-2">
            {availableSuggested.map((skill) => (
              <div key={skill} className="flex items-center justify-between gap-3">
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
                  {skill}
                </span>
                <button
                  type="button"
                  onClick={() => void handleAddSkill(skill)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-[#0a2e2c] hover:bg-slate-50"
                  aria-label={`Add ${skill}`}
                >
                  +
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-4">
          <p className="text-sm font-bold text-slate-900">My Skills</p>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span
                key={skill.id}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-[#0a2e2c]"
              >
                <span>{skill.name}</span>
                <button
                  type="button"
                  onClick={() => void handleRemoveSkill(skill.id)}
                  className="text-sm font-bold leading-none text-emerald-700 hover:text-emerald-950"
                  aria-label={`Remove ${skill.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

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
