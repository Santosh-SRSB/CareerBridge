'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { onboardingPrimaryButtonClass } from '@/components/OnboardingFrame';
import { getStoredUser, patchStoredUser } from '@/lib/session';
import { getCandidateMe } from '@/lib/api';

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
          onboardingCompleted: true,
        });
      })
      .finally(() => setReady(true));
  }, [router]);

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#faf8f4] text-sm text-slate-500">
        Loading...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf8f4] px-5 py-10">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-extrabold text-slate-900">You&apos;re ready!</h1>
        <p className="mt-3 text-base font-semibold text-slate-700">
          Your Career Passport is {completion}% complete.
        </p>
        <p className="mt-4 text-sm text-slate-500">You can now:</p>
        <ul className="mt-3 space-y-2 text-sm font-semibold text-slate-800">
          <li>Explore jobs</li>
          <li>Build your resume</li>
          <li>Practice interviews</li>
        </ul>
        <div className="mt-8">
          <Button
            type="button"
            size="md"
            block
            className={onboardingPrimaryButtonClass}
            onClick={() => router.replace('/dashboard')}
          >
            Go to My Dashboard
          </Button>
        </div>
      </div>
    </main>
  );
}
