'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/AuthShell';
import { PhoneAuthForm } from '@/components/PhoneAuthForm';
import { parseAccountKind, RoleToggle } from '@/components/RoleToggle';
import type { AccountKind, LoginAccountType } from '@careerbridge/shared';

function OtpLoginBody() {
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<AccountKind>(() => parseAccountKind(params.get('role')));

  function selectRole(next: LoginAccountType) {
    setRole(next);
    router.replace(`/login/otp?role=${next.toLowerCase()}`, { scroll: false });
  }

  return (
    <AuthShell
      title="Sign in with OTP"
      subtitle={
        role === 'EMPLOYER'
          ? 'Access candidate passports, manage postings, and collaborate with your team.'
          : 'Access your Career Passport, applications, and interviews in one place.'
      }
      scene={role === 'EMPLOYER' ? 'employer' : 'candidate'}
      mode="signin"
      signInHref={`/login?role=${role.toLowerCase()}`}
      registerHref={role === 'EMPLOYER' ? '/register?role=employer' : '/register?role=candidate'}
      panelTitle="Welcome Page"
      panelCopy={
        role === 'EMPLOYER'
          ? 'Access candidate passports, manage postings, and collaborate with your team on CareerBridge.'
          : 'Build your Career Passport, practice with AI interviews, and get discovered by employers who hire on merit.'
      }
    >
      <RoleToggle value={role} onChange={selectRole} />
      <div className="mt-5">
        <PhoneAuthForm key={role} purpose="LOGIN" accountType={role} />
      </div>
      <p className="mt-6 text-center text-xs text-[#4e6864] font-medium">
        <Link href={`/login?role=${role.toLowerCase()}`} className="font-bold text-[#0d9488] transition hover:underline">
          ← Sign in with password
        </Link>
      </p>
    </AuthShell>
  );
}

export default function OtpLoginPage() {
  return (
    <Suspense>
      <OtpLoginBody />
    </Suspense>
  );
}
