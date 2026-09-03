'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CandidateProfile, ProfileCompletion } from '@careerbridge/shared';
import { PROFILE_OVERVIEW_SECTION_KEYS } from '@careerbridge/shared';
import { getCandidateMe, getProfileCompletion } from '@/lib/api';
import { getStoredUser } from '@/lib/session';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { Button } from '@/components/ui/Button';

const PROFILE_SECTIONS = PROFILE_OVERVIEW_SECTION_KEYS.map((key) => ({
  key,
  label:
    key === 'personal'
      ? 'Personal Information'
      : key === 'preferences'
        ? 'Preferences'
        : key.charAt(0).toUpperCase() + key.slice(1),
  href: `/passport/${key}`,
}));

function SectionStatusIcon({ done }: { done: boolean }) {
  if (done) {
    return <span className="text-base font-bold text-[#22c55e]">✓</span>;
  }
  return <span className="text-base font-bold text-slate-400">○</span>;
}

function PassportOverviewPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [completion, setCompletion] = useState<ProfileCompletion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getStoredUser()) {
      router.replace('/login');
      return;
    }
    Promise.all([getCandidateMe(), getProfileCompletion()])
      .then(([nextProfile, nextCompletion]) => {
        setProfile(nextProfile);
        setCompletion(nextCompletion);
      })
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || !profile || !completion) {
    return (
      <CandidateAppShell activeTab="profile" showBack title="My Profile" headerVariant="simple" maxWidth="max-w-lg">
        <div className="py-16 text-center text-sm text-slate-500">Loading profile...</div>
      </CandidateAppShell>
    );
  }

  const completionPercent = completion.percentage ?? 0;

  return (
    <CandidateAppShell
      activeTab="profile"
      showBack
      title="My Profile"
      headerVariant="simple"
      maxWidth="max-w-lg"
      onBack={() => router.push('/dashboard')}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-bold text-slate-800">Profile completion: {completionPercent}%</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-[#e68a39] transition-all duration-500"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>

        <div className="space-y-0">
          {PROFILE_SECTIONS.map((section) => {
            const sectionState = completion.sections.find((item) => item.key === section.key);
            const isDone =
              section.key === 'skills'
                ? (profile.skills?.length ?? 0) >= 3
                : (sectionState?.done ?? false);
            return (
              <Link
                key={section.key}
                href={section.href}
                className="flex items-center justify-between gap-4 border-b border-slate-200 py-3.5 transition hover:bg-white/60"
              >
                <span className="text-sm font-semibold text-slate-800">{section.label}</span>
                <SectionStatusIcon done={isDone} />
              </Link>
            );
          })}
        </div>

        <Button
          type="button"
          onClick={() => router.push('/passport/personal')}
          className="w-full rounded-xl bg-[#3b6cf4] py-3.5 text-sm font-bold text-white shadow-sm hover:bg-[#2f5ed4]"
        >
          Edit Profile
        </Button>
      </div>
    </CandidateAppShell>
  );
}

export default function PassportPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Loading profile...</div>}>
      <PassportOverviewPage />
    </Suspense>
  );
}
