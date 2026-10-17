'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthRoleSwitch } from '@/components/auth/AuthRoleSwitch';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { PasswordLoginForm } from '@/components/PasswordLoginForm';
import { RegisteredNotice } from '@/components/RegisteredNotice';
import { parseLoginAccountType } from '@/components/RoleToggle';
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
    <AuthScreen
      variant="login"
      role={mode === 'EMPLOYER' ? 'employer' : 'candidate'}
      switchHref={registerHref}
    >
      <h1 className="au-title">Sign in</h1>
      <p className="au-sub">
        {mode === 'EMPLOYER'
          ? 'Employer login. Use your work email.'
          : 'Candidate login. Use your email to continue.'}
      </p>
      <AuthRoleSwitch value={mode} onChange={selectMode} label="Log in as" />
      <div className="au-notice">
        <RegisteredNotice />
      </div>
      <PasswordLoginForm key={mode} accountType={mode} />
      <p className="au-signup">
        Don&apos;t have an account? <Link href={registerHref}>Sign up</Link>
      </p>
    </AuthScreen>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginBody />
    </Suspense>
  );
}
