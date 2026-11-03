'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthRoleSwitch } from '@/components/auth/AuthRoleSwitch';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { EmployerRegisterForm } from '@/components/EmployerRegisterForm';
import { RegistrationForm } from '@/components/RegistrationForm';
import { parseLoginAccountType } from '@/components/RoleToggle';
import { saveReferralCode } from '@/lib/referral-attr';
import type { LoginAccountType } from '@careerbridge/shared';

function RegisterBody() {
  const router = useRouter();
  const params = useSearchParams();
  const refCode = (params.get('ref') || '').trim();
  const [role, setRole] = useState<LoginAccountType>(() => parseLoginAccountType(params.get('role')));

  useEffect(() => {
    if (refCode) saveReferralCode(refCode);
  }, [refCode]);

  function selectRole(next: LoginAccountType) {
    setRole(next);
    const qs = new URLSearchParams({ role: next.toLowerCase() });
    if (refCode) qs.set('ref', refCode);
    router.replace(`/register?${qs.toString()}`, { scroll: false });
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
          : refCode
            ? `Candidate registration with referral code ${refCode.toUpperCase()}.`
            : 'Candidate registration. Tell us how to reach you.'}
      </p>
      <AuthRoleSwitch value={role} onChange={selectRole} label="Register as" />
      {role === 'EMPLOYER' ? <EmployerRegisterForm /> : <RegistrationForm referralCode={refCode || undefined} />}
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
