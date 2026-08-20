'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/AuthShell';
import { getStoredUser, patchStoredUser } from '@/lib/session';
import { getCandidateMe } from '@/lib/api';
import { BackButton } from '@/components/ui/BackButton';

export default function OnboardingCompletePage() {
  const router = useRouter();
  const [completion, setCompletion] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getStoredUser()) {
      router.replace('/login');
      return;
    }
    getCandidateMe()
      .then((profile) => {
        setCompletion(profile.profileCompletion);
        patchStoredUser({
          firstName: profile.firstName,
          onboardingCompleted: profile.onboardingCompleted,
        });
      })
      .finally(() => setReady(true));
  }, [router]);

  if (!ready) return null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <BackButton fallback="/onboarding/interests" />
        <Logo />
      </div>
      <div className="mt-16 rounded-lg bg-surface p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-primary">You&apos;re ready!</h1>
        <p className="mt-3 text-lg text-primary">
          Your Career Passport is {completion}% complete.
        </p>
        <p className="mt-4 text-muted">You can now:</p>
        <ul className="mt-3 space-y-2 text-primary">
          <li>✓ Explore jobs</li>
          <li>✓ Create your resume</li>
          <li>✓ Practice interviews</li>
        </ul>
        <div className="mt-8">
          <Button onClick={() => router.replace('/dashboard')}>Go to My Dashboard</Button>
        </div>
      </div>
    </main>
  );
}
