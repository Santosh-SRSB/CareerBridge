'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/AuthShell';
import { RegistrationForm } from '@/components/RegistrationForm';
import { EmployerRegisterForm } from '@/components/EmployerRegisterForm';
import { parseAccountKind, RoleToggle } from '@/components/RoleToggle';
import type { AccountKind, LoginAccountType } from '@careerbridge/shared';

function RegisterBody() {
  const router = useRouter();
  const params = useSearchParams();
  const roleParam = parseAccountKind(params.get('role'));
  const [role, setRole] = useState<AccountKind>(roleParam);
  const loginHref = `/login?role=${role.toLowerCase()}`;

  useEffect(() => {
    setRole(roleParam);
  }, [roleParam]);

  function selectRole(next: LoginAccountType) {
    if (next === 'SUPER_ADMIN' || next === 'ADMIN') return;
    setRole(next);
    router.replace(`/register?role=${next.toLowerCase()}`, { scroll: false });
  }

  return (
    <AuthShell
      title={role === 'EMPLOYER' ? 'Register Company' : 'Create your free profile'}
      maxWidthClass="max-w-[520px]"
      scene={role === 'EMPLOYER' ? 'employer' : 'candidate'}
      panelTitle={role === 'EMPLOYER' ? 'Find the right talent simply and quickly' : 'Find your dream job simply and quickly'}
      panelCopy={
        role === 'EMPLOYER'
          ? 'Create your employer account, post jobs, and connect with top scored candidates.'
          : 'Build your verified Career Passport, practice with AI interviews, and get discovered.'
      }
    >
      <RoleToggle value={role} onChange={selectRole} />
      <div className="mt-5">
        {role === 'EMPLOYER' ? <EmployerRegisterForm /> : <RegistrationForm />}
      </div>
      <p className="mt-5 text-center text-sm text-[#4e6864]">
        Already registered?{' '}
        <Link href={loginHref} className="font-bold text-[#0d9488] transition hover:underline">
          Login
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
