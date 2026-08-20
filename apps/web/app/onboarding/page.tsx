'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/AuthShell';
import { getStoredUser } from '@/lib/session';
import { BackButton } from '@/components/ui/BackButton';

export default function OnboardingWelcomePage() {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.onboardingCompleted) {
      router.replace('/dashboard');
      return;
    }
    setName(user.firstName);
    setReady(true);
  }, [router]);

  if (!ready) return null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <BackButton fallback="/login" />
        <Logo />
      </div>
      <div className="mt-16 rounded-lg bg-surface p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-primary">
          {name ? `Welcome, ${name}!` : 'Welcome!'}
        </h1>
        <p className="mt-3 text-lg text-primary">Let&apos;s build your Career Passport.</p>
        <p className="mt-4 text-muted">It will help you:</p>
        <ul className="mt-3 space-y-2 text-primary">
          <li>✓ Create better resumes</li>
          <li>✓ Find suitable jobs</li>
          <li>✓ Practice interviews</li>
          <li>✓ Improve your skills</li>
        </ul>
        <p className="mt-6 text-sm text-muted">This will take about 3 minutes.</p>
        <div className="mt-8">
          <Button onClick={() => router.push('/onboarding/name')}>Let&apos;s Start</Button>
        </div>
      </div>
    </main>
  );
}
