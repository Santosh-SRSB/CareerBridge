'use client';

import { AuthScreen } from '@/components/auth/AuthScreen';
import { EmployerRegisterForm } from '@/components/EmployerRegisterForm';

export default function EmployerRegisterPage() {
  return (
    <AuthScreen
      variant="register"
      role="employer"
      switchHref="/login?role=employer"
      backHref="/login?role=employer"
    >
      <h1 className="au-title">Create account</h1>
      <p className="au-sub">Employer registration. Use a valid work email.</p>
      <EmployerRegisterForm />
    </AuthScreen>
  );
}
