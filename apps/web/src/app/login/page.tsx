'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/AuthShell';
import { ClientOnly } from '@/components/ClientOnly';
import { PasswordLoginForm } from '@/components/PasswordLoginForm';
import { RegisteredNotice } from '@/components/RegisteredNotice';
import { parseLoginAccountType, RoleToggle } from '@/components/RoleToggle';
import type { LoginAccountType } from '@careerbridge/shared';

function LoginBody() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<LoginAccountType>(() => parseLoginAccountType(params.get('role')));
  const registerHref =
    mode === 'EMPLOYER' ? '/employer/register' : '/register?role=candidate';

  function selectMode(next: LoginAccountType) {
    setMode(next);
    router.replace(`/login?role=${next.toLowerCase()}`, { scroll: false });
  }

  return (
    <AuthShell
      title="Welcome back!"
      maxWidthClass="max-w-[440px]"
      scene={mode === 'EMPLOYER' ? 'employer' : 'candidate'}
      panelTitle={
        mode === 'EMPLOYER'
          ? 'Hire your dream team simply and quickly'
          : 'Find your dream job simply and quickly'
      }
      panelCopy={
        mode === 'EMPLOYER'
          ? 'Access candidate passports, manage postings, and collaborate with your team.'
          : 'Access your projects, manage campaigns, and collaborate with our expert team.'
      }
    >
      <ClientOnly minHeight={48}>
        <RoleToggle value={mode} onChange={selectMode} />
      </ClientOnly>
      <div className="mt-5">
        <RegisteredNotice />
        <PasswordLoginForm key={mode} accountType={mode} />
      </div>
      <div className="mt-5 space-y-2 text-center text-sm text-[#4e6864]">
        <p>
          Don&apos;t have an account?{' '}
          <Link href={registerHref} className="font-bold text-[#0d9488] transition hover:underline">
            Sign Up
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginBody />
    </Suspense>
  );
}
