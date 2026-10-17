'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthRoleSwitch } from '@/components/auth/AuthRoleSwitch';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { EmployerRegisterForm } from '@/components/EmployerRegisterForm';
import { RegistrationForm } from '@/components/RegistrationForm';
import { parseLoginAccountType } from '@/components/RoleToggle';
import type { LoginAccountType } from '@careerbridge/shared';

function RegisterBody() {
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<LoginAccountType>(() => parseLoginAccountType(params.get('role')));

  function selectRole(next: LoginAccountType) {
    setRole(next);
    router.replace(`/register?role=${next.toLowerCase()}`, { scroll: false });
  }

  return (
    <AuthScreen
      variant="register"
      role={role === 'EMPLOYER' ? 'employer' : 'candidate'}
      switchHref={`/login?role=${role.toLowerCase()}`}
    >
      <h1 className="au-title">Create account</h1>
      <p className="au-sub">
        {role === 'EMPLOYER'
          ? 'Employer registration. Use a valid work email.'
          : 'Candidate registration. Tell us how to reach you.'}
      </p>
      <AuthRoleSwitch value={role} onChange={selectRole} label="Register as" />
      {role === 'EMPLOYER' ? <EmployerRegisterForm /> : <RegistrationForm />}
    </AuthScreen>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterBody />
    </Suspense>
  );
}
