'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/AuthShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { loginAdminPortal } from '@/lib/api';
import { getStoredUser, isPlatformRole } from '@/lib/session';
import { validateEmailAddress } from '@/lib/validation';

export default function SrsbAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (user && isPlatformRole(user.role)) {
      router.replace('/srsbaadmin/dashboard');
    }
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const emailProblem = validateEmailAddress(email.trim(), true);
    if (emailProblem) {
      setError(emailProblem);
      return;
    }
    if (password.length < 8) {
      setError('Enter your admin password.');
      return;
    }
    setLoading(true);
    try {
      const session = await loginAdminPortal(email.trim().toLowerCase(), password);
      if (!isPlatformRole(session.user.role)) {
        setError('This account is not authorized for the admin portal.');
        return;
      }
      router.replace('/srsbaadmin/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#0b1f2a] px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(circle at 20% 20%, rgba(13,148,136,0.35), transparent 45%), radial-gradient(circle at 80% 10%, rgba(2,132,199,0.28), transparent 40%), linear-gradient(160deg, #0b1f2a, #102a37 55%, #0b1f2a)',
        }}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-white/95 p-7 shadow-2xl backdrop-blur">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <span className="rounded-full bg-[#0b1f2a] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
            Admin
          </span>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-[#0b1f2a]">SRSB Admin Portal</h1>
        <p className="mt-1 text-sm text-slate-600">
          Live management layer over CareerBridge candidates, employers, jobs, and applications.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <Input
            label="Admin email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="srsbhr25@gmail.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? (
            <p className="rounded-xl border border-error/20 bg-error/5 p-2.5 text-xs font-semibold text-error">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            loading={loading}
            loadingLabel="Signing in…"
            className="w-full bg-[#0d9488] hover:bg-[#0f766e]"
          >
            Sign in to Admin
          </Button>
        </form>
      </div>
    </main>
  );
}
