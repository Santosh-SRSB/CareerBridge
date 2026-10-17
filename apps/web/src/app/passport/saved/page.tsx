'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CandidateProfile } from '@careerbridge/shared';
import { CandidateResumeSheet } from '@/components/CandidateResumeSheet';
import { Button } from '@/components/ui/Button';
import { createResume, getCandidateMe } from '@/lib/api';
import { clearPendingResumeBuild } from '@/lib/resume-build';
import { markPassportFlowDone } from '@/lib/passport-flow';
import { getStoredUser, patchStoredUser } from '@/lib/session';

export default function PassportSavedPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [saving, setSaving] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) {
      router.replace('/login');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        clearPendingResumeBuild();
        const next = await getCandidateMe();
        if (cancelled) return;
        setProfile(next);

        patchStoredUser({ onboardingCompleted: true, firstName: next.firstName });
        markPassportFlowDone(stored.id);

        await createResume({
          targetJobTitle: next.careerInterests[0] || undefined,
          template: 'CLASSIC',
          includePhoto: Boolean(next.photoUrl),
        }).catch(() => null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not save your profile right now.');
        }
      } finally {
        if (!cancelled) setSaving(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!profile) {
    return <main className="cb-app text-muted">Saving your profile...</main>;
  }

  return (
    <main className="cb-profile-page">
      <div className="cb-resume-flow-wrap">
        <p className="cb-resume-kicker">All set</p>
        <h1 className="text-2xl font-extrabold text-primary sm:text-3xl">
          {saving ? 'Saving your profile…' : 'Your profile is saved'}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          We saved what you entered so far. Upload a resume file later to store it in Cloud Storage and
          parse it with Document AI — download is available from Build ATS Resume / Enhance Resume.
        </p>
        {error ? <p className="mt-2 text-sm text-error">{error}</p> : null}

        <div className="mt-6">
          <CandidateResumeSheet profile={profile} title="Saved profile" />
        </div>

        <div className="mt-6">
          <Button
            type="button"
            size="md"
            block={false}
            disabled={saving}
            onClick={() => router.replace('/dashboard')}
          >
            Go to candidate dashboard
          </Button>
        </div>
      </div>
    </main>
  );
}
