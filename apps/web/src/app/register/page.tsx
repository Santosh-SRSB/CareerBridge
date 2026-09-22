'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/AuthShell';
import { EmployerRegisterForm } from '@/components/EmployerRegisterForm';
import { RegistrationForm } from '@/components/RegistrationForm';
import { parseLoginAccountType, RoleToggle } from '@/components/RoleToggle';
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
    <AuthShell
      title="USER REGISTER"
      subtitle=""
      maxWidthClass="max-w-[520px]"
      scene={role === 'EMPLOYER' ? 'employer' : 'candidate'}
      mode="register"
      signInHref={`/login?role=${role.toLowerCase()}`}
      registerHref={`/register?role=${role.toLowerCase()}`}
    >
      <RoleToggle value={role} onChange={selectRole} />
      <div className="mt-3">
        {role === 'EMPLOYER' ? <EmployerRegisterForm /> : <RegistrationForm />}
      </div>
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
