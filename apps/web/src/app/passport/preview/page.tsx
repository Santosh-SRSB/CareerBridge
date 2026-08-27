'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CandidateProfile } from '@careerbridge/shared';
import { CandidateResumeSheet } from '@/components/CandidateResumeSheet';
import { Button } from '@/components/ui/Button';
import { getCandidateMe } from '@/lib/api';
import { PASSPORT_FLOW_START } from '@/lib/passport-flow';
import { getStoredUser } from '@/lib/session';

export default function PassportPreviewPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);

  useEffect(() => {
    if (!getStoredUser()) {
      router.replace('/login');
      return;
    }
    getCandidateMe()
      .then(setProfile)
      .catch(() => router.replace('/login'));
  }, [router]);

  if (!profile) {
    return <main className="cb-app text-muted">Preparing your resume preview...</main>;
  }

  return (
    <main className="cb-profile-page">
      <div className="cb-resume-flow-wrap">
        <p className="cb-resume-kicker">Step preview</p>
        <h1 className="text-2xl font-extrabold text-primary sm:text-3xl">Here is your resume so far</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          We prefilled what we could. Some sections may still be empty — next you can complete your Career Passport
          portal, or skip anything and continue.
        </p>

        <div className="mt-6">
          <CandidateResumeSheet
            profile={profile}
            title="Draft resume"
            note="This is not a final ATS download. Build or enhance later from the dashboard when you are ready."
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" size="md" block={false} onClick={() => router.push(PASSPORT_FLOW_START)}>
            Continue to Career Passport
          </Button>
          <Link href="/passport/saved" className="inline-flex h-10 items-center rounded-full border border-primary px-4 text-sm font-semibold text-primary">
            Skip portal for now
          </Link>
        </div>
      </div>
    </main>
  );
}
