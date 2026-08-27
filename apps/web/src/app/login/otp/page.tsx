'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/AuthShell';
import { PhoneAuthForm } from '@/components/PhoneAuthForm';
import { parseAccountKind, RoleToggle } from '@/components/RoleToggle';
import type { AccountKind } from '@careerbridge/shared';

function OtpLoginBody() {
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<AccountKind>(() => parseAccountKind(params.get('role')));

  function selectRole(next: AccountKind) {
    setRole(next);
    router.replace(`/login/otp?role=${next.toLowerCase()}`, { scroll: false });
  }

  return (
    <AuthShell
      title="Sign in with OTP"
      subtitle={
        role === 'EMPLOYER'
          ? 'Employer login with Mobile OTP or Email OTP.'
          : 'Candidate login with Mobile OTP or Email OTP.'
      }
      scene={role === 'EMPLOYER' ? 'employer' : 'verify'}
    >
      <RoleToggle value={role} onChange={selectRole} />
      <div className="mt-4">
        <PhoneAuthForm key={role} purpose="LOGIN" accountType={role} />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        <Link href={`/login?role=${role.toLowerCase()}`} className="font-semibold text-primary">
          Sign in with password
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
