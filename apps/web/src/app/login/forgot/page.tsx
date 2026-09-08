'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/AuthShell';
import { OtpInput } from '@/components/OtpInput';
import { parseAccountKind, RoleToggle } from '@/components/RoleToggle';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authErrorMessage } from '@/lib/auth-errors';
import { requestOtp, resetPassword } from '@/lib/api';
import { validateEmailAddress } from '@/lib/validation';
import { registrationPasswordError, type AccountKind, type LoginAccountType } from '@careerbridge/shared';

function ForgotPasswordBody() {
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<AccountKind>(() => parseAccountKind(params.get('role')));
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [requestId, setRequestId] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  function selectRole(next: LoginAccountType) {
    if (next === 'SUPER_ADMIN' || next === 'ADMIN') return;
    setRole(next);
    setStep('request');
    setRequestId('');
    setOtp('');
    setError('');
    setMessage('');
    router.replace(`/login/forgot?role=${next.toLowerCase()}`, { scroll: false });
  }

  async function onRequestCode(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    const emailProblem = validateEmailAddress(email.trim(), true);
    if (emailProblem) {
      setError(emailProblem);
      return;
    }
    setLoading(true);
    try {
      const result = await requestOtp({
        channel: 'EMAIL',
        purpose: 'RESET_PASSWORD',
        email: email.trim().toLowerCase(),
        accountType: role,
      });
      setRequestId(result.requestId);
      setStep('reset');
      setMessage(
        result.devOtp
          ? `Code sent. Dev OTP: ${result.devOtp}`
          : 'We sent a 6-digit code to your email.',
      );
    } catch (err) {
      setError(authErrorMessage(err, 'request'));
    } finally {
      setLoading(false);
    }
  }

  async function onReset(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (otp.trim().length < 4) {
      setError('Enter the OTP from your email.');
      return;
    }
    const passwordProblem = registrationPasswordError(password);
    if (passwordProblem) {
      setError(passwordProblem);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const result = await resetPassword({
        requestId,
        otp: otp.trim(),
        accountType: role,
        password,
      });
      setMessage(result.message);
      router.replace(`/login?role=${role.toLowerCase()}`);
    } catch (err) {
      setError(authErrorMessage(err, 'verify'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle={
        role === 'EMPLOYER'
          ? 'Enter the email on your employer account to receive a reset code.'
          : 'Enter the email on your candidate account to receive a reset code.'
      }
      scene={role === 'EMPLOYER' ? 'employer' : 'candidate'}
      panelTitle={role === 'EMPLOYER' ? 'Hire your dream team simply and quickly' : 'Find your dream job simply and quickly'}
      panelCopy={
        role === 'EMPLOYER'
          ? 'Access candidate passports, manage postings, and collaborate with your team.'
          : 'Access your projects, manage campaigns, and collaborate with our expert team.'
      }
    >
      <RoleToggle value={role} onChange={selectRole} />

      {step === 'request' ? (
        <form onSubmit={onRequestCode} className="mt-5 space-y-4" noValidate>
          <Input
            label="Email address"
            name="email"
            type="email"
            autoComplete="email"
            placeholder={role === 'EMPLOYER' ? 'you@company.com' : 'you@email.com'}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {error ? (
            <p className="rounded-xl border border-error/20 bg-error/5 p-2.5 text-xs font-semibold text-error">
              {error}
            </p>
          ) : null}
          <Button type="submit" loading={loading} loadingLabel="Sending…" className="w-full">
            Send reset code
          </Button>
        </form>
      ) : (
        <form onSubmit={onReset} className="mt-5 space-y-4" noValidate>
          {message ? <p className="text-sm font-semibold text-teal">{message}</p> : null}
          <div>
            <p className="mb-1.5 text-xs font-bold text-primary">Enter OTP</p>
            <OtpInput value={otp} onChange={setOtp} />
          </div>
          <Input
            label="New password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Input
            label="Confirm password"
            name="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
          {error ? (
            <p className="rounded-xl border border-error/20 bg-error/5 p-2.5 text-xs font-semibold text-error">
              {error}
            </p>
          ) : null}
          <Button type="submit" loading={loading} loadingLabel="Updating…" className="w-full">
            Update password
          </Button>
          <button
            type="button"
            className="w-full text-center text-xs font-bold text-[#0d9488] hover:underline"
            onClick={() => {
              setStep('request');
              setOtp('');
              setPassword('');
              setConfirm('');
              setError('');
              setMessage('');
            }}
          >
            Use a different email
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-xs font-medium text-[#4e6864]">
        <Link href={`/login?role=${role.toLowerCase()}`} className="font-bold text-[#0d9488] hover:underline">
          ← Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordBody />
    </Suspense>
  );
}
