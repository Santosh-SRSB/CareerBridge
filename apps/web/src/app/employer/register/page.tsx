'use client';

import Link from 'next/link';
import { AuthShell } from '@/components/AuthShell';
import { EmployerRegisterForm } from '@/components/EmployerRegisterForm';

export default function EmployerRegisterPage() {
  return (
    <AuthShell
      title="Register Company"
      subtitle="Create your employer account. Verify with mobile or email OTP, then complete company KYC."
      backHref="/employer/welcome"
      scene="employer"
      panelTitle="Hire your dream team simply and quickly"
      panelCopy="Post jobs, see skill-matched candidates, and move applicants from review to hire in one workspace."
      maxWidthClass="max-w-[520px]"
    >
      <EmployerRegisterForm />
      <p className="mt-4 text-center text-xs text-[#4e6864]">
        Already registered?{' '}
        <Link href="/login?role=employer" className="font-bold text-[#0d9488] transition hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
