'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/AuthShell';
import { PasswordLoginForm } from '@/components/PasswordLoginForm';
import { RegisteredNotice } from '@/components/RegisteredNotice';
import { parseLoginAccountType, RoleToggle } from '@/components/RoleToggle';
import type { LoginAccountType } from '@careerbridge/shared';

function LoginBody() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<LoginAccountType>(() => parseLoginAccountType(params.get('role')));
  const registerHref =
    mode === 'EMPLOYER' ? '/register?role=employer' : '/register?role=candidate';

  function selectMode(next: LoginAccountType) {
    setMode(next);
    router.replace(`/login?role=${next.toLowerCase()}`, { scroll: false });
  }

  return (
    <AuthShell
      title="USER LOGIN"
      subtitle=""
      scene={mode === 'EMPLOYER' ? 'employer' : 'candidate'}
      mode="signin"
      signInHref={`/login?role=${mode.toLowerCase()}`}
      registerHref={registerHref}
    >
      <RoleToggle value={mode} onChange={selectMode} />
      <div className="mt-3">
        <RegisteredNotice />
        <PasswordLoginForm key={mode} accountType={mode} />
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
