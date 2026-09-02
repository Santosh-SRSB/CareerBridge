'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/AuthShell';
import { ClientOnly } from '@/components/ClientOnly';
import { PasswordLoginForm } from '@/components/PasswordLoginForm';
import { PhoneAuthForm } from '@/components/PhoneAuthForm';
import { RegisteredNotice } from '@/components/RegisteredNotice';
import { parseLoginAccountType, RoleToggle } from '@/components/RoleToggle';
import type { LoginAccountType } from '@careerbridge/shared';

function LoginBody() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<LoginAccountType>(() => parseLoginAccountType(params.get('role')));
  const isStaff = mode === 'SUPER_ADMIN' || mode === 'ADMIN';
  const registerHref =
    mode === 'EMPLOYER' ? '/employer/register' : '/register?role=candidate';

  function selectMode(next: LoginAccountType) {
    setMode(next);
    const roleParam =
      next === 'SUPER_ADMIN' ? 'super_admin' : next === 'ADMIN' ? 'admin' : next.toLowerCase();
    router.replace(`/login?role=${roleParam}`, { scroll: false });
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
        {!isStaff ? <RegisteredNotice /> : null}
        {mode === 'EMPLOYER' ? (
          <PasswordLoginForm key={mode} accountType={mode} />
        ) : (
          <PhoneAuthForm key={mode} purpose="LOGIN" accountType="CANDIDATE" />
        )}
      </div>
      <div className="mt-6 space-y-2 text-center text-xs text-[#4e6864] font-medium">
        {mode === 'EMPLOYER' ? (
          <p>
            Prefer passwordless?{' '}
            <Link href="/login/otp?role=employer" className="font-bold text-[#0d9488] transition hover:underline">
              Sign in with OTP
            </Link>
          </p>
        ) : null}
        <p>
          Don't have an account?{' '}
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
