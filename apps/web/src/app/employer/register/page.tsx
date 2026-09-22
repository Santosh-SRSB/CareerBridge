'use client';

import { AuthShell } from '@/components/AuthShell';
import { EmployerRegisterForm } from '@/components/EmployerRegisterForm';

export default function EmployerRegisterPage() {
  return (
    <AuthShell
      title="USER REGISTER"
      subtitle=""
      backHref="/employer/welcome"
      scene="employer"
      mode="register"
      signInHref="/login?role=employer"
      registerHref="/employer/register"
      maxWidthClass="max-w-[520px]"
    >
      <EmployerRegisterForm />
    </AuthShell>
  );
}
