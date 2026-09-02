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
    if (next === 'SUPER_ADMIN' || next === 'ADMIN') return;
    setRole(next);
    router.replace(`/login/otp?role=${next.toLowerCase()}`, { scroll: false });
  }

  return (
    <AuthShell
      title="Sign in with OTP"
      subtitle={
        role === 'EMPLOYER'
          ? 'Access candidate passports, manage postings, and collaborate with your team.'
          : 'Access your projects, manage campaigns, and collaborate with our expert team.'
      }
      scene={role === 'EMPLOYER' ? 'employer' : 'candidate'}
      panelTitle={role === 'EMPLOYER' ? 'Hire your dream team simply and quickly' : 'Find your dream job simply and quickly'}
      panelCopy={
        role === 'EMPLOYER'
          ? 'Access candidate passports, manage postings, and collaborate with your team.'
          : 'Access your projects, manage campaigns, and collaborate with our expert team.'
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
