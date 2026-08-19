'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/AuthShell';
import { PasswordLoginForm } from '@/components/PasswordLoginForm';
import { RegisteredNotice } from '@/components/RegisteredNotice';
import { parseAccountKind, RoleToggle } from '@/components/RoleToggle';
import type { AccountKind } from '@careerbridge/shared';

function LoginBody() {
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<AccountKind>(() => parseAccountKind(params.get('role')));
  const registerHref = `/register?role=${role.toLowerCase()}`;

  function selectRole(next: AccountKind) {
    setRole(next);
    router.replace(`/login?role=${next.toLowerCase()}`, { scroll: false });
  }

  return (
    <AuthShell
      title="Sign In"
      scene={role === 'EMPLOYER' ? 'employer' : 'candidate'}
      panelTitle={role === 'EMPLOYER' ? 'Hire with confidence' : 'Welcome back'}
      panelCopy={
        role === 'EMPLOYER'
          ? 'Sign in to post jobs and review Career Passports.'
          : 'Sign in to continue building your Career Passport.'
      }
      subtitle={
        role === 'EMPLOYER'
          ? 'Employer login with email or mobile number and password.'
          : 'Candidate login with email or mobile number and password.'
      }
    >
      <RoleToggle value={role} onChange={selectRole} />
      <div className="mt-4">
        <RegisteredNotice />
        <PasswordLoginForm key={role} accountType={role} />
      </div>
      <p className="mt-3 text-center text-xs text-muted">
        New here?{' '}
        <Link href={registerHref} className="font-semibold text-orange transition hover:text-primary">
          {role === 'EMPLOYER' ? 'Create employer account' : 'Create your free Career Passport'}
        </Link>
      </p>
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
