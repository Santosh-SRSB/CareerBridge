'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/AuthShell';
import { RegistrationForm } from '@/components/RegistrationForm';
import { EmployerRegisterForm } from '@/components/EmployerRegisterForm';
import { parseAccountKind, RoleToggle } from '@/components/RoleToggle';
import type { AccountKind } from '@careerbridge/shared';

function RegisterBody() {
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<AccountKind>(() => parseAccountKind(params.get('role')));
  const loginHref = `/login?role=${role.toLowerCase()}`;

  function selectRole(next: AccountKind) {
    setRole(next);
    router.replace(`/register?role=${next.toLowerCase()}`, { scroll: false });
  }

  return (
    <AuthShell
      title={role === 'EMPLOYER' ? 'Employer registration' : 'Create your free Career Passport'}
      scene={role === 'EMPLOYER' ? 'employer' : 'candidate'}
      panelTitle={role === 'EMPLOYER' ? 'Find the right talent' : 'Build your future'}
      panelCopy={
        role === 'EMPLOYER'
          ? 'Create an employer account, verify your email, then sign in to hire.'
          : 'A free Career Passport helps you get discovered for the right jobs.'
      }
      subtitle={
        role === 'EMPLOYER'
          ? 'We will send an email OTP. After verification, sign in with email or mobile and password.'
          : 'Choose Mobile OTP or Email OTP. Name, location, language, and password stay the same.'
      }
    >
      <RoleToggle value={role} onChange={selectRole} />
      <div className="mt-4">
        {role === 'EMPLOYER' ? <EmployerRegisterForm /> : <RegistrationForm />}
      </div>
      <p className="mt-3 text-center text-xs text-muted">
        Already have an account?{' '}
        <Link href={loginHref} className="font-semibold text-orange transition hover:text-teal">
          Sign In
        </Link>
      </p>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterBody />
    </Suspense>
  );
}
